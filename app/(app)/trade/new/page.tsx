import NewTradeClient from "@/components/trade/NewTradeClient";
import WorkspaceSetupPanel from "@/components/layout/WorkspaceSetupPanel";
import { loadSharedTradeStructureLibrary } from "@/lib/trading/structure-library";
import { ensureStrategyWorkspaceForMode } from "@/lib/trading/strategies";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProtectedAppContext } from "@/lib/supabase/protected-app";
import { getPortfolioHeat } from "@/lib/trading/scoring";
import type {
  Trade,
  TradeMode,
} from "@/types/trade";

export default async function NewTradePage() {
  const { userId, profile } = await getProtectedAppContext();
  if (!profile.mode) {
    return (
      <WorkspaceSetupPanel
        kicker="Mode Setup Required"
        title="Choose a trading mode before creating a thesis."
        description="The trade workflow is now explicitly mode-aware from the first step instead of defaulting to swing behind the scenes."
        hint="Use the mode selector in the shell to choose your operating lane. That choice seeds the starter metric stack used for thesis assessment and position management."
      />
    );
  }

  const supabase = await createServerSupabase();
  const mode = profile.mode as TradeMode;

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

  if (!schemaReady) {
    return (
      <WorkspaceSetupPanel
        kicker="Database Update Required"
        title="Apply the first-class strategies database migration before creating a new trade."
        description="New Trade now depends on saved strategy records and version snapshots, but those tables are missing from the connected Supabase schema."
        hint="Run the SQL in supabase/migrations/010_first_class_strategies.sql against the connected database, then reload the app. After that, the strategy-first thesis flow will work normally."
      />
    );
  }

  const activeStrategy = strategies.find((strategy) => strategy.id === defaultStrategyId) ?? strategies[0] ?? null;
  const enabledMetrics = activeStrategy?.metrics.filter((metric) => metric.enabled) ?? [];
  if (!activeStrategy || enabledMetrics.length === 0) {
    return (
      <WorkspaceSetupPanel
        kicker="Strategy Setup Required"
        title="Save at least one complete strategy before building a trade thesis."
        description="New Trade is now strategy-first. The thesis, assessment, and sizing flow only run against a named saved strategy with an enabled metric stack."
        hint="Open Strategy Metrics to create or clone a strategy, enable the checks you want, and set the strategy as the default lane for this mode."
        ctaHref="/settings/metrics"
        ctaLabel="Open Strategy Studio"
      />
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