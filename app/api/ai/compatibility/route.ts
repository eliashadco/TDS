import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
import { createServerSupabase } from "@/lib/supabase/server";
import { buildAssessmentPrompt } from "@/lib/ai/prompts";
import { parseAIResponse } from "@/lib/ai/parser";
import { aiErrorResponse, createAIJsonCompletion, resolveAIProviderConfig } from "@/lib/ai/provider";
import { getCached, setCache } from "@/lib/market/cache";
import { getCandles, getQuote } from "@/lib/market/polygon";
import { rateLimitAI, sanitizeTicker } from "@/lib/api/security";
import { getConviction } from "@/lib/trading/scoring";
import { evaluateGates } from "@/lib/trading/validation";
import { mapPersistedMetricRowToMetric, resolveMetricAssessmentDescription } from "@/lib/trading/user-metrics";
import { scoreFromAIResponse, type CompatibilityResult } from "@/lib/trading/compatibility";
import { computeSmartStop } from "@/lib/trading/smart-stop";
import { normalizeStrategyStructure } from "@/lib/trading/strategies";
import { buildStarterStructure } from "@/lib/trading/strategy-presets";
import type { Metric, TradeMode } from "@/types/trade";

/* ---------- Request shape ---------- */

type CompatibilityBody = {
  ticker: string;
  strategyId: string;
  direction: "LONG" | "SHORT";
  /** Optional: user equity, reserved for Phase 6 sizing suggestions. */
  equity?: number;
};

/* ---------- Cache key ---------- */

function buildCompatibilityCacheKey(input: {
  provider: string;
  model: string;
  ticker: string;
  direction: "LONG" | "SHORT";
  strategyId: string;
  metricIds: string[];
}): string {
  const stablePayload = {
    provider: input.provider,
    model: input.model,
    ticker: input.ticker,
    direction: input.direction,
    strategyId: input.strategyId,
    metricIds: [...input.metricIds].sort(),
  };
  const digest = createHash("sha256").update(JSON.stringify(stablePayload)).digest("hex");
  return `compat:${digest}`;
}

function formatDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/* ---------- Route handler ---------- */

export async function POST(req: NextRequest) {
  try {
    // Rate-limit per IP (30 calls/hour, same budget as assess)
    const limit = await rateLimitAI(req, "ai:compatibility");
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec ?? 60) } },
      );
    }

    // Authenticate
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate + sanitize inputs
    const body = (await req.json()) as CompatibilityBody;
    const ticker = sanitizeTicker(body.ticker);
    const strategyId = typeof body.strategyId === "string" ? body.strategyId.trim().slice(0, 64) : "";
    const direction =
      body.direction === "LONG" || body.direction === "SHORT" ? body.direction : null;

    if (!ticker || !strategyId || !direction) {
      return NextResponse.json(
        { error: "ticker, strategyId, and direction are required" },
        { status: 400 },
      );
    }

    // Load strategy (scoped to authenticated user)
    const { data: strategy, error: strategyError } = await supabase
      .from("user_strategies")
      .select("id, name, mode, ai_instruction, active_version_id")
      .eq("id", strategyId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (strategyError) throw strategyError;
    if (!strategy) {
      return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    }

    // Load active version snapshot to get structure (setupTypes, conditions, chartPattern)
    let versionSnapshot: Record<string, unknown> = {};
    if (strategy.active_version_id) {
      const { data: versionRow } = await supabase
        .from("strategy_versions")
        .select("snapshot")
        .eq("id", strategy.active_version_id)
        .maybeSingle();
      if (versionRow?.snapshot && typeof versionRow.snapshot === "object") {
        versionSnapshot = versionRow.snapshot as Record<string, unknown>;
      }
    }

    // Load enabled metrics for this strategy
    const { data: metricRows, error: metricsError } = await supabase
      .from("user_metrics")
      .select(
        "id, strategy_id, metric_id, metric_type, name, description, category, enabled, sort_order",
      )
      .eq("user_id", user.id)
      .eq("strategy_id", strategyId)
      .eq("enabled", true)
      .order("sort_order");

    if (metricsError) throw metricsError;

    const allMetrics: Metric[] = (metricRows ?? []).map(mapPersistedMetricRowToMetric);
    const fundamentalMetrics = allMetrics.filter((m) => m.type === "fundamental");
    const technicalMetrics = allMetrics.filter((m) => m.type === "technical");

    if (allMetrics.length === 0) {
      return NextResponse.json(
        { error: "No enabled metrics found for this strategy" },
        { status: 422 },
      );
    }

    const providerConfig = resolveAIProviderConfig();

    // Check cache before hitting AI
    const cacheKey = buildCompatibilityCacheKey({
      provider: providerConfig.provider,
      model: providerConfig.model,
      ticker,
      direction,
      strategyId,
      metricIds: allMetrics.map((m) => m.id),
    });

    const cached = getCached<CompatibilityResult>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Build prompt with direction-aware metric descriptions
    const promptMetrics = allMetrics.map((m) => ({
      id: m.id,
      name: m.name,
      desc: resolveMetricAssessmentDescription(m, direction),
    }));

    const mode = (strategy.mode ?? "swing") as TradeMode;
    const fallbackStructure = buildStarterStructure(mode);
    const structure = normalizeStrategyStructure(
      versionSnapshot.structure ?? {},
      fallbackStructure,
    );
    const setups = structure.setupTypes.slice(0, 20);
    const conditions = structure.conditions.slice(0, 20);
    const chartPattern = structure.chartPattern;

    const prompt = buildAssessmentPrompt({
      ticker,
      direction,
      thesis: `Compatibility assessment: evaluate ${ticker} against the "${strategy.name}" strategy.`,
      setups,
      conditions,
      chartPattern,
      asset: "stock",
      mode,
      strategyName: strategy.name,
      strategyInstruction:
        typeof strategy.ai_instruction === "string" ? strategy.ai_instruction : null,
      metrics: promptMetrics,
    });

    const completion = await createAIJsonCompletion({
      prompt,
      system:
        "Trading analyst. Respond ONLY in valid JSON. No markdown, no preamble, no backticks.",
      maxTokens: 1500,
      useWebSearch: true,
    });

    const aiScores = parseAIResponse<Record<string, { v: "PASS" | "FAIL"; r: string }>>(
      completion.text,
    );
    if (!aiScores) {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    // Score → conviction → gate result
    const { scores, fundamentalScore, technicalScore } = scoreFromAIResponse(
      aiScores,
      fundamentalMetrics,
      technicalMetrics,
    );

    const conviction = getConviction(
      fundamentalScore,
      fundamentalMetrics.length,
      technicalScore,
      technicalMetrics.length,
    );

    const gateResult = evaluateGates(scores, fundamentalMetrics, technicalMetrics);

    const quote = await getQuote(ticker);
    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - 70);
    const candles = await getCandles(ticker, formatDate(from), formatDate(to), "day");
    const smartStop = computeSmartStop({
      direction,
      quotePrice: quote?.price ?? null,
      candles,
    });

    const result: CompatibilityResult = {
      ticker,
      strategyId,
      direction,
      scores,
      fundamentalScore,
      fundamentalTotal: fundamentalMetrics.length,
      technicalScore,
      technicalTotal: technicalMetrics.length,
      conviction,
      gateResult,
      metrics: allMetrics,
      aiScores,
      suggestedStop: smartStop.suggestedStop,
      suggestedStopReason: smartStop.rationale,
      cachedAt: new Date().toISOString(),
    };

    // Cache for 4 hours (same policy as assess route)
    setCache(cacheKey, result, 4 * 60 * 60 * 1000);

    return NextResponse.json(result, {
      headers: {
        "X-AI-Provider": completion.provider,
        "X-AI-Model": completion.model,
      },
    });
  } catch (error) {
    console.error("AI compatibility error:", error);
    return aiErrorResponse(error);
  }
}
