import NewTradeClient from "@/components/trade/NewTradeClient";
import { loadSharedTradeStructureLibrary } from "@/lib/trading/structure-library";
import { ensureStrategyWorkspaceForMode } from "@/lib/trading/strategies";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProtectedAppContext } from "@/lib/supabase/protected-app";
import { getPortfolioHeat } from "@/lib/trading/scoring";
import Link from "next/link";
import type {
  Trade,
  TradeMode,
} from "@/types/trade";

export default async function NewTradePage() {
  const { userId, profile } = await getProtectedAppContext();
  const mode = (profile.mode as TradeMode) || null;

  if (!mode) {
    return (
      <main className="settings-terminal">
        <div className="page-header"><div>
          <p className="meta-label">New Trade</p>
          <h2>Execution workflow requires a lane configuration</h2>
          <p className="page-intro max-w-3xl">Choose a lane in the toolbar above to set the execution rules, sizing defaults, and strategy context for this trade workflow. Account-level analytics remain available without a lane.</p>
        </div></div>
        <div className="mt-6"><Link href="/portfolio-analytics" className="secondary-button">Open Portfolio Analytics</Link></div>
      </main>
    );
  }

  const supabase = await createServerSupabase();

  const [{ strategies, defaultStrategyId, schemaReady }, { data: activeTrades }, structureLibrary] = await Promise.all([
    ensureStrategyWorkspaceForMode(supabase, userId, mode),
    supabase
      .from("trades")
      .select("id, ticker, direction, confirmed, closed, risk_pct")
      .eq("user_id", userId)
      .eq("confirmed", true)
      .eq("closed", false),
    loadSharedTradeStructureLibrary(supabase, userId),
  ]);

  const activeStrategy = schemaReady ? (strategies.find((strategy) => strategy.id === defaultStrategyId) ?? strategies[0] ?? null) : null;
  const enabledMetrics = activeStrategy?.metrics.filter((metric) => metric.enabled) ?? [];
  if (!schemaReady || !activeStrategy || enabledMetrics.length === 0) {
    return (
      <main className="settings-terminal">
        <div className="page-header"><div>
          <p className="meta-label">New Trade</p>
          <h2>This workflow needs an active strategy</h2>
          <p className="page-intro max-w-3xl">Create or enable a strategy with at least one active check in Strategy Studio, then return here to build and validate a thesis against that configuration.</p>
        </div></div>
        <div className="mt-6"><Link href="/settings/metrics" className="primary-button">Open Strategy Studio</Link></div>
      </main>
    );
  }

  const tradesForHeat: Trade[] =
    activeTrades?.map((trade) => ({
      ...trade,
      risk_pct: Number(trade.risk_pct ?? 0),
    } as Trade)) ?? [];

  return (
    <NewTradeClient
      key={`${userId}-${mode}`}
      userId={userId}
      initialMode={mode}
      initialEquity={profile.equity}
      initialStrategies={strategies}
      initialStrategyId={activeStrategy.id}
      initialStructureLibrary={structureLibrary}
      initialHeat={getPortfolioHeat(tradesForHeat)}
    />
  );
}