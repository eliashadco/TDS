"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronRight, ShieldAlert, Sparkles, Target, WalletCards } from "lucide-react";
import { Inter } from "next/font/google";
import { useRouter } from "next/navigation";
import PriceChart from "@/components/chart/PriceChart";
import { getCandleRange, getDefaultCandleTimeframe } from "@/lib/market/candle-range";
import { PREPARED_TRADE_PLAYBOOKS, type PreparedTradePlaybook } from "@/lib/trading/prepared-playbooks";
import { filterSetupsByDirection, type TradePresetOption } from "@/lib/trading/presets";
import { calculatePosition } from "@/lib/trading/scoring";
import { filterStructureLibraryItems, mergeTradePresetOptions } from "@/lib/trading/structure-library";
import { updateStrategySnapshotStructure } from "@/lib/trading/strategies";
import { validatePortfolioHeat } from "@/lib/trading/validation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";
import type { Candle, CandleTimeframe, Quote } from "@/types/market";
import type { TradeSetupCategory, TradeStructureLibraryItem } from "@/types/structure-library";
import type { SavedStrategy } from "@/types/strategy";
import type { ConvictionTier, Position, TradeMode } from "@/types/trade";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

type Direction = "LONG" | "SHORT";
type Screen = "IDENTITY" | "THESIS" | "SETUPS" | "SIZING" | "REVIEW";
type ChartTimeframe = "daily" | "4h" | "1h";
type StrategySourceTab = "saved" | "prepared";

type SizingDraft = {
  entryPrice: number | null;
  stopLoss: number | null;
};

type TradeDraft = {
  ticker: string;
  direction: Direction;
  thesis: string;
  explanation: string;
  invalidation: string;
  setupTypes: string[];
  sizing: SizingDraft;
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type TradeTerminalProps = {
  userId: string;
  initialMode: TradeMode;
  initialEquity: number;
  initialStrategies: SavedStrategy[];
  initialStrategyId: string;
  initialStructureLibrary: TradeStructureLibraryItem[];
  initialHeat: number;
};

const RECOMMENDED_CONVICTION: ConvictionTier = {
  tier: "STD",
  risk: 0.02,
  color: "#059669",
};

const SCREEN_FLOW: Screen[] = ["IDENTITY", "THESIS", "SETUPS", "SIZING", "REVIEW"];

const TERMINAL_SURFACE_CLASS = "trade-terminal-surface";
const TERMINAL_SOFT_SURFACE_CLASS = "trade-terminal-surface-soft";
const TERMINAL_MUTED_SURFACE_CLASS = "trade-terminal-surface-muted";
const TERMINAL_INPUT_CLASS = "trade-terminal-input";
const TERMINAL_RAIL_SURFACE_CLASS = "trade-terminal-rail-surface";
const TERMINAL_DIVIDER_CLASS = "trade-terminal-divider";
const TERMINAL_PROGRESS_TRACK_CLASS = "trade-terminal-progress-track";
const TERMINAL_CHOICE_CARD_CLASS = "trade-terminal-choice-card";
const TERMINAL_BADGE_CLASS = "trade-terminal-badge";
const TERMINAL_STAGE_CHIP_CLASS = "trade-terminal-stage-chip";
const TERMINAL_SHELL_CLASS = "trade-terminal-shell";

function toModeLabel(mode: TradeMode): string {
  return mode === "daytrade" ? "Day Trade" : mode.charAt(0).toUpperCase() + mode.slice(1);
}

function getCurrentScreenLabel(screen: Screen): string {
  if (screen === "IDENTITY") return "Identity";
  if (screen === "THESIS") return "Narrative";
  if (screen === "SETUPS") return "Setups";
  if (screen === "SIZING") return "Sizing";
  return "Review";
}

function buildStageLabels(): string[] {
  return ["Identity", "Narrative", "Setups", "Sizing", "Review"];
}

function getInitialChartTimeframe(mode: TradeMode): ChartTimeframe {
  const defaultTimeframe = getDefaultCandleTimeframe(mode);

  if (defaultTimeframe === "day") {
    return "daily";
  }

  return "1h";
}

function getChartTimeframeLabel(timeframe: ChartTimeframe): string {
  if (timeframe === "daily") return "Daily";
  if (timeframe === "4h") return "4H";
  return "1H";
}

function getChartFetchTimeframe(timeframe: ChartTimeframe): CandleTimeframe {
  return timeframe === "daily" ? "day" : "hour";
}

function aggregateCandlesByHours(candles: Candle[], hours: number): Candle[] {
  if (hours <= 1 || candles.length === 0) {
    return candles;
  }

  const bucketSeconds = hours * 60 * 60;
  const buckets = new Map<number, Candle[]>();

  for (const candle of candles) {
    const bucketTime = Math.floor(candle.time / bucketSeconds) * bucketSeconds;
    const existing = buckets.get(bucketTime);

    if (existing) {
      existing.push(candle);
      continue;
    }

    buckets.set(bucketTime, [candle]);
  }

  return Array.from(buckets.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([bucketTime, groupedCandles]) => {
      const firstCandle = groupedCandles[0];
      const lastCandle = groupedCandles[groupedCandles.length - 1];

      return {
        time: bucketTime,
        open: firstCandle.open,
        high: Math.max(...groupedCandles.map((candle) => candle.high)),
        low: Math.min(...groupedCandles.map((candle) => candle.low)),
        close: lastCandle.close,
        volume: groupedCandles.reduce((sum, candle) => sum + candle.volume, 0),
      };
    });
}

function getSetupCategory(option: TradePresetOption): TradeSetupCategory {
  return option.setupCategory ?? "technical";
}

function getSetupOptions(
  direction: Direction,
  structureLibrary: TradeStructureLibraryItem[],
  selectedLabels: string[],
): TradePresetOption[] {
  return mergeTradePresetOptions({
    baseOptions: filterSetupsByDirection(direction),
    sharedItems: filterStructureLibraryItems(structureLibrary, "setup_type"),
    itemType: "setup_type",
    selectedLabels,
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatSignedCurrency(value: number): string {
  return `${value >= 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`;
}

function isDirectionalStopValid(direction: Direction, entryPrice: number | null, stopLoss: number | null): boolean {
  if (entryPrice == null || stopLoss == null) {
    return false;
  }

  return direction === "LONG" ? stopLoss < entryPrice : stopLoss > entryPrice;
}

function buildJournalEntry(input: {
  ticker: string;
  direction: Direction;
  mode: TradeMode;
  strategyName: string;
  preparedStrategyName: string | null;
  setupTypes: string[];
  thesis: string;
  explanation: string;
  invalidation: string;
  position: Position;
  entryPrice: number;
  stopLoss: number;
  targetOne: number;
  targetTwo: number;
  conviction: ConvictionTier;
}) {
  const lines = [
    `Trade: ${input.ticker} ${input.direction}`,
    `Mode: ${toModeLabel(input.mode)}`,
    `Strategy: ${input.strategyName}`,
    `Prepared Playbook: ${input.preparedStrategyName ?? "None"}`,
    `Setup Types: ${input.setupTypes.length > 0 ? input.setupTypes.join(", ") : "None selected"}`,
    `Recommended conviction: ${input.conviction.tier} (${(input.conviction.risk * 100).toFixed(1)}% risk)`,
    `Entry: ${formatCurrency(input.entryPrice)}`,
    `Stop Loss: ${formatCurrency(input.stopLoss)}`,
    `TP1: ${formatCurrency(input.targetOne)}`,
    `TP2: ${formatCurrency(input.targetTwo)}`,
    `Position Size: ${input.position.shares} shares (${formatCurrency(input.position.value)})`,
    "",
    "Thesis:",
    input.thesis,
    "",
    "Execution Explanation:",
    input.explanation,
    "",
    "Invalidation:",
    input.invalidation,
  ];

  return lines.join("\n").trim();
}

export default function TradeTerminal(props: TradeTerminalProps) {
  const {
    userId,
    initialMode,
    initialEquity,
    initialStrategies,
    initialStrategyId,
    initialStructureLibrary,
    initialHeat,
  } = props;

  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [screen, setScreen] = useState<Screen>("IDENTITY");
  const [navDirection, setNavDirection] = useState<1 | -1>(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [candlesError, setCandlesError] = useState<string | null>(null);
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>(() => getInitialChartTimeframe(initialMode));
  const [selectedStrategyId, setSelectedStrategyId] = useState(initialStrategyId);
  const [selectedPreparedStrategyId, setSelectedPreparedStrategyId] = useState<string | null>(null);
  const [tradeDraft, setTradeDraft] = useState<TradeDraft>({
    ticker: "",
    direction: "LONG",
    thesis: "",
    explanation: "",
    invalidation: "",
    setupTypes: [],
    sizing: {
      entryPrice: null,
      stopLoss: null,
    },
  });

  const selectedStrategy = initialStrategies.find((strategy) => strategy.id === selectedStrategyId) ?? initialStrategies[0] ?? null;
  const selectedPreparedStrategy = PREPARED_TRADE_PLAYBOOKS.find((playbook) => playbook.id === selectedPreparedStrategyId) ?? null;
  const accentClass = tradeDraft.direction === "SHORT" ? "bg-rose-500" : "bg-emerald-500";
  const accentTextClass = tradeDraft.direction === "SHORT" ? "text-rose-600" : "text-emerald-600";
  const primaryButtonClass = tradeDraft.direction === "SHORT"
    ? "bg-rose-600 shadow-[0_18px_45px_rgba(244,63,94,0.24)] hover:bg-rose-500"
    : "bg-emerald-600 shadow-[0_18px_45px_rgba(16,185,129,0.24)] hover:bg-emerald-500";
  const setupOptions = useMemo(
    () => getSetupOptions(tradeDraft.direction, initialStructureLibrary, tradeDraft.setupTypes),
    [initialStructureLibrary, tradeDraft.direction, tradeDraft.setupTypes],
  );
  const setupOptionsByCategory = useMemo(
    () => ({
      fundamental: setupOptions.filter((option) => getSetupCategory(option) === "fundamental"),
      technical: setupOptions.filter((option) => getSetupCategory(option) === "technical"),
    }),
    [setupOptions],
  );
  const chartFetchTimeframe = useMemo(() => getChartFetchTimeframe(chartTimeframe), [chartTimeframe]);
  const chartCandles = useMemo(
    () => (chartTimeframe === "4h" ? aggregateCandlesByHours(candles, 4) : candles),
    [candles, chartTimeframe],
  );

  const totalStages = SCREEN_FLOW.length;
  const stageLabels = buildStageLabels();
  const stageIndex = SCREEN_FLOW.indexOf(screen) + 1;
  const progress = (stageIndex / totalStages) * 100;

  const tradeStrategySnapshot = selectedStrategy
    ? updateStrategySnapshotStructure(selectedStrategy.snapshot, {
        setupTypes: tradeDraft.setupTypes,
        conditions: selectedPreparedStrategy?.conditions ?? [],
        chartPattern: selectedPreparedStrategy?.chartPattern ?? "None",
        sizingNotes: selectedPreparedStrategy?.sizingNotes ?? selectedStrategy.structure.sizingNotes,
        invalidationStyle: tradeDraft.invalidation || selectedPreparedStrategy?.invalidationTemplate || selectedStrategy.structure.invalidationStyle,
      })
    : null;

  const recommendedPosition = useMemo(() => {
    if (tradeDraft.sizing.entryPrice == null || tradeDraft.sizing.stopLoss == null) {
      return null;
    }

    if (!isDirectionalStopValid(tradeDraft.direction, tradeDraft.sizing.entryPrice, tradeDraft.sizing.stopLoss)) {
      return null;
    }

    return calculatePosition(
      initialEquity,
      RECOMMENDED_CONVICTION,
      tradeDraft.sizing.entryPrice,
      tradeDraft.sizing.stopLoss,
      tradeDraft.direction,
    );
  }, [initialEquity, tradeDraft.direction, tradeDraft.sizing.entryPrice, tradeDraft.sizing.stopLoss]);

  const targetOne = recommendedPosition?.r2Target ?? null;
  const targetTwo = recommendedPosition?.r4Target ?? null;
  const targetOnePnl = recommendedPosition && tradeDraft.sizing.entryPrice != null && targetOne != null
    ? recommendedPosition.shares * Math.abs(targetOne - tradeDraft.sizing.entryPrice)
    : null;
  const targetTwoPnl = recommendedPosition && tradeDraft.sizing.entryPrice != null && targetTwo != null
    ? recommendedPosition.shares * Math.abs(targetTwo - tradeDraft.sizing.entryPrice)
    : null;

  const isNarrativeReady = tradeDraft.thesis.trim().length >= 20
    && tradeDraft.explanation.trim().length >= 20
    && tradeDraft.invalidation.trim().length >= 5;
  const areSetupsReady = tradeDraft.setupTypes.length >= 1;

  const canAdvance = (() => {
    if (screen === "IDENTITY") {
      return tradeDraft.ticker.trim().length >= 1;
    }

    if (screen === "THESIS") {
      return isNarrativeReady;
    }

    if (screen === "SETUPS") {
      return areSetupsReady;
    }

    if (screen === "SIZING") {
      return recommendedPosition !== null;
    }

    return isNarrativeReady && areSetupsReady && recommendedPosition !== null;
  })();

  const nextLabel = screen === "IDENTITY"
    ? "Continue"
    : screen === "THESIS"
      ? "Choose Setups"
      : screen === "SETUPS"
        ? "Sizing"
        : screen === "SIZING"
          ? "Review Trade"
          : "Submit Trade";

  useEffect(() => {
    async function loadQuote() {
      if (!tradeDraft.ticker.trim()) {
        setQuote(null);
        setQuoteError(null);
        return;
      }

      try {
        setQuoteError(null);
        const response = await fetch(`/api/market/quote?ticker=${encodeURIComponent(tradeDraft.ticker)}`, { cache: "no-store" });
        if (!response.ok) {
          setQuote(null);
          setQuoteError("Quote unavailable");
          return;
        }

        setQuote((await response.json()) as Quote);
      } catch {
        setQuote(null);
        setQuoteError("Quote unavailable");
      }
    }

    void loadQuote();
  }, [tradeDraft.ticker]);

  useEffect(() => {
    async function loadCandles() {
      if (!tradeDraft.ticker.trim()) {
        setCandles([]);
        setCandlesError(null);
        return;
      }

      const range = getCandleRange(initialMode, chartFetchTimeframe);
      const params = new URLSearchParams({
        ticker: tradeDraft.ticker,
        from: range.from,
        to: range.to,
        timeframe: range.timeframe,
      });

      try {
        setCandlesError(null);
        const response = await fetch(`/api/market/candles?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) {
          setCandles([]);
          setCandlesError("Chart unavailable");
          return;
        }

        const data = (await response.json()) as Candle[];
        setCandles(Array.isArray(data) ? data : []);
      } catch {
        setCandles([]);
        setCandlesError("Chart unavailable");
      }
    }

    void loadCandles();
  }, [chartFetchTimeframe, initialMode, tradeDraft.ticker]);

  useEffect(() => {
    if (quote?.price && tradeDraft.sizing.entryPrice == null) {
      setTradeDraft((previous) => ({
        ...previous,
        sizing: {
          ...previous.sizing,
          entryPrice: quote.price,
        },
      }));
    }
  }, [quote?.price, tradeDraft.sizing.entryPrice]);

  const updateDraft = <K extends keyof TradeDraft>(key: K, value: TradeDraft[K]) => {
    setTradeDraft((previous) => ({ ...previous, [key]: value }));
  };

  const handleDirectionChange = (value: Direction) => {
    setTradeDraft((previous) => {
      const allowedLabels = new Set(
        getSetupOptions(value, initialStructureLibrary, previous.setupTypes).map((option) => option.label),
      );

      return {
        ...previous,
        direction: value,
        setupTypes: previous.setupTypes.filter((label) => allowedLabels.has(label)),
      };
    });
  };

  const handleSetupToggle = (label: string) => {
    setTradeDraft((previous) => ({
      ...previous,
      setupTypes: previous.setupTypes.includes(label)
        ? previous.setupTypes.filter((value) => value !== label)
        : [...previous.setupTypes, label],
    }));
  };

  const handleStrategySelect = (strategyId: string) => {
    const strategy = initialStrategies.find((item) => item.id === strategyId);
    if (!strategy) {
      return;
    }

    setSelectedStrategyId(strategyId);
    setTradeDraft((previous) => ({
      ...previous,
      explanation: previous.explanation.trim().length > 0
        ? previous.explanation
        : [strategy.description, strategy.structure.sizingNotes].filter(Boolean).join(" "),
      invalidation: previous.invalidation.trim().length > 0
        ? previous.invalidation
        : strategy.structure.invalidationStyle,
      setupTypes: previous.setupTypes.length > 0 ? previous.setupTypes : strategy.structure.setupTypes,
    }));
  };

  const handlePreparedStrategyApply = (playbookId: string) => {
    const playbook = PREPARED_TRADE_PLAYBOOKS.find((item) => item.id === playbookId);
    if (!playbook) {
      return;
    }

    const allowedLabels = new Set(
      getSetupOptions(playbook.direction, initialStructureLibrary, playbook.setupTypes).map((option) => option.label),
    );

    setSelectedPreparedStrategyId(playbookId);
    setTradeDraft((previous) => ({
      ...previous,
      direction: playbook.direction,
      thesis: playbook.thesisTemplate,
      explanation: playbook.explanationTemplate,
      invalidation: playbook.invalidationTemplate,
      setupTypes: playbook.setupTypes.filter((label) => allowedLabels.has(label)),
    }));
  };

  const handlePreparedStrategyClear = () => {
    setSelectedPreparedStrategyId(null);
  };

  const handleNext = () => {
    setNavDirection(1);

    const currentIndex = SCREEN_FLOW.indexOf(screen);
    const nextScreen = SCREEN_FLOW[currentIndex + 1];
    if (nextScreen) {
      setScreen(nextScreen);
    }
  };

  const handleBack = () => {
    setNavDirection(-1);

    const currentIndex = SCREEN_FLOW.indexOf(screen);
    const previousScreen = SCREEN_FLOW[currentIndex - 1];
    if (previousScreen) {
      setScreen(previousScreen);
    }
  };

  const handleSaveTrade = async () => {
    if (!selectedStrategy || !tradeStrategySnapshot) {
      setSaveError("Missing strategy context for this trade.");
      return;
    }

    if (!recommendedPosition || tradeDraft.sizing.entryPrice == null || tradeDraft.sizing.stopLoss == null || targetOne == null || targetTwo == null) {
      setSaveError("Complete identity and sizing before submitting the trade.");
      return;
    }

    if (!isNarrativeReady) {
      setSaveError("Complete thesis, explanation, and invalidation before submitting the trade.");
      return;
    }

    if (!areSetupsReady) {
      setSaveError("Select at least one setup type before submitting the trade.");
      return;
    }

    const heatCheck = validatePortfolioHeat(initialHeat / 100, RECOMMENDED_CONVICTION.risk);
    if (!heatCheck.allowed) {
      setSaveError(heatCheck.reason);
      return;
    }

    setSaveError(null);
    setSaving(true);

    try {
      const trancheDeadline = new Date();
      trancheDeadline.setDate(trancheDeadline.getDate() + 7);

      const journalEntry = buildJournalEntry({
        ticker: tradeDraft.ticker,
        direction: tradeDraft.direction,
        mode: initialMode,
        strategyName: selectedStrategy.name,
        preparedStrategyName: selectedPreparedStrategy?.name ?? null,
        setupTypes: tradeDraft.setupTypes,
        thesis: tradeDraft.thesis,
        explanation: tradeDraft.explanation,
        invalidation: tradeDraft.invalidation,
        position: recommendedPosition,
        entryPrice: tradeDraft.sizing.entryPrice,
        stopLoss: tradeDraft.sizing.stopLoss,
        targetOne,
        targetTwo,
        conviction: RECOMMENDED_CONVICTION,
      });

      const payload: Database["public"]["Tables"]["trades"]["Insert"] = {
        user_id: userId,
        strategy_id: selectedStrategy.id,
        strategy_version_id: selectedStrategy.activeVersionId,
        strategy_name: selectedStrategy.name,
        strategy_snapshot: tradeStrategySnapshot as unknown as Database["public"]["Tables"]["trades"]["Insert"]["strategy_snapshot"],
        ticker: tradeDraft.ticker,
        direction: tradeDraft.direction,
        asset_class: "Equity",
        mode: initialMode,
        setup_types: tradeDraft.setupTypes,
        conditions: selectedPreparedStrategy?.conditions ?? [],
        chart_pattern: selectedPreparedStrategy?.chartPattern ?? "None",
        thesis: tradeDraft.thesis,
        catalyst_window: null,
        invalidation: tradeDraft.invalidation,
        scores: {},
        notes: {
          explanation: tradeDraft.explanation,
          strategy: selectedStrategy.name,
          preparedStrategy: selectedPreparedStrategy
            ? {
                id: selectedPreparedStrategy.id,
                name: selectedPreparedStrategy.name,
                horizon: selectedPreparedStrategy.horizon,
              }
            : null,
          setupTypes: tradeDraft.setupTypes,
        },
        f_score: 0,
        t_score: 0,
        f_total: 0,
        t_total: 0,
        conviction: RECOMMENDED_CONVICTION.tier,
        risk_pct: RECOMMENDED_CONVICTION.risk,
        entry_price: tradeDraft.sizing.entryPrice,
        stop_loss: tradeDraft.sizing.stopLoss,
        shares: recommendedPosition.shares,
        tranche1_shares: recommendedPosition.tranche1,
        tranche2_shares: recommendedPosition.tranche2,
        tranche2_filled: false,
        tranche2_deadline: trancheDeadline.toISOString(),
        exit_t1: false,
        exit_t2: false,
        exit_t3: false,
        r2_target: targetOne,
        r4_target: targetTwo,
        market_price: quote?.price ?? null,
        source: "thesis",
        state: "deployed",
        classification: "in_policy",
        confirmed: true,
        closed: false,
        insight: null,
        journal_entry: journalEntry,
        journal_exit: "",
        journal_post: "",
      };

      const { error } = await supabase.from("trades").insert(payload);
      if (error) {
        throw error;
      }

      window.dispatchEvent(new Event("tds:trade-deployed"));
      setToast({ type: "success", message: "Trade submitted successfully." });
      router.push("/dashboard");
    } catch {
      setSaveError("Failed to submit trade. Please retry.");
      setToast({ type: "error", message: "Trade submit failed." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className={cn(inter.className, "trade-terminal-root min-h-screen px-4 py-8")}>
      <div className="trade-terminal mx-auto max-w-[1440px]">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1.05fr)_390px]">
          <div className={cn(TERMINAL_SHELL_CLASS, "relative overflow-hidden rounded-[32px] border border-slate-200/60 bg-white/80 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-[#111827]/75")}>
            <div
              className={cn(
                "pointer-events-none absolute inset-x-0 top-0 h-40 blur-3xl",
                tradeDraft.direction === "SHORT" ? "bg-rose-500/10" : "bg-emerald-500/10",
              )}
            />

            {toast ? (
              <div
                className={cn(
                  "border-b px-6 py-3 text-sm lg:px-10",
                  toast.type === "success"
                    ? "border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                    : "border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300",
                )}
              >
                {toast.message}
              </div>
            ) : null}

            <div className={cn(TERMINAL_DIVIDER_CLASS, "border-b border-slate-200/70 px-6 py-5 dark:border-white/10 lg:px-10")}>
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">New Trade</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <span>{toModeLabel(initialMode)}</span>
                    {selectedStrategy ? <span className={cn(TERMINAL_BADGE_CLASS, "rounded-full border border-slate-200/80 px-2 py-1 text-xs text-slate-600 dark:border-white/10 dark:text-slate-300")}>{selectedStrategy.name}</span> : null}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-400">{getCurrentScreenLabel(screen)}</p>
                  <p className="mt-2 font-mono text-xs text-slate-400">Stage {stageIndex} / {totalStages}</p>
                </div>
              </div>

              <div className={cn(TERMINAL_PROGRESS_TRACK_CLASS, "h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800")}>
                <motion.div
                  className={cn("h-full rounded-full", accentClass)}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {stageLabels.map((label, index) => {
                  const isPast = index + 1 < stageIndex;
                  const isCurrent = index + 1 === stageIndex;

                  return (
                    <span
                      key={`${label}-${index}`}
                      className={cn(
                        "rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em]",
                        isCurrent
                          ? tradeDraft.direction === "SHORT"
                            ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                          : isPast
                            ? `${TERMINAL_STAGE_CHIP_CLASS} is-past border-slate-200 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/10 dark:text-slate-300`
                            : `${TERMINAL_STAGE_CHIP_CLASS} is-idle border-slate-200 bg-white/70 text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-500`,
                      )}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-8 lg:px-10 lg:py-10">
              <div className="mx-auto max-w-3xl">
                <AnimatePresence custom={navDirection} mode="wait">
                  <motion.div
                    key={screen}
                    custom={navDirection}
                    initial={{ opacity: 0, x: navDirection === 1 ? 28 : -28 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: navDirection === 1 ? -28 : 28 }}
                    transition={{ duration: 0.24, ease: "easeOut" }}
                  >
                    {screen === "IDENTITY" ? (
                      <IdentityStep
                        ticker={tradeDraft.ticker}
                        direction={tradeDraft.direction}
                        quote={quote}
                        quoteError={quoteError}
                        candles={chartCandles}
                        candlesError={candlesError}
                        chartTimeframe={chartTimeframe}
                        priceChartTimeframe={chartFetchTimeframe}
                        onTickerChange={(value) => updateDraft("ticker", value)}
                        onDirectionChange={handleDirectionChange}
                        onChartTimeframeChange={setChartTimeframe}
                      />
                    ) : null}

                    {screen === "THESIS" ? (
                      <NarrativeStep
                        mode={initialMode}
                        ticker={tradeDraft.ticker}
                        direction={tradeDraft.direction}
                        thesis={tradeDraft.thesis}
                        explanation={tradeDraft.explanation}
                        invalidation={tradeDraft.invalidation}
                        strategies={initialStrategies}
                        selectedStrategyId={selectedStrategyId}
                        selectedPreparedStrategyId={selectedPreparedStrategyId}
                        preparedStrategies={PREPARED_TRADE_PLAYBOOKS}
                        onThesisChange={(value) => updateDraft("thesis", value)}
                        onExplanationChange={(value) => updateDraft("explanation", value)}
                        onInvalidationChange={(value) => updateDraft("invalidation", value)}
                        onStrategySelect={handleStrategySelect}
                        onPreparedStrategyApply={handlePreparedStrategyApply}
                        onPreparedStrategyClear={handlePreparedStrategyClear}
                      />
                    ) : null}

                    {screen === "SETUPS" ? (
                      <SetupSelectionStep
                        direction={tradeDraft.direction}
                        selectedStrategyName={selectedStrategy?.name ?? null}
                        preparedStrategyName={selectedPreparedStrategy?.name ?? null}
                        selectedSetupTypes={tradeDraft.setupTypes}
                        fundamentalOptions={setupOptionsByCategory.fundamental}
                        technicalOptions={setupOptionsByCategory.technical}
                        onToggle={handleSetupToggle}
                      />
                    ) : null}

                    {screen === "SIZING" ? (
                      <SizingStep
                        draft={tradeDraft.sizing}
                        onChange={(sizing) => updateDraft("sizing", sizing)}
                        position={recommendedPosition}
                        conviction={RECOMMENDED_CONVICTION}
                        quote={quote}
                        direction={tradeDraft.direction}
                        targetOne={targetOne}
                        targetTwo={targetTwo}
                        targetOnePnl={targetOnePnl}
                        targetTwoPnl={targetTwoPnl}
                        initialEquity={initialEquity}
                      />
                    ) : null}

                    {screen === "REVIEW" ? (
                      <ReviewStep
                        draft={tradeDraft}
                        initialEquity={initialEquity}
                        initialHeat={initialHeat}
                        mode={initialMode}
                        strategyName={selectedStrategy?.name ?? null}
                        preparedStrategyName={selectedPreparedStrategy?.name ?? null}
                        accentTextClass={accentTextClass}
                        saveError={saveError}
                        quote={quote}
                        candles={chartCandles}
                        candlesError={candlesError}
                        chartTimeframe={chartTimeframe}
                        priceChartTimeframe={chartFetchTimeframe}
                        position={recommendedPosition}
                        conviction={RECOMMENDED_CONVICTION}
                        targetOne={targetOne}
                        targetTwo={targetTwo}
                        targetOnePnl={targetOnePnl}
                        targetTwoPnl={targetTwoPnl}
                        onChartTimeframeChange={setChartTimeframe}
                      />
                    ) : null}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className={cn(TERMINAL_DIVIDER_CLASS, "flex items-center justify-between border-t border-slate-200/70 px-6 py-5 dark:border-white/10 lg:px-10")}>
              <button
                type="button"
                onClick={handleBack}
                disabled={screen === "IDENTITY"}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              {screen !== "REVIEW" ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canAdvance}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35",
                    primaryButtonClass,
                  )}
                >
                  {nextLabel}
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSaveTrade()}
                  disabled={saving || !canAdvance}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35",
                    primaryButtonClass,
                  )}
                >
                  {saving ? "Submitting..." : "Submit Trade"}
                </button>
              )}
            </div>
          </div>

          <DesktopRail
            mode={initialMode}
            strategyName={selectedStrategy?.name ?? null}
            preparedStrategyName={selectedPreparedStrategy?.name ?? null}
            stageLabels={stageLabels}
            stageIndex={stageIndex}
            ticker={tradeDraft.ticker}
            direction={tradeDraft.direction}
            quote={quote}
            quoteError={quoteError}
            candles={chartCandles}
            candlesError={candlesError}
            chartTimeframe={chartTimeframe}
            priceChartTimeframe={chartFetchTimeframe}
            conviction={RECOMMENDED_CONVICTION}
            initialHeat={initialHeat}
            position={recommendedPosition}
            targetOne={targetOne}
            targetTwo={targetTwo}
            explanation={tradeDraft.explanation}
            invalidation={tradeDraft.invalidation}
            setupTypes={tradeDraft.setupTypes}
            onChartTimeframeChange={setChartTimeframe}
          />
        </div>
      </div>
    </main>
  );
}

function IdentityStep({
  ticker,
  direction,
  quote,
  quoteError,
  candles,
  candlesError,
  chartTimeframe,
  priceChartTimeframe,
  onTickerChange,
  onDirectionChange,
  onChartTimeframeChange,
}: {
  ticker: string;
  direction: Direction;
  quote: Quote | null;
  quoteError: string | null;
  candles: Candle[];
  candlesError: string | null;
  chartTimeframe: ChartTimeframe;
  priceChartTimeframe: CandleTimeframe;
  onTickerChange: (value: string) => void;
  onDirectionChange: (value: Direction) => void;
  onChartTimeframeChange: (value: ChartTimeframe) => void;
}) {
  const identitySummary = ticker ? `${ticker} • ${direction === "LONG" ? "Long bias" : "Short bias"}` : null;
  const quoteTone = quote && quote.change >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300";

  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center lg:text-left">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Trade Identity</p>
        <h1 className="font-[var(--font-manrope)] text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">What are you trading?</h1>
        <p className="text-sm text-slate-500">Enter the ticker and confirm the bias. The chart stays inline here, with Daily, 4H, and 1H views available before you continue.</p>
      </header>

      <div className="space-y-6">
        <section className={cn(TERMINAL_SURFACE_CLASS, "trade-ticker-slot relative overflow-hidden rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-white/5")}> 
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.42),transparent_38%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_38%)]" />
          <div className="relative space-y-4">
            <div className="space-y-2">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Ticker Slot</p>
              <p className="text-sm text-slate-500">Type the symbol here first so the rest of the window can anchor to the right market context.</p>
            </div>
            <label className="trade-ticker-input-shell relative block overflow-hidden rounded-[24px] border-2 border-dashed border-slate-300/90 bg-white/70 px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition focus-within:border-slate-500 focus-within:bg-white dark:border-white/15 dark:bg-white/5 dark:focus-within:border-white/35">
              {!ticker ? (
                <span className="trade-ticker-prompt pointer-events-none absolute inset-x-5 top-1/2 -translate-y-1/2 text-center font-mono text-sm uppercase tracking-[0.32em] text-slate-400/90 dark:text-slate-500 lg:text-left">
                  Choose you ticker
                </span>
              ) : null}
              <input
                autoFocus
                aria-label="Choose you ticker"
                inputMode="text"
                maxLength={6}
                value={ticker}
                onChange={(event) => onTickerChange(event.target.value.toUpperCase().replace(/[^A-Z.]/g, ""))}
                placeholder=""
                className="relative z-10 w-full bg-transparent text-center font-[var(--font-manrope)] text-5xl font-bold tracking-[0.08em] text-slate-950 outline-none dark:text-white lg:text-left"
              />
            </label>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onDirectionChange("LONG")}
            className={cn(
              "rounded-[24px] border p-5 text-left transition duration-200 active:scale-[0.99]",
              direction === "LONG"
                ? "border-emerald-500 bg-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,0.25),0_20px_40px_rgba(16,185,129,0.12)] dark:bg-emerald-500/10"
                : `${TERMINAL_CHOICE_CARD_CLASS} border-slate-200 bg-white hover:border-emerald-200 dark:border-white/10 dark:bg-white/5`,
            )}
          >
            <span className="mb-2 block font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Buy</span>
            <span className="text-2xl font-semibold text-slate-950 dark:text-white">Long</span>
          </button>

          <button
            type="button"
            onClick={() => onDirectionChange("SHORT")}
            className={cn(
              "rounded-[24px] border p-5 text-left transition duration-200 active:scale-[0.99]",
              direction === "SHORT"
                ? "border-rose-500 bg-rose-50 shadow-[0_0_0_1px_rgba(244,63,94,0.25),0_20px_40px_rgba(244,63,94,0.12)] dark:bg-rose-500/10"
                : `${TERMINAL_CHOICE_CARD_CLASS} border-slate-200 bg-white hover:border-rose-200 dark:border-white/10 dark:bg-white/5`,
            )}
          >
            <span className="mb-2 block font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Sell</span>
            <span className="text-2xl font-semibold text-slate-950 dark:text-white">Short</span>
          </button>
        </div>

        {identitySummary ? (
          <div className="flex justify-center lg:justify-start">
            <span className={cn(
              "rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em]",
              direction === "SHORT"
                ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
            )}>
              {identitySummary}
            </span>
          </div>
        ) : null}

        {ticker ? (
          <div className={cn(TERMINAL_SURFACE_CLASS, "space-y-4 rounded-[24px] border border-slate-200 bg-white/85 p-4 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-white/5")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">Live market context</p>
                {quote ? (
                  <div className="mt-2 flex items-baseline gap-3">
                    <span className="font-[var(--font-manrope)] text-3xl font-semibold text-slate-950 dark:text-white">{formatCurrency(quote.price)}</span>
                    <span className={cn("font-mono text-sm", quoteTone)}>
                      {quote.change >= 0 ? "+" : ""}{quote.change.toFixed(2)} ({quote.changePct.toFixed(2)}%)
                    </span>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">{quoteError ?? "Fetching live quote..."}</p>
                )}
              </div>

              <div className="text-right">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">Timeframe</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{getChartTimeframeLabel(chartTimeframe)}</p>
              </div>
            </div>

            <ChartTimeframeTabs value={chartTimeframe} onChange={onChartTimeframeChange} />

            {candles.length > 0 ? (
              <PriceChart candles={candles} direction={direction} timeframe={priceChartTimeframe} height={220} />
            ) : (
              <div className="flex h-36 items-center justify-center rounded-[20px] border border-dashed border-slate-200 text-sm text-slate-400 dark:border-white/10 dark:text-slate-500">
                {candlesError ?? quoteError ?? "Chart will appear when market data is available."}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function NarrativeStep({
  mode,
  ticker,
  direction,
  thesis,
  explanation,
  invalidation,
  strategies,
  selectedStrategyId,
  selectedPreparedStrategyId,
  preparedStrategies,
  onThesisChange,
  onExplanationChange,
  onInvalidationChange,
  onStrategySelect,
  onPreparedStrategyApply,
  onPreparedStrategyClear,
}: {
  mode: TradeMode;
  ticker: string;
  direction: Direction;
  thesis: string;
  explanation: string;
  invalidation: string;
  strategies: SavedStrategy[];
  selectedStrategyId: string;
  selectedPreparedStrategyId: string | null;
  preparedStrategies: PreparedTradePlaybook[];
  onThesisChange: (value: string) => void;
  onExplanationChange: (value: string) => void;
  onInvalidationChange: (value: string) => void;
  onStrategySelect: (strategyId: string) => void;
  onPreparedStrategyApply: (playbookId: string) => void;
  onPreparedStrategyClear: () => void;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const characterCount = thesis.trim().length;

  const generateAiInsight = async () => {
    setIsGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const generated = `AI insight: ${ticker} is showing a ${direction === "SHORT" ? "bearish" : "bullish"} opportunity based on current structure, momentum alignment, and a clearly defined risk boundary. The edge comes from waiting for confirmation near a key decision zone rather than chasing extension.`;
    onThesisChange(thesis.trim().length > 0 ? `${thesis.trim()}\n\n${generated}` : generated);
    setIsGenerating(false);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Narrative</p>
        <h2 className="font-[var(--font-manrope)] text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Write the trade story</h2>
        <p className="text-sm text-slate-500">The narrative stage carries the qualitative context first. Setup selection comes immediately after this, without restoring the old per-setup explanation windows.</p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className={cn(TERMINAL_SURFACE_CLASS, "rounded-[24px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5")}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className={cn(
              "font-mono text-[11px] uppercase tracking-[0.18em]",
              characterCount >= 20 ? "text-emerald-600 dark:text-emerald-300" : "text-slate-400",
            )}>
              {characterCount} chars
            </span>

            <button
              type="button"
              onClick={generateAiInsight}
              disabled={isGenerating || !ticker}
              className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50 dark:bg-sky-500/10 dark:text-sky-300"
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? "Generating..." : "Generate AI Insight"}
            </button>
          </div>

          <textarea
            value={thesis}
            onChange={(event) => onThesisChange(event.target.value)}
            placeholder="What is your edge here? What are you seeing, why now, and what context justifies the trade?"
            className={cn(TERMINAL_INPUT_CLASS, "min-h-[260px] w-full resize-none rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-base leading-7 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5")}
          />
        </section>

        <div className="grid gap-4">
          <section className={cn(TERMINAL_SURFACE_CLASS, "rounded-[24px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5")}>
            <div className="mb-3">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Explanation</p>
              <p className="mt-2 text-sm text-slate-500">Explain how you want to execute the idea and why this strategy is the right one.</p>
            </div>
            <textarea
              value={explanation}
              onChange={(event) => onExplanationChange(event.target.value)}
              placeholder="Describe the execution plan, the adopted strategy, and how the trade should behave if the idea is correct."
              className={cn(TERMINAL_INPUT_CLASS, "min-h-[160px] w-full resize-none rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm leading-7 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5")}
            />
          </section>

          <section className={cn(TERMINAL_SURFACE_CLASS, "rounded-[24px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5")}>
            <div className="mb-3">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Invalidation</p>
              <p className="mt-2 text-sm text-slate-500">Define the line that breaks the idea.</p>
            </div>
            <textarea
              value={invalidation}
              onChange={(event) => onInvalidationChange(event.target.value)}
              placeholder="What specifically invalidates this trade? Price action, level loss, catalyst failure, or structural change."
              className={cn(TERMINAL_INPUT_CLASS, "min-h-[140px] w-full resize-none rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm leading-7 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5")}
            />
          </section>
        </div>
      </div>

      <StrategyContextSection
        mode={mode}
        strategies={strategies}
        selectedStrategyId={selectedStrategyId}
        selectedPreparedStrategyId={selectedPreparedStrategyId}
        preparedStrategies={preparedStrategies}
        onStrategySelect={onStrategySelect}
        onPreparedStrategyApply={onPreparedStrategyApply}
        onPreparedStrategyClear={onPreparedStrategyClear}
      />
    </div>
  );
}

function StrategyContextSection({
  mode,
  strategies,
  selectedStrategyId,
  selectedPreparedStrategyId,
  preparedStrategies,
  onStrategySelect,
  onPreparedStrategyApply,
  onPreparedStrategyClear,
}: {
  mode: TradeMode;
  strategies: SavedStrategy[];
  selectedStrategyId: string;
  selectedPreparedStrategyId: string | null;
  preparedStrategies: PreparedTradePlaybook[];
  onStrategySelect: (strategyId: string) => void;
  onPreparedStrategyApply: (playbookId: string) => void;
  onPreparedStrategyClear: () => void;
}) {
  const [strategyTab, setStrategyTab] = useState<StrategySourceTab>("saved");
  const selectedPreparedStrategy = preparedStrategies.find((playbook) => playbook.id === selectedPreparedStrategyId) ?? null;
  const preparedStrategySections = {
    daytrade: preparedStrategies.filter((playbook) => playbook.horizon === "daytrade"),
    investment: preparedStrategies.filter((playbook) => playbook.horizon === "investment"),
  };

  return (
    <section className={cn(TERMINAL_SURFACE_CLASS, "space-y-5 rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-white/5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Strategy Context</p>
          <h2 className="font-[var(--font-manrope)] text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Pick the repeatable plan first</h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-500">
            After the story is drafted, lock the operating plan here. Use a saved strategy or open the prepared playbooks tab to load a ready-made bullish or bearish draft without giving up screen space.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em]">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            Active lane {toModeLabel(mode)}
          </span>
          {selectedPreparedStrategy ? (
            <button
              type="button"
              onClick={onPreparedStrategyClear}
              className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sky-700 transition hover:bg-sky-100 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300"
            >
              Clear {selectedPreparedStrategy.name}
            </button>
          ) : null}
        </div>
      </div>

      <div className="inline-flex flex-wrap gap-2">
        {([
          ["saved", "Saved Strategies"],
          ["prepared", "Prepared Playbooks"],
        ] as const).map(([value, label]) => {
          const isActive = strategyTab === value;

          return (
            <button
              key={value}
              type="button"
              onClick={() => setStrategyTab(value)}
              className={cn(
                "rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition",
                isActive
                  ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                  : "border-slate-200 bg-white/70 text-slate-500 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {strategyTab === "saved" ? (
        <div className="grid gap-3">
          {strategies.map((strategy) => {
            const isActive = strategy.id === selectedStrategyId;

            return (
              <button
                key={strategy.id}
                type="button"
                onClick={() => onStrategySelect(strategy.id)}
                className={cn(
                  "rounded-[22px] border p-4 text-left transition duration-200 active:scale-[0.99]",
                  isActive
                    ? "border-slate-950 bg-slate-950 text-white shadow-[0_18px_36px_-24px_rgba(15,23,42,0.35)] dark:border-white dark:bg-white dark:text-slate-950"
                    : `${TERMINAL_CHOICE_CARD_CLASS} border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-white/5`,
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={cn("font-[var(--font-manrope)] text-lg font-semibold", isActive ? "text-inherit" : "text-slate-950 dark:text-white")}>{strategy.name}</p>
                      {strategy.isDefault ? (
                        <span className={cn("rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em]", isActive ? "border-white/20 bg-white/10 text-white dark:border-slate-300 dark:bg-slate-200 dark:text-slate-900" : "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300")}>Default</span>
                      ) : null}
                    </div>
                    <p className={cn("text-sm leading-6", isActive ? "text-white/80 dark:text-slate-700" : "text-slate-500")}>{strategy.description}</p>
                    <p className={cn("text-xs uppercase tracking-[0.16em]", isActive ? "text-white/65 dark:text-slate-600" : "text-slate-400")}>Setup defaults: {strategy.structure.setupTypes.join(", ") || "Not defined"}</p>
                  </div>
                  <span className={cn("rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em]", isActive ? "border-white/20 bg-white/10 text-white dark:border-slate-300 dark:bg-slate-200 dark:text-slate-900" : "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300")}>
                    {strategy.mode}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6">
          <PreparedPlaybookSection
            title="Day Trading / Short Term"
            description="These four playbooks assume speed, tighter invalidation, and fast feedback from tape, VWAP, and opening-range behavior."
            playbooks={preparedStrategySections.daytrade}
            selectedPlaybookId={selectedPreparedStrategyId}
            onApply={onPreparedStrategyApply}
          />
          <PreparedPlaybookSection
            title="Investment"
            description="These four playbooks assume slower positioning, broader risk tolerance, and a heavier reliance on business quality, valuation, and macro context."
            playbooks={preparedStrategySections.investment}
            selectedPlaybookId={selectedPreparedStrategyId}
            onApply={onPreparedStrategyApply}
          />
        </div>
      )}
    </section>
  );
}

function SetupSelectionStep({
  direction,
  selectedStrategyName,
  preparedStrategyName,
  selectedSetupTypes,
  fundamentalOptions,
  technicalOptions,
  onToggle,
}: {
  direction: Direction;
  selectedStrategyName: string | null;
  preparedStrategyName: string | null;
  selectedSetupTypes: string[];
  fundamentalOptions: TradePresetOption[];
  technicalOptions: TradePresetOption[];
  onToggle: (label: string) => void;
}) {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Setup Types</p>
        <h2 className="font-[var(--font-manrope)] text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Select the setups driving this trade</h2>
        <p className="max-w-2xl text-sm leading-6 text-slate-500">Start with the narrative driver, then stack the technical trigger. The library is filtered to the current {direction === "LONG" ? "long" : "short"} bias so you can build a cleaner catalyst-plus-structure combination.</p>
      </header>

      <div className={cn(TERMINAL_SOFT_SURFACE_CLASS, "grid gap-4 rounded-[24px] border border-slate-200 px-5 py-4 dark:border-white/10 md:grid-cols-2")}>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">Fundamental Layer</p>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Catalysts, leadership, sector context, and the narrative reason the opportunity deserves attention.</p>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">Technical Layer</p>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Structure, reclaim, continuation, and the price behavior that tells you timing is actually in your favor.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className={cn(
          "rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em]",
          direction === "SHORT"
            ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
            : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
        )}>
          {direction} bias
        </span>
        <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          {selectedSetupTypes.length} selected
        </span>
        {selectedStrategyName ? (
          <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            Strategy {selectedStrategyName}
          </span>
        ) : null}
        {preparedStrategyName ? (
          <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300">
            Playbook {preparedStrategyName}
          </span>
        ) : null}
      </div>

      {selectedSetupTypes.length > 0 ? (
        <div className={cn(TERMINAL_SOFT_SURFACE_CLASS, "rounded-[24px] border border-slate-200 px-5 py-4 dark:border-white/10")}>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">Current Basket</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedSetupTypes.map((setupType) => (
              <span key={setupType} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                {setupType}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <SetupOptionGroup
          title="Fundamental"
          description="Choose the catalyst, context, or leadership angle that makes the trade worth stalking in the first place."
          options={fundamentalOptions}
          selectedSetupTypes={selectedSetupTypes}
          onToggle={onToggle}
        />

        <SetupOptionGroup
          title="Technical"
          description="Choose the trigger, structure, or continuation signal that tells you the entry timing is live now."
          options={technicalOptions}
          selectedSetupTypes={selectedSetupTypes}
          onToggle={onToggle}
        />
      </div>
    </div>
  );
}

function SizingStep({
  draft,
  onChange,
  position,
  conviction,
  quote,
  direction,
  targetOne,
  targetTwo,
  targetOnePnl,
  targetTwoPnl,
  initialEquity,
}: {
  draft: SizingDraft;
  onChange: (value: SizingDraft) => void;
  position: Position | null;
  conviction: ConvictionTier;
  quote: Quote | null;
  direction: Direction;
  targetOne: number | null;
  targetTwo: number | null;
  targetOnePnl: number | null;
  targetTwoPnl: number | null;
  initialEquity: number;
}) {
  const stopValid = isDirectionalStopValid(direction, draft.entryPrice, draft.stopLoss);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Sizing Window</p>
        <h2 className="font-[var(--font-manrope)] text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Entry, stop, targets, and size</h2>
        <p className="text-sm text-slate-500">Entry and stop now drive the recommended position size, expected risk, and target P&amp;L after setup selection is complete.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <section className={cn(TERMINAL_SURFACE_CLASS, "space-y-4 rounded-[24px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Inputs</p>
              <p className="mt-2 text-sm text-slate-500">Use the live quote as a reference, then define entry and stop.</p>
            </div>
            {quote ? <span className={cn(TERMINAL_BADGE_CLASS, "rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300")}>Live {formatCurrency(quote.price)}</span> : null}
          </div>

          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Entry Price</span>
              <input
                type="number"
                step="0.01"
                value={draft.entryPrice ?? ""}
                onChange={(event) => onChange({ ...draft, entryPrice: event.target.value ? Number(event.target.value) : null })}
                placeholder="0.00"
                className={cn(TERMINAL_INPUT_CLASS, "w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5")}
              />
            </label>

            <label className="block space-y-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Stop Loss</span>
              <input
                type="number"
                step="0.01"
                value={draft.stopLoss ?? ""}
                onChange={(event) => onChange({ ...draft, stopLoss: event.target.value ? Number(event.target.value) : null })}
                placeholder="0.00"
                className={cn(TERMINAL_INPUT_CLASS, "w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5")}
              />
            </label>
          </div>

          {!stopValid && draft.entryPrice != null && draft.stopLoss != null ? (
            <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
              For a {direction.toLowerCase()} trade, the stop loss must sit on the opposite side of the entry.
            </div>
          ) : null}
        </section>

        <section className={cn(TERMINAL_SURFACE_CLASS, "space-y-4 rounded-[24px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Recommended Size</p>
              <p className="mt-2 text-sm text-slate-500">Baseline strategy conviction is used here while the chosen setups are preserved for the journal and strategy snapshot.</p>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              {conviction.tier} • {(conviction.risk * 100).toFixed(1)}% risk
            </span>
          </div>

          {position ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard icon={WalletCards} label="Portfolio Risk" value={formatCurrency(initialEquity * conviction.risk)} />
              <MetricCard icon={Target} label="Position Size" value={`${position.shares} shares`} />
              <MetricCard icon={ShieldAlert} label="1R / Share" value={formatCurrency(position.rPerShare)} />
              <MetricCard icon={Target} label="Position Value" value={formatCurrency(position.value)} />
            </div>
          ) : (
            <div className="rounded-[20px] border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              Enter a valid entry and stop to calculate recommended position size.
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <TargetCard title="TP1 (2R)" price={targetOne} pnl={targetOnePnl} />
            <TargetCard title="TP2 (4R)" price={targetTwo} pnl={targetTwoPnl} />
          </div>
        </section>
      </div>
    </div>
  );
}

function ReviewStep({
  draft,
  initialEquity,
  initialHeat,
  mode,
  strategyName,
  preparedStrategyName,
  accentTextClass,
  saveError,
  quote,
  candles,
  candlesError,
  chartTimeframe,
  priceChartTimeframe,
  position,
  conviction,
  targetOne,
  targetTwo,
  targetOnePnl,
  targetTwoPnl,
  onChartTimeframeChange,
}: {
  draft: TradeDraft;
  initialEquity: number;
  initialHeat: number;
  mode: TradeMode;
  strategyName: string | null;
  preparedStrategyName: string | null;
  accentTextClass: string;
  saveError: string | null;
  quote: Quote | null;
  candles: Candle[];
  candlesError: string | null;
  chartTimeframe: ChartTimeframe;
  priceChartTimeframe: CandleTimeframe;
  position: Position | null;
  conviction: ConvictionTier;
  targetOne: number | null;
  targetTwo: number | null;
  targetOnePnl: number | null;
  targetTwoPnl: number | null;
  onChartTimeframeChange: (value: ChartTimeframe) => void;
}) {
  const quoteTone = quote && quote.change >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300";

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Review</p>
        <h2 className="font-[var(--font-manrope)] text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Final trade check</h2>
        <p className="text-sm text-slate-500">Review the identity, narrative, selected setups, and sizing before the trade is written to the journal and deployment log.</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className={cn(TERMINAL_SURFACE_CLASS, "rounded-[24px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5")}>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Identity</p>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="font-[var(--font-manrope)] text-4xl font-bold tracking-tight text-slate-950 dark:text-white">{draft.ticker}</span>
            <span className={cn("text-sm font-semibold uppercase tracking-[0.18em]", accentTextClass)}>{draft.direction}</span>
          </div>
          <p className="mt-3 text-sm text-slate-500">{toModeLabel(mode)}{strategyName ? ` • ${strategyName}` : ""}</p>
        </div>

        <div className={cn(TERMINAL_SURFACE_CLASS, "rounded-[24px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5")}>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Sizing</p>
          <dl className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between gap-4"><dt>Entry</dt><dd className="font-mono">{draft.sizing.entryPrice != null ? formatCurrency(draft.sizing.entryPrice) : "—"}</dd></div>
            <div className="flex items-center justify-between gap-4"><dt>Stop</dt><dd className="font-mono">{draft.sizing.stopLoss != null ? formatCurrency(draft.sizing.stopLoss) : "—"}</dd></div>
            <div className="flex items-center justify-between gap-4"><dt>Shares</dt><dd className="font-mono">{position?.shares ?? "—"}</dd></div>
            <div className="flex items-center justify-between gap-4"><dt>Conviction</dt><dd className="font-mono">{conviction.tier}</dd></div>
          </dl>
        </div>

        <div className={cn(TERMINAL_SURFACE_CLASS, "rounded-[24px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5")}>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Setup Context</p>
          <dl className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between gap-4"><dt>Account Equity</dt><dd className="font-mono">{formatCurrency(initialEquity)}</dd></div>
            <div className="flex items-center justify-between gap-4"><dt>Portfolio Heat</dt><dd className="font-mono">{initialHeat.toFixed(1)}%</dd></div>
            <div className="flex items-center justify-between gap-4"><dt>Strategy</dt><dd className="font-mono">{strategyName ?? "—"}</dd></div>
            <div className="flex items-center justify-between gap-4"><dt>Prepared Playbook</dt><dd className="font-mono">{preparedStrategyName ?? "—"}</dd></div>
          </dl>
          <div className={cn(TERMINAL_SOFT_SURFACE_CLASS, "mt-4 rounded-[20px] border border-slate-200 px-4 py-3 dark:border-white/10")}>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">Selected Setups</p>
            <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{draft.setupTypes.length > 0 ? draft.setupTypes.join(", ") : "No setup types selected."}</p>
          </div>
        </div>
      </section>

      <section className={cn(TERMINAL_SURFACE_CLASS, "rounded-[24px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5 lg:hidden")}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Market Snapshot</p>
            {quote ? (
              <div className="mt-2 flex items-baseline gap-3">
                <span className="font-[var(--font-manrope)] text-3xl font-semibold text-slate-950 dark:text-white">{formatCurrency(quote.price)}</span>
                <span className={cn("font-mono text-sm", quoteTone)}>
                  {quote.change >= 0 ? "+" : ""}{quote.change.toFixed(2)} ({quote.changePct.toFixed(2)}%)
                </span>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Live quote unavailable.</p>
            )}
          </div>

          <div className="text-right">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">Timeframe</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{getChartTimeframeLabel(chartTimeframe)}</p>
          </div>
        </div>

        <ChartTimeframeTabs value={chartTimeframe} onChange={onChartTimeframeChange} />

        {candles.length > 0 ? (
          <PriceChart candles={candles} direction={draft.direction} timeframe={priceChartTimeframe} height={220} />
        ) : (
          <div className="flex h-36 items-center justify-center rounded-[20px] border border-dashed border-slate-200 text-sm text-slate-400 dark:border-white/10 dark:text-slate-500">
            {candlesError ?? "Chart unavailable."}
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <section className={cn(TERMINAL_SURFACE_CLASS, "rounded-[24px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5")}>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Thesis</p>
          <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-200">{draft.thesis}</p>
        </section>

        <section className={cn(TERMINAL_SURFACE_CLASS, "rounded-[24px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5")}>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Execution Explanation</p>
          <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-200">{draft.explanation}</p>
          <div className={cn(TERMINAL_SOFT_SURFACE_CLASS, "mt-4 rounded-[20px] border border-slate-200 px-4 py-3 dark:border-white/10")}>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">Invalidation</p>
            <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{draft.invalidation}</p>
          </div>
        </section>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className={cn(TERMINAL_SURFACE_CLASS, "rounded-[24px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5")}>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Targets and P&amp;L</p>
          <dl className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between gap-4"><dt>TP1</dt><dd className="font-mono">{targetOne != null ? formatCurrency(targetOne) : "—"}</dd></div>
            <div className="flex items-center justify-between gap-4"><dt>TP1 P&amp;L</dt><dd className="font-mono">{targetOnePnl != null ? formatSignedCurrency(targetOnePnl) : "—"}</dd></div>
            <div className="flex items-center justify-between gap-4"><dt>TP2</dt><dd className="font-mono">{targetTwo != null ? formatCurrency(targetTwo) : "—"}</dd></div>
            <div className="flex items-center justify-between gap-4"><dt>TP2 P&amp;L</dt><dd className="font-mono">{targetTwoPnl != null ? formatSignedCurrency(targetTwoPnl) : "—"}</dd></div>
          </dl>
        </div>

        {saveError ? (
          <section className="rounded-[24px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {saveError}
          </section>
        ) : (
          <div className={cn(TERMINAL_SOFT_SURFACE_CLASS, "rounded-[24px] border border-slate-200 p-5 dark:border-white/10")}>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Submission Note</p>
            <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-200">Submitting now writes the selected setup types, journal entry, explanation, invalidation, and execution sizing in one insert, then returns to the dashboard using the same insert pattern as the older working flow.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function DesktopRail({
  mode,
  strategyName,
  preparedStrategyName,
  stageLabels,
  stageIndex,
  ticker,
  direction,
  quote,
  quoteError,
  candles,
  candlesError,
  chartTimeframe,
  priceChartTimeframe,
  conviction,
  initialHeat,
  position,
  targetOne,
  targetTwo,
  explanation,
  invalidation,
  setupTypes,
  onChartTimeframeChange,
}: {
  mode: TradeMode;
  strategyName: string | null;
  preparedStrategyName: string | null;
  stageLabels: string[];
  stageIndex: number;
  ticker: string;
  direction: Direction;
  quote: Quote | null;
  quoteError: string | null;
  candles: Candle[];
  candlesError: string | null;
  chartTimeframe: ChartTimeframe;
  priceChartTimeframe: CandleTimeframe;
  conviction: ConvictionTier;
  initialHeat: number;
  position: Position | null;
  targetOne: number | null;
  targetTwo: number | null;
  explanation: string;
  invalidation: string;
  setupTypes: string[];
  onChartTimeframeChange: (value: ChartTimeframe) => void;
}) {
  const quoteTone = quote && quote.change >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300";

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-8 space-y-5">
        <section className={cn(TERMINAL_RAIL_SURFACE_CLASS, "rounded-[28px] border border-slate-200/70 bg-white/85 p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-[#111827]/85")}>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Desktop Control Rail</p>
          <h3 className="mt-2 font-[var(--font-manrope)] text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Trade context</h3>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>{toModeLabel(mode)}</span>
            {strategyName ? <span className={cn(TERMINAL_BADGE_CLASS, "rounded-full border px-2 py-1 text-xs")}>{strategyName}</span> : null}
            {preparedStrategyName ? <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300">{preparedStrategyName}</span> : null}
            <span className={cn("rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em]", direction === "SHORT" ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300")}>{direction}</span>
          </div>
        </section>

        <section className={cn(TERMINAL_RAIL_SURFACE_CLASS, "rounded-[28px] border border-slate-200/70 bg-white/85 p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-[#111827]/85")}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Live Snapshot</p>
              {ticker ? <h4 className="mt-2 font-[var(--font-manrope)] text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{ticker}</h4> : <p className="mt-2 text-sm text-slate-500">Enter a ticker to load live market context.</p>}
            </div>
            <div className="text-right">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">Timeframe</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{getChartTimeframeLabel(chartTimeframe)}</p>
            </div>
          </div>

          {quote ? (
            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-[var(--font-manrope)] text-3xl font-semibold text-slate-950 dark:text-white">{formatCurrency(quote.price)}</span>
              <span className={cn("font-mono text-sm", quoteTone)}>
                {quote.change >= 0 ? "+" : ""}{quote.change.toFixed(2)} ({quote.changePct.toFixed(2)}%)
              </span>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">{quoteError ?? "Waiting for live quote..."}</p>
          )}

          <div className="mt-4">
            <ChartTimeframeTabs value={chartTimeframe} onChange={onChartTimeframeChange} compact />
          </div>

          <div className="mt-4">
            {candles.length > 0 ? (
              <PriceChart candles={candles} direction={direction} timeframe={priceChartTimeframe} height={220} />
            ) : (
              <div className="flex h-36 items-center justify-center rounded-[20px] border border-dashed border-slate-200 text-sm text-slate-400 dark:border-white/10 dark:text-slate-500">
                {candlesError ?? "Chart unavailable."}
              </div>
            )}
          </div>
        </section>

        <section className={cn(TERMINAL_RAIL_SURFACE_CLASS, "rounded-[28px] border border-slate-200/70 bg-white/85 p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-[#111827]/85")}>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Stage Map</p>
          <div className="mt-4 space-y-2">
            {stageLabels.map((label, index) => {
              const isPast = index + 1 < stageIndex;
              const isCurrent = index + 1 === stageIndex;

              return (
                <div
                  key={`${label}-${index}`}
                  className={cn(
                    "rounded-[18px] border px-4 py-3 text-sm",
                    isCurrent
                      ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                      : isPast
                        ? `${TERMINAL_STAGE_CHIP_CLASS} is-past border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300`
                        : `${TERMINAL_STAGE_CHIP_CLASS} is-idle border-slate-200 bg-white text-slate-400 dark:border-white/10 dark:bg-transparent dark:text-slate-500`,
                  )}
                >
                  {label}
                </div>
              );
            })}
          </div>
        </section>

        <section className={cn(TERMINAL_RAIL_SURFACE_CLASS, "rounded-[28px] border border-slate-200/70 bg-white/85 p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-[#111827]/85")}>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Selected Setups</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {setupTypes.length > 0 ? setupTypes.map((setupType) => (
              <span key={setupType} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                {setupType}
              </span>
            )) : <p className="text-sm text-slate-500">No setup types selected yet.</p>}
          </div>
        </section>

        <section className={cn(TERMINAL_RAIL_SURFACE_CLASS, "rounded-[28px] border border-slate-200/70 bg-white/85 p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-[#111827]/85")}>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Risk Snapshot</p>
          <div className="mt-4 grid gap-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between gap-4"><span>Portfolio Heat</span><strong className="font-mono">{initialHeat.toFixed(1)}%</strong></div>
            <div className="flex items-center justify-between gap-4"><span>Conviction</span><strong className="font-mono">{conviction.tier}</strong></div>
            <div className="flex items-center justify-between gap-4"><span>Risk %</span><strong className="font-mono">{(conviction.risk * 100).toFixed(1)}%</strong></div>
            <div className="flex items-center justify-between gap-4"><span>Recommended Shares</span><strong className="font-mono">{position?.shares ?? "—"}</strong></div>
            <div className="flex items-center justify-between gap-4"><span>TP1</span><strong className="font-mono">{targetOne != null ? formatCurrency(targetOne) : "—"}</strong></div>
            <div className="flex items-center justify-between gap-4"><span>TP2</span><strong className="font-mono">{targetTwo != null ? formatCurrency(targetTwo) : "—"}</strong></div>
          </div>
        </section>

        <section className={cn(TERMINAL_RAIL_SURFACE_CLASS, "rounded-[28px] border border-slate-200/70 bg-white/85 p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-[#111827]/85")}>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Narrative Snapshot</p>
          <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className={cn(TERMINAL_SOFT_SURFACE_CLASS, "rounded-[18px] border border-slate-200 px-4 py-3 dark:border-white/10")}>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Explanation</p>
              <p className="mt-2 leading-6">{explanation.trim() || "No execution explanation yet."}</p>
            </div>
            <div className={cn(TERMINAL_SOFT_SURFACE_CLASS, "rounded-[18px] border border-slate-200 px-4 py-3 dark:border-white/10")}>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Invalidation</p>
              <p className="mt-2 leading-6">{invalidation.trim() || "No invalidation written yet."}</p>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}

function SetupOptionGroup({
  title,
  description,
  options,
  selectedSetupTypes,
  onToggle,
}: {
  title: string;
  description: string;
  options: TradePresetOption[];
  selectedSetupTypes: string[];
  onToggle: (label: string) => void;
}) {
  return (
    <section className={cn(TERMINAL_SURFACE_CLASS, "rounded-[26px] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/5")}>
      <div className="mb-5 space-y-2">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
        <p className="text-sm leading-6 text-slate-500">{description}</p>
      </div>

      <div className="grid gap-4">
        {options.length > 0 ? options.map((option) => {
          const isSelected = selectedSetupTypes.includes(option.label);

          return (
            <button
              key={option.label}
              type="button"
              onClick={() => onToggle(option.label)}
              className={cn(
                "rounded-[24px] border p-5 text-left transition duration-200 active:scale-[0.99]",
                isSelected
                  ? "border-slate-950 bg-slate-950 text-white shadow-[0_18px_36px_-24px_rgba(15,23,42,0.35)] dark:border-white dark:bg-white dark:text-slate-950"
                  : `${TERMINAL_CHOICE_CARD_CLASS} border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-white/5`,
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <p className={cn("font-[var(--font-manrope)] text-lg font-semibold", isSelected ? "text-inherit" : "text-slate-950 dark:text-white")}>{option.label}</p>
                  <p className={cn("text-sm leading-6", isSelected ? "text-white/80 dark:text-slate-700" : "text-slate-500")}>{option.detail}</p>
                  {option.keywords.length > 0 ? (
                    <p className={cn("font-mono text-[10px] uppercase tracking-[0.16em]", isSelected ? "text-white/60 dark:text-slate-600" : "text-slate-400")}>{option.keywords.slice(0, 4).join(" · ")}</p>
                  ) : null}
                </div>
                <span className={cn(
                  "rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em]",
                  isSelected
                    ? "border-white/20 bg-white/10 text-white dark:border-slate-300 dark:bg-slate-200 dark:text-slate-900"
                    : "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
                )}>
                  {option.family}
                </span>
              </div>
            </button>
          );
        }) : (
          <div className="rounded-[20px] border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
            No {title.toLowerCase()} setups match this direction yet.
          </div>
        )}
      </div>
    </section>
  );
}

function PreparedPlaybookSection({
  title,
  description,
  playbooks,
  selectedPlaybookId,
  onApply,
}: {
  title: string;
  description: string;
  playbooks: PreparedTradePlaybook[];
  selectedPlaybookId: string | null;
  onApply: (playbookId: string) => void;
}) {
  const [expandedPlaybookId, setExpandedPlaybookId] = useState<string | null>(() => {
    if (selectedPlaybookId && playbooks.some((playbook) => playbook.id === selectedPlaybookId)) {
      return selectedPlaybookId;
    }

    return null;
  });

  useEffect(() => {
    if (selectedPlaybookId && playbooks.some((playbook) => playbook.id === selectedPlaybookId)) {
      setExpandedPlaybookId(selectedPlaybookId);
    }
  }, [playbooks, selectedPlaybookId]);

  return (
    <section className="space-y-3">
      <div className="space-y-2">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
        <p className="text-sm leading-6 text-slate-500">{description}</p>
      </div>

      <div className="space-y-2">
        {playbooks.map((playbook) => {
          const isActive = playbook.id === selectedPlaybookId;
          const isExpanded = playbook.id === expandedPlaybookId;

          return (
            <article
              key={playbook.id}
              className={cn(
                "overflow-hidden rounded-[22px] border transition duration-200",
                isActive
                  ? "border-sky-500 bg-sky-50 shadow-[0_18px_36px_-24px_rgba(14,165,233,0.25)] dark:border-sky-400 dark:bg-sky-500/10"
                  : `${TERMINAL_CHOICE_CARD_CLASS} border-slate-200 bg-white dark:border-white/10 dark:bg-white/5`,
              )}
            >
              <button
                type="button"
                onClick={() => setExpandedPlaybookId(isExpanded ? null : playbook.id)}
                className="flex w-full items-start justify-between gap-3 p-4 text-left"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-[var(--font-manrope)] text-base font-semibold text-slate-950 dark:text-white">{playbook.name}</p>
                    <span className={cn("rounded-full px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em]", playbook.direction === "SHORT" ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300")}>{playbook.direction === "LONG" ? "Bullish" : "Bearish"}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">{playbook.horizon === "daytrade" ? "Day Trading" : "Investment"}</span>
                  </div>
                  <p className="text-sm leading-6 text-slate-500">{playbook.summary}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em]", isActive ? "border-sky-200 bg-white text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-200" : "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300")}>
                    {isActive ? "Applied" : "Preview"}
                  </span>
                  <ChevronRight className={cn("mt-1 h-4 w-4 flex-none text-slate-400 transition-transform dark:text-slate-500", isExpanded && "rotate-90")} />
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isExpanded ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="overflow-hidden border-t border-slate-200/80 dark:border-white/10"
                  >
                    <div className="space-y-3 p-4">
                      <p className="text-xs leading-5 text-slate-500"><span className="font-semibold text-slate-700 dark:text-slate-200">General fundamentals:</span> {playbook.fundamentalFocus.join(", ")}</p>
                      <p className="text-xs leading-5 text-slate-500"><span className="font-semibold text-slate-700 dark:text-slate-200">Trigger checklist:</span> {playbook.technicalFocus.join(", ")}</p>
                      <p className="text-xs leading-5 text-slate-500"><span className="font-semibold text-slate-700 dark:text-slate-200">Best for:</span> {playbook.bestFor}</p>
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-3 dark:border-white/10">
                        <div className="space-y-1">
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">Setup defaults</p>
                          <p className="text-sm text-slate-600 dark:text-slate-300">{playbook.setupTypes.join(", ") || "None defined"}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onApply(playbook.id)}
                          className={cn(
                            "rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition",
                            isActive
                              ? "bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                              : "bg-sky-600 text-white hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400",
                          )}
                        >
                          {isActive ? "Reapply" : "Apply playbook"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ChartTimeframeTabs({
  value,
  onChange,
  compact = false,
}: {
  value: ChartTimeframe;
  onChange: (value: ChartTimeframe) => void;
  compact?: boolean;
}) {
  const options: Array<{ value: ChartTimeframe; label: string }> = [
    { value: "daily", label: "Daily" },
    { value: "4h", label: "4H" },
    { value: "1h", label: "1H" },
  ];

  return (
    <div className={cn("inline-flex flex-wrap", compact ? "gap-1.5" : "gap-2")}>
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] transition",
              isActive
                ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                : "border-slate-200 bg-white/70 text-slate-500 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof WalletCards; label: string; value: string }) {
  return (
    <div className={cn(TERMINAL_MUTED_SURFACE_CLASS, "rounded-[20px] border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5")}>
      <div className="flex items-center gap-2 text-slate-500"><Icon className="h-4 w-4" /><span className="font-mono text-[11px] uppercase tracking-[0.18em]">{label}</span></div>
      <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function TargetCard({ title, price, pnl }: { title: string; price: number | null; pnl: number | null }) {
  return (
    <div className={cn(TERMINAL_MUTED_SURFACE_CLASS, "rounded-[20px] border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5")}>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">{price != null ? formatCurrency(price) : "—"}</p>
      <p className="mt-2 text-sm text-slate-500">P&amp;L {pnl != null ? formatSignedCurrency(pnl) : "—"}</p>
    </div>
  );
}
