import MetricsEditorClient from "@/components/settings/MetricsEditorClient";
import WorkspaceSetupPanel from "@/components/layout/WorkspaceSetupPanel";
import { loadSharedTradeStructureLibrary } from "@/lib/trading/structure-library";
import { ensureStrategyWorkspaceForMode } from "@/lib/trading/strategies";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProtectedAppContext } from "@/lib/supabase/protected-app";
import type { TradeMode } from "@/types/trade";

export default async function MetricsSettingsPage() {
  const { userId, profile } = await getProtectedAppContext();
  if (!profile.mode) {
    return (
      <WorkspaceSetupPanel
        kicker="Mode Setup Required"
        title="Choose a trading mode before editing strategy metrics."
        description="Metric stacks are now attached to an explicit operating mode. A mode must exist before this workspace can save or rate a strategy."
        hint="Use the mode selector in the shell to choose Investment, Swing, Day Trade, or Scalp. The app will seed a starter stack for that lane, which you can then customize here."
      />
    );
  }

  const supabase = await createServerSupabase();

  const mode = profile.mode as TradeMode;
  const equity = profile.equity;

  const [{ strategies, defaultStrategyId, schemaReady }, structureLibrary] = await Promise.all([
    ensureStrategyWorkspaceForMode(supabase, userId, mode),
    loadSharedTradeStructureLibrary(supabase, userId),
  ]);

  if (!schemaReady) {
    return (
      <WorkspaceSetupPanel
        kicker="Database Update Required"
        title="Apply the first-class strategies database migration before opening Strategy Studio."
        description="Strategy Studio stores named strategies and version snapshots in new Supabase tables, but those tables are not available in the connected database yet."
        hint="Run the SQL in supabase/migrations/010_first_class_strategies.sql against the connected database, then reload this page."
      />
    );
  }

  return (
    <MetricsEditorClient
      userId={userId}
      mode={mode}
      initialEquity={equity}
      initialStrategies={strategies}
      initialStrategyId={defaultStrategyId}
      initialStructureLibrary={structureLibrary}
    />
  );
}