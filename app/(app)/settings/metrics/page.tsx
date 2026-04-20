import Link from "next/link";
import MetricsEditorClient from "@/components/settings/MetricsEditorClient";
import { loadSharedTradeStructureLibrary } from "@/lib/trading/structure-library";
import { ensureStrategyWorkspaceForMode } from "@/lib/trading/strategies";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProtectedAppContext } from "@/lib/supabase/protected-app";
import type { TradeMode } from "@/types/trade";

export default async function MetricsSettingsPage() {
  const { userId, profile } = await getProtectedAppContext();
  const mode = (profile.mode as TradeMode) || null;

  if (!mode) {
    return (
      <main className="settings-terminal">
        <div className="page-header"><div>
          <p className="meta-label">Strategy Studio</p>
          <h2>Strategy configuration requires a lane context</h2>
          <p className="page-intro max-w-3xl">Choose a lane in the toolbar above to edit the rule set, structure defaults, and scoring behavior for that workflow. Account-wide analytics remain available without a lane.</p>
        </div></div>
        <div className="mt-6"><Link href="/portfolio-analytics" className="secondary-button">Open Portfolio Analytics</Link></div>
      </main>
    );
  }

  const supabase = await createServerSupabase();
  const equity = profile.equity;

  const [{ strategies, defaultStrategyId, schemaReady }, structureLibrary] = await Promise.all([
    ensureStrategyWorkspaceForMode(supabase, userId, mode),
    loadSharedTradeStructureLibrary(supabase, userId),
  ]);

  if (!schemaReady) {
    return (
      <main className="settings-terminal">
        <div className="page-header"><div>
          <p className="meta-label">Strategy Studio</p>
          <h2>Database migration required</h2>
          <p className="page-intro max-w-3xl">Run the SQL in supabase/migrations/010_first_class_strategies.sql against the connected database, then reload the app.</p>
        </div></div>
      </main>
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