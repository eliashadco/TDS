import { createServerSupabase } from "@/lib/supabase/server";
import { getProtectedAppContext } from "@/lib/supabase/protected-app";
import { getQuotes } from "@/lib/market/polygon";
import { ensureStrategyWorkspaceForMode } from "@/lib/trading/strategies";
import { buildDashboardSummary } from "@/lib/dashboard/summary";
import DashboardClient from "@/components/dashboard/DashboardClient";
import type { Metric, TradeMode } from "@/types/trade";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function toNullableNumber(value: unknown): number | null {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : null;
}

function buildReadyTradeView(row: {
  id: string;
  strategy_id: string | null;
  ticker: string;
  direction: "LONG" | "SHORT";
  note: string | null;
  flagged_at: string | null;
  scores: unknown;
  strategy_name: string | null;
  strategy_snapshot: unknown;
}) {
  const payload = asRecord(row.scores);
  const workbench = asRecord(payload.workbench);
  const strategySnapshot = asRecord(row.strategy_snapshot);

  const tickerRaw = typeof workbench.ticker === "string" ? workbench.ticker.trim().toUpperCase() : row.ticker?.trim().toUpperCase() ?? "";
  if (!tickerRaw) {
    return null;
  }

  return {
    id: row.id,
    strategyId: row.strategy_id,
    ticker: tickerRaw,
    direction: workbench.direction === "SHORT" || workbench.direction === "LONG" ? workbench.direction : row.direction,
    strategyLabel:
      typeof row.strategy_name === "string"
        ? row.strategy_name
        : typeof strategySnapshot.name === "string"
          ? strategySnapshot.name
          : typeof workbench.strategyLabel === "string"
            ? workbench.strategyLabel
            : "Saved strategy stack",
    strategyDetail:
      typeof strategySnapshot.description === "string"
        ? strategySnapshot.description
        : typeof workbench.strategyDetail === "string"
          ? workbench.strategyDetail
          : "Persisted from the MarketWatch workbench.",
    thesisSummary:
      typeof workbench.thesisSummary === "string"
        ? workbench.thesisSummary
        : typeof workbench.reason === "string"
          ? workbench.reason
          : row.note ?? "Saved workbench idea.",
    triggerLevel: toNullableNumber(workbench.triggerLevel),
    updatedAt: typeof workbench.updatedAt === "string" ? workbench.updatedAt : row.flagged_at,
    flaggedAt: row.flagged_at,
    note: typeof workbench.note === "string" ? workbench.note : row.note ?? "Saved workbench idea.",
  };
}

function readyTradeSort(left: { flaggedAt: string | null; updatedAt: string | null }, right: { flaggedAt: string | null; updatedAt: string | null }) {
  const leftTime = (left.flaggedAt ?? left.updatedAt) ? new Date(left.flaggedAt ?? left.updatedAt ?? "").getTime() : 0;
  const rightTime = (right.flaggedAt ?? right.updatedAt) ? new Date(right.flaggedAt ?? right.updatedAt ?? "").getTime() : 0;

  return rightTime - leftTime;
}

export default async function DashboardPage() {
  const { userId, profile } = await getProtectedAppContext();

  const supabase = await createServerSupabase();

  const mode = (profile.mode as TradeMode) || null;
  let activeStrategy: { id: string; name: string; description: string; versionNumber: number; metrics: Metric[] } | null = null;

  if (mode) {
    const { strategies, defaultStrategyId, schemaReady } = await ensureStrategyWorkspaceForMode(supabase, userId, mode);
    if (schemaReady) {
      const found = strategies.find((strategy) => strategy.id === defaultStrategyId) ?? strategies[0] ?? null;
      const enabledMetrics = found?.metrics.filter((metric) => metric.enabled) ?? [];
      if (found && enabledMetrics.length > 0) {
        activeStrategy = { ...found, metrics: enabledMetrics };
      }
    }
  }

  const [summary, { data: activeTrades }, { data: watchlistItems }] = await Promise.all([
    buildDashboardSummary(supabase, userId),
    supabase
      .from("trades")
      .select("id, ticker, direction, conviction, source, setup_types, entry_price, stop_loss, risk_pct, shares, tranche2_deadline, r2_target, market_price, thesis")
      .eq("user_id", userId)
      .eq("confirmed", true)
      .eq("closed", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("watchlist_items")
      .select("id, strategy_id, ticker, direction, mode, note, source, flagged_at, scores, strategy_name, strategy_snapshot")
      .eq("user_id", userId)
      .order("flagged_at", { ascending: false })
      .limit(16),
  ]);

  const activeTickers = Array.from(new Set((activeTrades ?? []).map((trade) => trade.ticker).filter(Boolean)));
  const liveQuotes = await getQuotes(activeTickers);

  const readyTrades =
    watchlistItems
      ?.flatMap((item) => {
        const readyTrade = buildReadyTradeView(item);
        return readyTrade ? [readyTrade] : [];
      })
      .sort(readyTradeSort)
      .slice(0, 12) ?? [];

  return (
    <DashboardClient
      summary={summary}
      profile={{
        equity: profile.equity,
        mode: mode,
      }}
      activeStrategy={activeStrategy ? {
        id: activeStrategy.id,
        name: activeStrategy.name,
        description: activeStrategy.description,
        versionNumber: activeStrategy.versionNumber,
        metrics: activeStrategy.metrics,
      } : null}
      activeTrades={
        activeTrades?.map((trade) => {
          const liveQuote = liveQuotes[trade.ticker];
          const currentPrice = Number(liveQuote?.price ?? trade.market_price ?? trade.entry_price ?? 0);
          const entryPrice = Number(trade.entry_price ?? 0);
          const shares = Number(trade.shares ?? 0);
          const livePnl = trade.direction === "LONG" ? (currentPrice - entryPrice) * shares : (entryPrice - currentPrice) * shares;
          const deployedCapital = entryPrice * shares;

          return {
            id: trade.id,
            ticker: trade.ticker,
            direction: trade.direction,
            conviction: trade.conviction,
            source: trade.source,
            setupTypes: trade.setup_types ?? [],
            shares,
            entryPrice,
            stopLoss: Number(trade.stop_loss ?? 0),
            currentPrice,
            quoteStatus: liveQuote?.dataStatus ?? null,
            quoteProvider: liveQuote?.provider ?? null,
            livePnl,
            livePnlPct: deployedCapital > 0 ? (livePnl / deployedCapital) * 100 : 0,
            riskPct: Number(trade.risk_pct ?? 0),
            trancheDeadline: trade.tranche2_deadline,
            r2Target: trade.r2_target,
            marketPrice: trade.market_price,
            thesis: trade.thesis ?? "",
          };
        }) ?? []
      }
      readyTrades={readyTrades}
    />
  );
}