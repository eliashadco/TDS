"use client";

import { Suspense, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import NavBar from "@/components/layout/NavBar";
import TradeDrawer, { type DrawerTrade } from "@/components/layout/TradeDrawer";
import ModeSelector from "@/components/layout/ModeSelector";
import FastExecPalette from "@/components/layout/FastExecPalette";
import { LearnModeProvider, useLearnMode } from "@/components/learn/LearnModeContext";
import { createClient } from "@/lib/supabase/client";
import { buildStarterMetricSeed } from "@/lib/trading/user-metrics";
import { cn } from "@/lib/utils";
import type { TradeMode } from "@/types/trade";
import { ShieldCheck, ChevronDown, Check } from "lucide-react";

type Profile = {
  id: string;
  mode: TradeMode | null;
  learnMode: boolean;
  equity: number;
};

type StrategyAnchor = {
  id: string;
  name: string;
  versionNumber: number | null;
};

type StrategyOption = {
  id: string;
  name: string;
  isDefault: boolean;
};

type AppShellProps = {
  children: React.ReactNode;
  profile: Profile;
  initialStrategyAnchor: StrategyAnchor | null;
};

const THEME_STORAGE_KEY = "balanced-guided-theme";

export default function AppShell({ children, profile, initialStrategyAnchor }: AppShellProps) {
  return (
    <LearnModeProvider initialLearnMode={profile.learnMode}>
      <AppShellInner profile={profile} initialStrategyAnchor={initialStrategyAnchor}>{children}</AppShellInner>
    </LearnModeProvider>
  );
}

function AppShellInner({ children, profile, initialStrategyAnchor }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const { learnMode } = useLearnMode();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTrades, setDrawerTrades] = useState<DrawerTrade[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [modeModalOpen, setModeModalOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<TradeMode | null>(profile.mode);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [strategyAnchor, setStrategyAnchor] = useState<StrategyAnchor | null>(initialStrategyAnchor);
  const [strategyAnchorLoading, setStrategyAnchorLoading] = useState(false);
  const [strategyOptions, setStrategyOptions] = useState<StrategyOption[]>([]);
  const [anchorDropdownOpen, setAnchorDropdownOpen] = useState(false);
  const [deployCelebration, setDeployCelebration] = useState(false);
  const [, setDisciplineScore] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [fastExecOpen, setFastExecOpen] = useState(false);

  const modePills: TradeMode[] = ["investment", "swing", "daytrade", "scalp"];

  useEffect(() => {
    setActiveMode(profile.mode);
  }, [profile.mode]);

  const modeLabel = (mode: TradeMode) => {
    if (mode === "daytrade") {
      return "Day Trade";
    }
    return mode.charAt(0).toUpperCase() + mode.slice(1);
  };

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "dark") {
      setTheme("dark");
    }
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    let timeoutId: number | null = null;

    const onTradeDeployed = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      setDeployCelebration(true);
      timeoutId = window.setTimeout(() => {
        setDeployCelebration(false);
        timeoutId = null;
      }, 420);
    };

    window.addEventListener("tds:trade-deployed", onTradeDeployed);

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener("tds:trade-deployed", onTradeDeployed);
    };
  }, []);

  // Ctrl+K opens fast execution palette
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setFastExecOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadStrategyAnchor() {
      if (!activeMode) {
        if (isActive) {
          setStrategyAnchor(null);
          setStrategyAnchorLoading(false);
        }
        return;
      }

      setStrategyAnchorLoading(true);

      const { data: strategyRows, error: strategyError } = await supabase
        .from("user_strategies")
        .select("id, name, active_version_id, is_default")
        .eq("user_id", profile.id)
        .eq("mode", activeMode)
        .neq("status", "archived")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });

      if (!isActive) {
        return;
      }

      if (strategyError || !strategyRows || strategyRows.length === 0) {
        setStrategyAnchor(null);
        setStrategyOptions([]);
        setStrategyAnchorLoading(false);
        return;
      }

      setStrategyOptions(
        strategyRows.map((s) => ({ id: s.id, name: s.name, isDefault: s.is_default ?? false })),
      );

      const activeStrategy = strategyRows[0];
      let versionNumber: number | null = null;

      if (activeStrategy.active_version_id) {
        const { data: versionRow } = await supabase
          .from("strategy_versions")
          .select("version_number")
          .eq("id", activeStrategy.active_version_id)
          .maybeSingle();

        if (!isActive) {
          return;
        }

        versionNumber = versionRow?.version_number ?? null;
      } else {
        const { data: versionRows } = await supabase
          .from("strategy_versions")
          .select("version_number")
          .eq("strategy_id", activeStrategy.id)
          .order("version_number", { ascending: false })
          .limit(1);

        if (!isActive) {
          return;
        }

        versionNumber = versionRows?.[0]?.version_number ?? null;
      }

      setStrategyAnchor({
        id: activeStrategy.id,
        name: activeStrategy.name,
        versionNumber,
      });
      setStrategyAnchorLoading(false);
    }

    void loadStrategyAnchor();

    const onStrategyAnchorRefresh = () => {
      void loadStrategyAnchor();
    };

    window.addEventListener("tds:strategy-anchor-refresh", onStrategyAnchorRefresh);

    return () => {
      isActive = false;
      window.removeEventListener("tds:strategy-anchor-refresh", onStrategyAnchorRefresh);
    };
  }, [activeMode, pathname, profile.id, supabase]);

  // Fetch discipline score (TRD v2 §10, §16.2 persistent UI)
  useEffect(() => {
    fetch("/api/discipline")
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.score === "number") setDisciplineScore(data.score);
      })
      .catch(() => {});

    function onTradeDeployed() {
      fetch("/api/discipline")
        .then((r) => r.json())
        .then((data) => {
          if (typeof data.score === "number") setDisciplineScore(data.score);
        })
        .catch(() => {});
    }

    window.addEventListener("tds:trade-deployed", onTradeDeployed);
    return () => window.removeEventListener("tds:trade-deployed", onTradeDeployed);
  }, []);

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

  /* ── Close anchor dropdown on outside click ── */
  useEffect(() => {
    if (!anchorDropdownOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".strategy-anchor-shell")) {
        setAnchorDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [anchorDropdownOpen]);

  const onSwitchStrategy = (strategyId: string) => {
    setAnchorDropdownOpen(false);
    startTransition(async () => {
      await supabase
        .from("user_strategies")
        .update({ is_default: false })
        .eq("user_id", profile.id)
        .eq("mode", activeMode!);

      await supabase
        .from("user_strategies")
        .update({ is_default: true })
        .eq("id", strategyId);

      window.dispatchEvent(new Event("tds:strategy-anchor-refresh"));
      router.refresh();
    });
  };

  const onSelectTrade = (tradeId: string) => {
    router.push(`/trade/${tradeId}`);
  };

  const onModeToggle = () => {
    setModeModalOpen(true);
  };

  const onThemeToggle = () => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  };

  const onSelectMode = (mode: TradeMode) => {
    startTransition(async () => {
      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: profile.id,
            mode,
          },
          { onConflict: "id" },
        )
        .select("mode")
        .single();

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
      <div className="app-stage min-h-screen px-4 pb-6 pt-4 text-tds-text sm:px-6 sm:pb-8 lg:px-6 lg:py-6">
        <Suspense fallback={null}>
          <NavBar
            mode={activeMode}
            currentPath={pathname}
            onDrawerToggle={() => setDrawerOpen((prev) => !prev)}
            onModeToggle={onModeToggle}
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

        <FastExecPalette
          userId={profile.id}
          open={fastExecOpen}
          onClose={() => setFastExecOpen(false)}
        />

        {isPending ? (
          <div className="fixed left-4 top-28 z-[70] rounded-full border border-[var(--v2-border)] bg-[var(--v2-surface)] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--v2-text)] shadow-lg md:left-[292px] md:top-6">
            Updating Configuration...
          </div>
        ) : null}

        <div className="workspace-main w-full md:pl-[292px]">
          <div className="workspace-frame min-w-0 pt-[136px] md:pt-0">
            <div className={cn("workspace-utility-bar utility-bar md:mt-0", deployCelebration && "utility-bar--success-flash")}>
              <div className="utility-status">
                <span className="meta-label">System Status</span>
                <span className="meta-pill success-pill">Live Feed</span>
              </div>

              <div className="utility-center">
                <div className="mr-6 hidden items-center gap-3 lg:flex">
                  <span className="meta-label">Strategy Anchor</span>
                  <div className="strategy-anchor-shell relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (strategyOptions.length > 1) {
                          setAnchorDropdownOpen((prev) => !prev);
                        }
                      }}
                      className={cn(
                        "strategy-anchor-pill flex h-9 max-w-[20rem] items-center gap-2 rounded-full border-2 px-4 py-1.5 transition-all",
                        strategyAnchor
                          ? "border-[var(--v2-accent)] bg-[var(--v2-surface)] shadow-[0_0_15px_rgba(180,83,9,0.1)]"
                          : "border-[var(--v2-border)] bg-[var(--v2-surface)] shadow-sm",
                        strategyOptions.length > 1 && "cursor-pointer hover:shadow-[0_0_20px_rgba(180,83,9,0.15)]",
                      )}
                    >
                      <ShieldCheck className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        strategyAnchor ? "text-[var(--v2-accent)]" : "text-[var(--v2-dim)]",
                      )} />
                      <span className="truncate font-mono text-[10px] font-bold tracking-widest text-[var(--v2-text)]">
                        {strategyAnchorLoading
                          ? "INITIALIZING..."
                          : strategyAnchor
                            ? `${strategyAnchor.name.toUpperCase()}${strategyAnchor.versionNumber ? ` v${strategyAnchor.versionNumber}` : ""}`
                            : activeMode
                              ? "NO ACTIVE STRATEGY"
                              : "CONFIGURE A LANE"}
                      </span>
                      {strategyOptions.length > 1 && !strategyAnchorLoading && (
                        <ChevronDown className={cn(
                          "h-3 w-3 shrink-0 text-[var(--v2-dim)] transition-transform",
                          anchorDropdownOpen && "rotate-180",
                        )} />
                      )}
                    </button>

                    {anchorDropdownOpen && strategyOptions.length > 1 && (
                      <div className="strategy-anchor-dropdown absolute left-0 top-full z-50 mt-2 min-w-[14rem] overflow-hidden rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)] p-1 shadow-xl">
                        <p className="px-3 pb-1 pt-2 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--v2-dim)]">
                          Switch strategy
                        </p>
                        {strategyOptions.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => onSwitchStrategy(opt.id)}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors",
                              strategyAnchor?.id === opt.id
                                ? "bg-[var(--v2-accent)]/10 font-semibold text-[var(--v2-accent)]"
                                : "text-[var(--v2-text)] hover:bg-[var(--v2-sub-surface)]",
                            )}
                          >
                            {strategyAnchor?.id === opt.id ? (
                              <Check className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <span className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span className="truncate">{opt.name}</span>
                            {opt.isDefault && (
                              <span className="ml-auto shrink-0 rounded-full bg-[var(--v2-accent)]/10 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider text-[var(--v2-accent)]">
                                Default
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <span className="meta-label">Configuration</span>
                <div className="terminal-lane-pills segment-control flex items-center gap-1 rounded-[14px] border border-slate-200/80 bg-slate-50/70 p-1">
                  {modePills.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        if (activeMode === mode) {
                          return;
                        }

                        if (learnMode) {
                          setModeModalOpen(true);
                          return;
                        }

                        onSelectMode(mode);
                      }}
                      className={`inline-flex h-8 items-center rounded-[10px] px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${activeMode === mode ? "bg-tds-slate text-white shadow-sm" : "text-tds-dim hover:bg-white"}`}
                    >
                      {modeLabel(mode)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="utility-meta utility-controls">
                <button
                  className="toggle-card theme-toggle-card"
                  type="button"
                  onClick={onThemeToggle}
                  aria-label="Toggle dark theme"
                >
                  <div>
                    <p className="meta-label">Theme</p>
                    <strong className="theme-toggle-label">{theme === "dark" ? "Dark" : "Light"}</strong>
                  </div>
                  <span className={`toggle-switch theme-toggle-switch ${theme === "dark" ? "active" : ""}`} aria-hidden="true" />
                </button>

                <div className="toggle-card">
                  <div>
                    <p className="meta-label">Learn Mode</p>
                    <strong>{learnMode ? "Enabled" : "Disabled"}</strong>
                  </div>
                  <span className={`toggle-switch ${learnMode ? "active" : ""}`} aria-hidden="true" />
                </div>

                <div className="equity-card">
                  <p className="meta-label">Equity</p>
                  <strong>${Math.round(profile.equity).toLocaleString("en-US")}</strong>
                </div>

                <span className="profile-chip">II</span>
              </div>
            </div>

            <div className="workspace-page-deck">{children}</div>
          </div>
        </div>
      </div>
  );
}
