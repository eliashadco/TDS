import AppShell from "@/components/layout/AppShell";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProtectedAppContext } from "@/lib/supabase/protected-app";
import { ensureStrategyWorkspaceForMode } from "@/lib/trading/strategies";
import type { TradeMode } from "@/types/trade";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, profile } = await getProtectedAppContext();

  let strategyAnchor: { id: string; name: string; versionNumber: number | null } | null = null;

  if (profile.mode) {
    const supabase = await createServerSupabase();
    const { strategies, defaultStrategyId, schemaReady } = await ensureStrategyWorkspaceForMode(supabase, userId, profile.mode as TradeMode);

    if (schemaReady) {
      const activeStrategy = strategies.find((strategy) => strategy.id === defaultStrategyId) ?? strategies[0] ?? null;
      if (activeStrategy) {
        strategyAnchor = {
          id: activeStrategy.id,
          name: activeStrategy.name,
          versionNumber: activeStrategy.versionNumber,
        };
      }
    }
  }

  return <AppShell profile={profile} initialStrategyAnchor={strategyAnchor}>{children}</AppShell>;
}