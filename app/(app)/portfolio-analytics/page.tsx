import type { ReactNode } from "react";
import Link from "next/link";
import WorkspaceSetupPanel from "@/components/layout/WorkspaceSetupPanel";
import PortfolioAnalyticsOverview from "@/components/analytics/PortfolioAnalyticsOverview";
import MarketWatchClient from "@/components/marketwatch/MarketWatchClient";
import { getQuotes } from "@/lib/market/polygon";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProtectedAppContext } from "@/lib/supabase/protected-app";
import { ensureStrategyWorkspaceForMode, parseStrategySnapshot } from "@/lib/trading/strategies";
import type { Trade, TradeMode } from "@/types/trade";

type PortfolioAnalyticsPageProps = {
  searchParams?: {
    tab?: string;
  };
};

export default async function PortfolioAnalyticsPage({ searchParams }: PortfolioAnalyticsPageProps) {
  const { userId, profile } = await getProtectedAppContext();
  if (!profile.mode) {
    return (
      <WorkspaceSetupPanel
        kicker="Mode Setup Required"
        title="Choose a trading mode before opening portfolio analytics."
        description="Analytics and MarketWatch are mode-aware surfaces. They now wait for an explicit operating lane instead of assuming swing as a hidden default."
        hint="Use the mode selector in the shell to pick your lane. After that, the app will unlock the matching starter stack and route analytics through the same saved metrics you actually trade with."
      />
    );
  }

  const supabase = await createServerSupabase();
  const activeTab = searchParams?.tab === "marketwatch" ? "marketwatch" : "overview";
  const mode = profile.mode as TradeMode;

  const { strategies, defaultStrategyId, schemaReady } = await ensureStrategyWorkspaceForMode(supabase, userId, mode);
  if (!schemaReady) {
    return (
      <WorkspaceSetupPanel
        kicker="Database Update Required"
        title="Apply the first-class strategies database migration before opening portfolio analytics."
        description="Portfolio Analytics and MarketWatch now read named saved strategies from the new strategy tables, but those tables are missing from the connected Supabase schema."
        hint="Run the SQL in supabase/migrations/010_first_class_strategies.sql against the connected database, then reload the app. This will restore the strategy workspace and stop the route from failing at render time."
      />
    );
  }

  const activeStrategy = strategies.find((strategy) => strategy.id === defaultStrategyId) ?? strategies[0] ?? null;
  const enabledMetrics = activeStrategy?.metrics.filter((metric) => metric.enabled) ?? [];

  if (!activeStrategy || enabledMetrics.length === 0) {
    return (
      <WorkspaceSetupPanel
        kicker="Strategy Setup Required"
        title="Save at least one complete strategy before using portfolio analytics."
        description="Portfolio review and MarketWatch now run through named saved strategies instead of an anonymous mode-level metric stack."
        hint="Open Strategy Metrics to create or clone a strategy, enable the checks you actually use, and mark one strategy as the default lane for this mode."
        ctaHref="/settings/metrics"
        ctaLabel="Open Strategy Studio"
      />
    );
  }

  function renderWorkspace(content: ReactNode) {
    return (
      <div className="space-y-8">
        <section className="fin-panel p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="fin-kicker">Portfolio Analytics</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-tds-text">Track performance, analytics, and strategy-qualified market flow in one workspace.</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-tds-dim">Analytics and MarketWatch now live under one parent workspace so review, qualification, and execution stay in the same lane.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/portfolio-analytics"
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${activeTab === "overview" ? "border-blue-200 bg-blue-50 text-tds-blue" : "border-white/80 bg-white text-tds-dim hover:bg-tds-wash"}`}
              >
                Overview
              </Link>
              <Link
                href="/portfolio-analytics?tab=marketwatch"
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${activeTab === "marketwatch" ? "border-blue-200 bg-blue-50 text-tds-blue" : "border-white/80 bg-white text-tds-dim hover:bg-tds-wash"}`}
              >
                MarketWatch
              </Link>
            </div>
          </div>
        </section>

        {content}
      </div>
    );
  }

  if (activeTab === "marketwatch") {
    return renderWorkspace(
      <MarketWatchClient
        userId={userId}
        mode={mode}
        equity={profile.equity}
        strategies={strategies}
        defaultStrategyId={activeStrategy.id}
      />,
    );
  }

  const [{ data: closedRows }, { data: activeRows }] = await Promise.all([
    supabase
      .from("trades")
      .select("id, ticker, direction, source, setup_types, strategy_name, strategy_snapshot, exit_t1, exit_t2, exit_t3, entry_price, stop_loss, exit_price, shares, closed_at")
      .eq("user_id", userId)
      .eq("closed", true)
      .order("closed_at", { ascending: true }),
    supabase
      .from("trades")
      .select("id, ticker, direction, source, conviction, setup_types, thesis, entry_price, risk_pct, shares, market_price, strategy_name, strategy_snapshot")
      .eq("user_id", userId)
      .eq("confirmed", true)
      .eq("closed", false)
      .order("created_at", { ascending: false }),
  ]);

  const liveQuotes = await getQuotes(Array.from(new Set((activeRows ?? []).map((trade) => trade.ticker).filter(Boolean))));

  const closedTrades: Trade[] =
    closedRows?.map((row) => ({
      id: row.id,
      ticker: row.ticker,
      direction: row.direction as "LONG" | "SHORT",
      source: row.source === "marketwatch" ? "marketwatch" : "thesis",
      setup_types: row.setup_types ?? [],
      strategy_name: row.strategy_name,
      strategy_snapshot: (row.strategy_snapshot as Record<string, unknown> | null) ?? null,
      exit_t1: row.exit_t1,
      exit_t2: row.exit_t2,
      exit_t3: row.exit_t3,
      entry_price: row.entry_price,
      stop_loss: row.stop_loss,
      exit_price: row.exit_price,
      shares: Number(row.shares ?? 0),
      closed_at: row.closed_at,
    } as Trade)) ?? [];

  return renderWorkspace(
    <PortfolioAnalyticsOverview
      mode={mode}
      activeStrategy={{
        name: activeStrategy.name,
        description: activeStrategy.description,
        versionNumber: activeStrategy.versionNumber,
        metricCount: enabledMetrics.length,
      }}
      closedTrades={closedTrades}
      activeTrades={
        activeRows?.map((trade) => {
          const storedSnapshot = parseStrategySnapshot(trade.strategy_snapshot, mode);
          const storedMetrics = storedSnapshot?.metrics.filter((metric) => metric.enabled).map((metric) => ({
            id: metric.id,
            name: metric.name,
            description: metric.description,
            category: metric.category,
            type: metric.type,
            enabled: metric.enabled,
          })) ?? [];
          const usesDefaultStrategyFallback = storedMetrics.length === 0;
          const strategyLabel = trade.strategy_name?.trim() || storedSnapshot?.name || activeStrategy.name;
          const strategyDescription = storedSnapshot?.description?.trim() || activeStrategy.description;
          const strategyVersionNumber = storedSnapshot?.versionNumber ?? activeStrategy.versionNumber;
          const strategySetupTypes = trade.setup_types && trade.setup_types.length > 0
            ? trade.setup_types
            : storedSnapshot?.structure.setupTypes?.length
              ? storedSnapshot.structure.setupTypes
              : activeStrategy.structure.setupTypes;
          const currentPrice = Number(liveQuotes[trade.ticker]?.price ?? trade.market_price ?? trade.entry_price ?? 0);
          const entryPrice = Number(trade.entry_price ?? 0);
          const shares = Number(trade.shares ?? 0);
          const livePnl = trade.direction === "LONG" ? (currentPrice - entryPrice) * shares : (entryPrice - currentPrice) * shares;
          const deployedCapital = entryPrice * shares;

          return {
            id: trade.id,
            ticker: trade.ticker,
            direction: trade.direction,
            source: trade.source === "marketwatch" ? "marketwatch" : "thesis",
            conviction: trade.conviction,
            setupTypes: strategySetupTypes,
            thesis: trade.thesis ?? "",
            entryPrice,
            currentPrice,
            quoteStatus: liveQuotes[trade.ticker]?.dataStatus ?? null,
            quoteProvider: liveQuotes[trade.ticker]?.provider ?? null,
            livePnl,
            livePnlPct: deployedCapital > 0 ? (livePnl / deployedCapital) * 100 : 0,
            riskPct: Number(trade.risk_pct ?? 0),
            strategyName: strategyLabel,
            strategyDescription,
            strategyVersionNumber,
            strategyMetrics: storedMetrics.length > 0 ? storedMetrics : enabledMetrics,
            usesDefaultStrategyFallback,
          };
        }) ?? []
      }
    />,
  );
}