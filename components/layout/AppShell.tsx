"use client";

import { Suspense, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import NavBar from "@/components/layout/NavBar";
import TradeDrawer, { type DrawerTrade } from "@/components/layout/TradeDrawer";
import ModeSelector from "@/components/layout/ModeSelector";
import { LearnModeProvider } from "@/components/learn/LearnModeContext";
import { createClient } from "@/lib/supabase/client";
import { buildStarterMetricSeed } from "@/lib/trading/user-metrics";
import type { TradeMode } from "@/types/trade";

type Profile = {
  id: string;
  mode: TradeMode | null;
  learnMode: boolean;
};

type AppShellProps = {
  children: React.ReactNode;
  profile: Profile;
};

export default function AppShell({ children, profile }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTrades, setDrawerTrades] = useState<DrawerTrade[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [modeModalOpen, setModeModalOpen] = useState(!profile.mode);
  const [activeMode, setActiveMode] = useState<TradeMode | null>(profile.mode);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    let isActive = true;
    setDrawerLoading(true);
    setDrawerError(null);

    async function loadTrades() {
      const { data, error } = await supabase
        .from("trades")
        .select("id, ticker, direction, source, confirmed, closed, created_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!isActive) {
        return;
      }

      if (error) {
        setDrawerError("Failed to load trade drawer.");
        setDrawerTrades([]);
      } else {
        setDrawerTrades(
          data?.map((trade) => ({
            id: trade.id,
            ticker: trade.ticker,
            direction: trade.direction,
            source: trade.source,
            confirmed: trade.confirmed,
            closed: trade.closed,
            created_at: trade.created_at,
          })) ?? [],
        );
      }

      setDrawerLoading(false);
    }

    void loadTrades();

    return () => {
      isActive = false;
    };
  }, [drawerOpen, profile.id, supabase]);

  const onSelectTrade = (tradeId: string) => {
    router.push(`/trade/${tradeId}`);
  };

  const onSelectMode = (mode: TradeMode) => {
    startTransition(async () => {
      const { error } = await supabase.from("profiles").update({ mode }).eq("id", profile.id);
      if (error) {
        return;
      }

      const { count } = await supabase
        .from("user_metrics")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("mode", mode);

      if ((count ?? 0) === 0) {
        await supabase.from("user_metrics").insert(buildStarterMetricSeed(profile.id, mode));
      }

      setActiveMode(mode);
      setModeModalOpen(false);
      router.refresh();
    });
  };

  return (
    <LearnModeProvider initialLearnMode={profile.learnMode}>
      <div className="app-stage min-h-screen px-4 pb-6 pt-4 text-tds-text sm:px-6 sm:pb-8 lg:px-6 lg:py-6">
        <Suspense fallback={null}>
          <NavBar
            mode={activeMode}
            currentPath={pathname}
            onDrawerToggle={() => setDrawerOpen((prev) => !prev)}
            onModeToggle={() => setModeModalOpen(true)}
          />
        </Suspense>

        <TradeDrawer
          open={drawerOpen}
          trades={drawerTrades}
          loading={drawerLoading}
          error={drawerError}
          onClose={() => setDrawerOpen(false)}
          onSelectTrade={onSelectTrade}
        />

        <ModeSelector
          open={modeModalOpen}
          hasExistingMode={Boolean(activeMode)}
          onCancel={() => {
            if (activeMode) {
              setModeModalOpen(false);
            }
          }}
          onSelectMode={onSelectMode}
        />

        {isPending ? (
          <div className="fixed left-4 top-28 z-[70] rounded-full border border-white/80 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-tds-dim shadow-[0_20px_40px_-24px_rgba(15,23,42,0.3)] md:left-[292px] md:top-6">
            Updating mode...
          </div>
        ) : null}

        <div className="w-full md:pl-[292px]">
          <div className="min-w-0 pt-[136px] md:pt-0">
            <div className="fin-shell min-h-[calc(100vh-2rem)] px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
              <div className="w-full max-w-none">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </LearnModeProvider>
  );
}
