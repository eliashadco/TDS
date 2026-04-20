import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { rateLimitAI, sanitizeText } from "@/lib/api/security";
import { validateJustification, classifyOverride, extractBrokenRules, getTimerDuration } from "@/lib/trading/override";
import { assertTransition } from "@/lib/trading/validation";
import { buildOverrideAuditPrompt } from "@/lib/ai/prompts";
import { createAIJsonCompletion } from "@/lib/ai/provider";
import { parseAIResponse } from "@/lib/ai/parser";
import type { DisciplineProfile, TradeState } from "@/types/trade";

function isMissingDisciplineProfileColumn(error: { code?: string; message?: string } | null) {
  return error?.code === "42703" && (error.message ?? "").includes("discipline_profile");
}

/* ---------- POST /api/trade/override ----------
 * TRD v2 §9 — Override System
 * Validates justification, classifies override, inserts record,
 * transitions trade state, kicks off async AI audit.
 * ----------------------------------------------- */

export async function POST(request: NextRequest) {
  /* --- Auth --- */
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  /* --- Rate limit --- */
  const rateCheck = await rateLimitAI(request, "override", 20);
  if (!rateCheck.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterSec: rateCheck.retryAfterSec },
      { status: 429 },
    );
  }

  /* --- Parse body --- */
  let body: { tradeId?: string; justification?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tradeId = typeof body.tradeId === "string" ? body.tradeId.trim() : "";
  const justification = sanitizeText(body.justification, 1000);

  if (!tradeId) {
    return NextResponse.json({ error: "tradeId is required" }, { status: 400 });
  }

  /* --- Validate justification (TRD v2 §9.3) --- */
  const justResult = validateJustification(justification);
  if (!justResult.valid) {
    return NextResponse.json(
      { error: "Justification invalid", reason: justResult.reason, wordCount: justResult.wordCount, uniqueRatio: justResult.uniqueRatio },
      { status: 422 },
    );
  }

  /* --- Load trade --- */
  const { data: trade, error: tradeErr } = await supabase
    .from("trades")
    .select("id, user_id, ticker, direction, state, classification, strategy_name, f_score, f_total, t_score, t_total")
    .eq("id", tradeId)
    .single();

  if (tradeErr || !trade) {
    return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  }

  if (trade.user_id !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  /* --- Validate state transition (TRD v2 §22.1) --- */
  const currentState = (trade.state ?? "blocked") as TradeState;
  try {
    assertTransition(currentState, "overridden");
  } catch {
    return NextResponse.json(
      { error: `Cannot override trade in state "${currentState}". Only blocked trades can be overridden.` },
      { status: 409 },
    );
  }

  /* --- Load user discipline profile --- */
  let { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("discipline_profile")
    .eq("id", user.id)
    .maybeSingle();

  if (isMissingDisciplineProfileColumn(profileError)) {
    profile = null;
    profileError = null;
  }

  const disciplineProfile = ((profile as Record<string, unknown>)?.discipline_profile ?? "balanced") as DisciplineProfile;
  const timerDuration = getTimerDuration(disciplineProfile);

  /* --- Extract broken rules --- */
  const rulesBroken = extractBrokenRules(
    "blocked",
    null,
    trade.f_score,
    trade.f_total,
    trade.t_score,
    trade.t_total,
  );

  /* --- Classify override (TRD v2 §9.4) --- */
  // Get recent losing trades for drawdown / consecutive loss context
  const { data: recentTrades } = await supabase
    .from("trades")
    .select("exit_price, entry_price, direction, closed")
    .eq("user_id", user.id)
    .eq("closed", true)
    .order("closed_at", { ascending: false })
    .limit(10);

  let consecutiveLosses = 0;
  let drawdownPct = 0;

  if (recentTrades && recentTrades.length > 0) {
    // Count consecutive losses from most recent
    for (const t of recentTrades) {
      if (t.exit_price == null || t.entry_price == null) break;
      const pnl = t.direction === "LONG"
        ? t.exit_price - t.entry_price
        : t.entry_price - t.exit_price;
      if (pnl < 0) {
        consecutiveLosses++;
      } else {
        break;
      }
    }

    // Simple drawdown estimate from recent trades
    const totalPnl = recentTrades.reduce((sum, t) => {
      if (t.exit_price == null || t.entry_price == null) return sum;
      const pnl = t.direction === "LONG"
        ? t.exit_price - t.entry_price
        : t.entry_price - t.exit_price;
      return sum + pnl;
    }, 0);

    if (totalPnl < 0) {
      const avgEntry = recentTrades[0]?.entry_price ?? 100;
      drawdownPct = Math.abs(totalPnl / avgEntry) * 100;
    }
  }

  const qualityFlag = classifyOverride({
    justification,
    drawdownPct,
    consecutiveLosses,
  });

  /* --- Insert override record --- */
  const { data: override, error: insertErr } = await supabase
    .from("overrides")
    .insert({
      trade_id: tradeId,
      user_id: user.id,
      rules_broken: rulesBroken,
      justification,
      quality_flag: qualityFlag,
      timer_duration_sec: timerDuration,
    })
    .select("id")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: "Failed to record override" }, { status: 500 });
  }

  /* --- Update trade state → overridden + classification → override --- */
  const { error: updateErr } = await supabase
    .from("trades")
    .update({
      state: "overridden",
      classification: "override",
      confirmed: true,
    })
    .eq("id", tradeId);

  if (updateErr) {
    return NextResponse.json({ error: "Failed to update trade state" }, { status: 500 });
  }

  /* --- Async AI audit (TRD v2 §9.3 — non-blocking) --- */
  // Fire and forget — updates the override record with AI assessment
  void (async () => {
    try {
      const auditPrompt = buildOverrideAuditPrompt({
        ticker: trade.ticker,
        direction: trade.direction as "LONG" | "SHORT",
        strategyName: trade.strategy_name ?? "Unknown",
        rulesBroken,
        justification,
        overrideQuality: qualityFlag,
      });

      const aiResult = await createAIJsonCompletion({
        prompt: auditPrompt,
        system: "You are a trading discipline auditor. Evaluate override justifications objectively.",
        maxTokens: 300,
      });

      const parsed = parseAIResponse<Record<string, unknown>>(aiResult.text);
      if (parsed) {
        await supabase
          .from("overrides")
          .update({ ai_audit: parsed as unknown as import("@/types/database").Json })
          .eq("id", override.id);

        // If AI flags a different quality level, upgrade severity (never downgrade)
        const aiQuality = typeof parsed.quality === "string" ? parsed.quality : undefined;
        if (aiQuality === "high_risk" && qualityFlag !== "high_risk") {
          await supabase
            .from("overrides")
            .update({ quality_flag: "high_risk" })
            .eq("id", override.id);
        }
      }
    } catch {
      // AI audit failure is non-critical — override still proceeds
    }
  })();

  return NextResponse.json({
    overrideId: override.id,
    qualityFlag,
    timerDuration,
    rulesBroken,
    tradeState: "overridden",
    classification: "override",
  });
}
