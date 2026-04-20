import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { computeDisciplineScore, buildWeeklySummary, getCurrentWeekRange } from "@/lib/trading/discipline";
import type { TradeClassification, OverrideQuality } from "@/types/trade";

/* ---------- GET /api/discipline ----------
 * TRD v2 §10 — Discipline Engine
 * Returns current discipline score + weekly summary.
 * ----------------------------------------- */

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { start, end } = getCurrentWeekRange();

  // Fetch trades for current week
  const { data: trades } = await supabase
    .from("trades")
    .select("classification, state, entry_price, exit_price, direction")
    .eq("user_id", user.id)
    .gte("created_at", start)
    .lte("created_at", end)
    .not("state", "eq", "initiated");

  // Fetch overrides for current week
  const { data: overrides } = await supabase
    .from("overrides")
    .select("quality_flag")
    .eq("user_id", user.id)
    .gte("created_at", start)
    .lte("created_at", end);

  const safeTradesForScore = (trades ?? []).map((t) => ({
    classification: (t.classification ?? "in_policy") as TradeClassification,
    state: (t.state ?? "deployed") as string,
  }));

  const safeOverrides = (overrides ?? []).map((o) => ({
    quality_flag: (o.quality_flag ?? "valid") as OverrideQuality,
  }));

  const score = computeDisciplineScore({
    trades: safeTradesForScore,
    overrides: safeOverrides,
  });

  const safeTradesForSummary = (trades ?? []).map((t) => ({
    classification: (t.classification ?? "in_policy") as TradeClassification,
    state: (t.state ?? "deployed") as string,
    entry_price: t.entry_price as number | null,
    exit_price: t.exit_price as number | null,
    direction: (t.direction ?? "LONG") as "LONG" | "SHORT",
  }));

  const summary = buildWeeklySummary(safeTradesForSummary, safeOverrides, start, end);

  return NextResponse.json({ score, summary });
}
