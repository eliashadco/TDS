import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { computeHypotheticalPnl } from "@/lib/trading/discipline";
import type { TradeClassification } from "@/types/trade";

/* ---------- GET /api/trade/override-history ----------
 * TRD v2 §9.5 — Override Memory Injection
 * Returns past override outcomes so the UI can display them
 * before the user confirms a new override.
 * ---------------------------------------------------- */

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 10, 25);

  /* --- Fetch recent overrides with their trade outcomes --- */
  const { data: overrides, error } = await supabase
    .from("overrides")
    .select(`
      id,
      rules_broken,
      justification,
      quality_flag,
      created_at,
      trade_id
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch override history" }, { status: 500 });
  }

  if (!overrides || overrides.length === 0) {
    return NextResponse.json({ overrides: [], summary: null });
  }

  /* --- Enrich with trade outcomes --- */
  const tradeIds = overrides.map((o) => o.trade_id);
  const { data: trades } = await supabase
    .from("trades")
    .select("id, ticker, direction, entry_price, exit_price, closed, closed_reason")
    .in("id", tradeIds);

  const tradeMap = new Map(trades?.map((t) => [t.id, t]) ?? []);

  const enriched = overrides.map((o) => {
    const trade = tradeMap.get(o.trade_id);
    let pnlPct: number | null = null;

    if (trade?.entry_price && trade?.exit_price) {
      const rawPnl = trade.direction === "LONG"
        ? trade.exit_price - trade.entry_price
        : trade.entry_price - trade.exit_price;
      pnlPct = (rawPnl / trade.entry_price) * 100;
    }

    return {
      id: o.id,
      ticker: trade?.ticker ?? "?",
      direction: trade?.direction ?? "LONG",
      rulesBroken: o.rules_broken,
      qualityFlag: o.quality_flag,
      pnlPct,
      closed: trade?.closed ?? false,
      closedReason: trade?.closed_reason ?? null,
      createdAt: o.created_at,
    };
  });

  /* --- Summary stats --- */
  const closedOverrides = enriched.filter((o) => o.pnlPct !== null);
  const wins = closedOverrides.filter((o) => (o.pnlPct ?? 0) > 0).length;
  const losses = closedOverrides.filter((o) => (o.pnlPct ?? 0) <= 0).length;
  const avgPnl = closedOverrides.length > 0
    ? closedOverrides.reduce((sum, o) => sum + (o.pnlPct ?? 0), 0) / closedOverrides.length
    : null;

  /* --- Hypothetical P&L: actual vs without overrides (Accountability Mirror) --- */
  const { data: allClosedTrades } = await supabase
    .from("trades")
    .select("classification, state, entry_price, exit_price, direction")
    .eq("user_id", user.id)
    .eq("closed", true)
    .not("entry_price", "is", null)
    .not("exit_price", "is", null);

  const hypothetical = allClosedTrades && allClosedTrades.length > 0
    ? computeHypotheticalPnl(
        allClosedTrades.map((t) => ({
          classification: (t.classification ?? "in_policy") as TradeClassification,
          state: t.state ?? "closed",
          entry_price: t.entry_price,
          exit_price: t.exit_price,
          direction: t.direction as "LONG" | "SHORT",
        })),
      )
    : null;

  return NextResponse.json({
    overrides: enriched,
    summary: closedOverrides.length > 0
      ? { total: overrides.length, closedCount: closedOverrides.length, wins, losses, avgPnlPct: avgPnl }
      : null,
    hypothetical,
  });
}
