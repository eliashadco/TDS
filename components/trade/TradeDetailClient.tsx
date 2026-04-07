"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { QuoteStatusBadge } from "@/components/market/QuoteStatusBadge";
import AssessmentMatrix from "@/components/trade/AssessmentMatrix";
import TradeReassessmentCard from "@/components/trade/TradeReassessmentCard";
import { Button } from "@/components/ui/button";
import { getCandleRange as buildCandleRange, getDefaultCandleTimeframe } from "@/lib/market/candle-range";
import { getMetricDefinition } from "@/lib/trading/presets";
import { parseStrategySnapshot } from "@/lib/trading/strategies";
import type { Database, Json } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import PriceChart from "@/components/chart/PriceChart";
import type { Candle, CandleTimeframe, Quote } from "@/types/market";
import type { SavedStrategy } from "@/types/strategy";

type TradeRow = Database["public"]["Tables"]["trades"]["Row"];

type TradeDetailClientProps = {
  trade: TradeRow;
  metricMap: Record<string, { name: string; description: string | null; type: "fundamental" | "technical" }>;
  availableStrategies: SavedStrategy[];
  portfolioContext: {
    equity: number;
    portfolioHeat: number;
    activeTradeCount: number;
  };
};

function asRecord(input: Json): Record<string, Json> {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, Json>;
  }
  return {};
}

function asNumberMap(input: Json): Record<string, 0 | 1> {
  const map = asRecord(input);
  return Object.keys(map).reduce(
    (acc, key) => {
      const value = map[key];
      if (value === 0 || value === 1) {
        acc[key] = value;
      }
      return acc;
    },
    {} as Record<string, 0 | 1>,
  );
}

function asStringMap(input: Json): Record<string, string> {
  const map = asRecord(input);
  return Object.keys(map).reduce(
    (acc, key) => {
      const value = map[key];
      if (typeof value === "string") {
        acc[key] = value;
      }
      return acc;
    },
    {} as Record<string, string>,
  );
}

function money(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function signedMoney(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }

  return `${value >= 0 ? "+" : "-"}${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))}`;
}

function pct(value: number | null | undefined, multiplier = 1): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }

  return `${(value * multiplier).toFixed(1)}%`;
}

function signedPct(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }

  return `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(1)}%`;
}

function distancePct(
  currentPrice: number | null,
  level: number | null | undefined,
  direction: TradeRow["direction"],
  lane: "stop" | "target",
): number | null {
  if (currentPrice == null || currentPrice <= 0 || level == null || !Number.isFinite(level)) {
    return null;
  }

  if (lane === "stop") {
    return direction === "LONG"
      ? ((currentPrice - level) / currentPrice) * 100
      : ((level - currentPrice) / currentPrice) * 100;
  }

  return direction === "LONG"
    ? ((level - currentPrice) / currentPrice) * 100
    : ((currentPrice - level) / currentPrice) * 100;
}

function formatModeLabel(mode: TradeRow["mode"]): string {
  if (mode === "daytrade") {
    return "Day Trade";
  }

  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function formatSourceLabel(source: TradeRow["source"]): string {
  return source === "marketwatch" ? "MarketWatch" : "Manual Thesis";
}

function formatTradeState(trade: TradeRow): string {
  if (trade.closed) {
    return "Closed";
  }
  if (trade.confirmed) {
    return "Active";
  }
  return "Watch";
}

function getConvictionHeading(score: number, trade: TradeRow): string {
  if (trade.closed) {
    return "Archived trade";
  }
  if (score >= 88) {
    return "High conviction";
  }
  if (score >= 72) {
    return "Aligned setup";
  }
  if (score >= 55) {
    return "Developing setup";
  }
  return "Needs review";
}

function getConvictionBarClass(score: number): string {
  if (score >= 88) {
    return "bg-emerald-400";
  }
  if (score >= 72) {
    return "bg-sky-400";
  }
  if (score >= 55) {
    return "bg-amber-300";
  }
  return "bg-rose-400";
}

const CONVICTION_WIDTH_CLASSES = [
  "w-[10%]",
  "w-[20%]",
  "w-[30%]",
  "w-[40%]",
  "w-[50%]",
  "w-[60%]",
  "w-[70%]",
  "w-[80%]",
  "w-[90%]",
  "w-full",
] as const;

function getConvictionWidthClass(score: number): (typeof CONVICTION_WIDTH_CLASSES)[number] {
  return CONVICTION_WIDTH_CLASSES[Math.min(CONVICTION_WIDTH_CLASSES.length - 1, Math.max(0, Math.ceil(score / 10) - 1))];
}

function formatStrategySourceLabel(source: "custom" | "preset" | "legacy" | null): string {
  if (source === "preset") {
    return "Preset strategy snapshot";
  }
  if (source === "custom") {
    return "Custom strategy snapshot";
  }
  if (source === "legacy") {
    return "Legacy saved snapshot";
  }
  return "Legacy trade";
}

function formatMetricFallbackLabel(metricId: string): string {
  return metricId
    .replace(/^[ft]_/, "")
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

const journalFieldClass = "mt-3 min-h-[144px] w-full rounded-[24px] border border-white/80 bg-white/88 px-4 py-3 text-sm text-tds-text shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_10px_24px_-18px_rgba(15,23,42,0.35)] placeholder:text-tds-dim";

export default function TradeDetailClient({ trade, metricMap, availableStrategies, portfolioContext }: TradeDetailClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const [localTrade, setLocalTrade] = useState<TradeRow>(trade);
  const [entryJournal, setEntryJournal] = useState(trade.journal_entry);
  const [exitJournal, setExitJournal] = useState(trade.journal_exit);
  const [postJournal, setPostJournal] = useState(trade.journal_post);
  const [status, setStatus] = useState<string | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [liveQuote, setLiveQuote] = useState<Quote | null>(null);
  const [chartTimeframe, setChartTimeframe] = useState<CandleTimeframe>(() => getDefaultCandleTimeframe(trade.mode));

  const entryInitRef = useRef(true);
  const exitInitRef = useRef(true);
  const postInitRef = useRef(true);

  useEffect(() => {
    setChartTimeframe(getDefaultCandleTimeframe(localTrade.mode));
  }, [localTrade.mode]);

  useEffect(() => {
    async function loadCandles() {
      const range = buildCandleRange(localTrade.mode, chartTimeframe);
      const params = new URLSearchParams({
        ticker: localTrade.ticker,
        from: range.from,
        to: range.to,
        timeframe: range.timeframe,
      });

      try {
        const response = await fetch(`/api/market/candles?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as Candle[];
        setCandles(Array.isArray(data) ? data : []);
      } catch {
        setCandles([]);
      }
    }

    void loadCandles();
  }, [chartTimeframe, localTrade.mode, localTrade.ticker]);

  useEffect(() => {
    let isActive = true;

    async function loadQuote() {
      try {
        const response = await fetch(`/api/market/quote?ticker=${localTrade.ticker}`, { cache: "no-store" });
        if (!response.ok) {
          if (isActive) {
            setLiveQuote(null);
          }
          return;
        }

        const data = (await response.json()) as Quote;
        if (isActive) {
          setLiveQuote(data);
        }
      } catch {
        if (isActive) {
          setLiveQuote(null);
        }
      }
    }

    void loadQuote();

    return () => {
      isActive = false;
    };
  }, [localTrade.ticker]);

  useEffect(() => {
    if (entryInitRef.current) {
      entryInitRef.current = false;
      return;
    }

    const timeout = setTimeout(async () => {
      await supabase.from("trades").update({ journal_entry: entryJournal }).eq("id", localTrade.id);
      setStatus("Entry journal saved");
    }, 500);

    return () => clearTimeout(timeout);
  }, [entryJournal, localTrade.id, supabase]);

  useEffect(() => {
    if (exitInitRef.current) {
      exitInitRef.current = false;
      return;
    }

    const timeout = setTimeout(async () => {
      await supabase.from("trades").update({ journal_exit: exitJournal }).eq("id", localTrade.id);
      setStatus("Exit journal saved");
    }, 500);

    return () => clearTimeout(timeout);
  }, [exitJournal, localTrade.id, supabase]);

  useEffect(() => {
    if (postInitRef.current) {
      postInitRef.current = false;
      return;
    }

    const timeout = setTimeout(async () => {
      await supabase.from("trades").update({ journal_post: postJournal }).eq("id", localTrade.id);
      setStatus("Post-trade review saved");
    }, 500);

    return () => clearTimeout(timeout);
  }, [postJournal, localTrade.id, supabase]);

  const scores = asNumberMap(localTrade.scores);
  const notes = asStringMap(localTrade.notes);
  const strategySnapshot = parseStrategySnapshot(localTrade.strategy_snapshot, localTrade.mode as "investment" | "swing" | "daytrade" | "scalp");
  const snapshotMetricMap = Object.fromEntries(
    (strategySnapshot?.metrics ?? []).map((metric) => [
      metric.id,
      {
        name: metric.name,
        description: metric.description,
        type: metric.type,
      },
    ]),
  ) as Record<string, { name: string; description: string; type: "fundamental" | "technical" }>;
  const strategyLabel = strategySnapshot?.name ?? localTrade.strategy_name ?? "Legacy strategy";
  const strategyDescription = strategySnapshot?.description?.trim() || "This trade was stored before the strategy workspace captured a full named snapshot.";
  const strategySource = formatStrategySourceLabel(strategySnapshot?.source ?? null);
  const strategyMetricCount = strategySnapshot?.metrics.filter((metric) => metric.enabled).length ?? Object.keys(scores).length;
  const strategySetupTypes = strategySnapshot?.structure.setupTypes ?? localTrade.setup_types;
  const strategyConditions = strategySnapshot?.structure.conditions ?? localTrade.conditions;
  const strategyChartPattern = strategySnapshot?.structure.chartPattern || localTrade.chart_pattern || "None";
  const strategyInvalidation = strategySnapshot?.structure.invalidationStyle || localTrade.invalidation;
  const scoreEntries = Object.entries(scores).map(([metricId, value]) => {
    const savedMetric = snapshotMetricMap[metricId] ?? metricMap[metricId];
    const libraryMetric = getMetricDefinition(metricId);

    return {
      metricId,
      value,
      name: savedMetric?.name ?? libraryMetric?.name ?? formatMetricFallbackLabel(metricId),
      description:
        savedMetric?.description ??
        libraryMetric?.description ??
        "This stored check did not include a saved explainer, so only the result note is available.",
      type: savedMetric?.type ?? libraryMetric?.type ?? (metricId.startsWith("f_") ? "fundamental" : "technical"),
      note: notes[metricId],
    };
  });

  const fMetrics = scoreEntries.filter((metric) => metric.type === "fundamental");
  const tMetrics = scoreEntries.filter((metric) => metric.type === "technical");
  const passedMetrics = scoreEntries.filter((metric) => metric.value === 1);
  const flaggedMetrics = scoreEntries.filter((metric) => metric.value === 0);
  const fPassCount = fMetrics.filter((metric) => metric.value === 1).length;
  const tPassCount = tMetrics.filter((metric) => metric.value === 1).length;
  const totalMetrics = scoreEntries.length;
  const passRate = totalMetrics > 0 ? passedMetrics.length / totalMetrics : 0;

  const insight = localTrade.insight && typeof localTrade.insight === "object" && !Array.isArray(localTrade.insight)
    ? (localTrade.insight as Record<string, Json>)
    : null;

  const showExitJournal = localTrade.exit_t1 || localTrade.closed;
  const showPostJournal = localTrade.closed;
  const duePostReview = localTrade.closed && !postJournal.trim();
  const executionValue = localTrade.entry_price != null ? localTrade.entry_price * localTrade.shares : null;
  const currentPrice = liveQuote?.price ?? localTrade.market_price ?? localTrade.entry_price ?? null;
  const livePnl = currentPrice != null && localTrade.entry_price != null
    ? localTrade.direction === "LONG"
      ? (currentPrice - localTrade.entry_price) * localTrade.shares
      : (localTrade.entry_price - currentPrice) * localTrade.shares
    : null;
  const livePnlPct = executionValue && executionValue > 0 && livePnl != null ? (livePnl / executionValue) * 100 : null;
  const tradeHeat = localTrade.risk_pct != null ? localTrade.risk_pct * 100 : null;
  const bookShare = executionValue && portfolioContext.equity > 0 ? (executionValue / portfolioContext.equity) * 100 : null;
  const distanceToStopPct = distancePct(currentPrice, localTrade.stop_loss, localTrade.direction, "stop");
  const distanceTo2RPct = distancePct(currentPrice, localTrade.r2_target, localTrade.direction, "target");
  const distanceTo4RPct = distancePct(currentPrice, localTrade.r4_target, localTrade.direction, "target");
  const convictionBoost = localTrade.conviction === "MAX" ? 18 : localTrade.conviction === "HIGH" ? 12 : localTrade.conviction === "STD" ? 7 : 0;
  const stateBoost = localTrade.confirmed ? 6 : localTrade.closed ? 3 : 0;
  const convictionScore = totalMetrics > 0
    ? Math.max(35, Math.min(96, Math.round(passRate * 72 + convictionBoost + stateBoost)))
    : localTrade.conviction
      ? Math.max(58, 60 + convictionBoost)
      : 42;
  const convictionHeading = getConvictionHeading(convictionScore, localTrade);
  const primarySetup = localTrade.setup_types[0]?.toLowerCase() ?? "trade";
  const aiSummary = typeof insight?.summary === "string"
    ? insight.summary
    : `${localTrade.ticker} is being tracked through ${passedMetrics.length}/${Math.max(totalMetrics, 1)} stored checks with ${localTrade.invalidation.toLowerCase()} as the live invalidation trigger.`;
  const passedHighlightText = passedMetrics.length > 0
    ? passedMetrics.slice(0, 3).map((metric) => metric.name).join(" / ")
    : "No stored passing metrics yet.";
  const flaggedHighlightText = flaggedMetrics.length > 0
    ? flaggedMetrics.slice(0, 3).map((metric) => metric.name).join(" / ")
    : "No flagged metrics right now.";

  async function persistTradePatch(patch: Database["public"]["Tables"]["trades"]["Update"]) {
    const { data, error } = await supabase.from("trades").update(patch).eq("id", localTrade.id).select("*").single();
    if (error) {
      setStatus("Update failed");
      return;
    }
    setLocalTrade(data);
    setStatus("Saved");
  }

  async function toggleTranche(key: "exit_t1" | "exit_t2" | "exit_t3") {
    const next = !localTrade[key];
    const patch: Database["public"]["Tables"]["trades"]["Update"] = {
      [key]: next,
    };

    const nextT1 = key === "exit_t1" ? next : localTrade.exit_t1;
    const nextT2 = key === "exit_t2" ? next : localTrade.exit_t2;
    const nextT3 = key === "exit_t3" ? next : localTrade.exit_t3;

    if (nextT1 && nextT2 && nextT3) {
      patch.closed = true;
      patch.closed_at = new Date().toISOString();
    }

    await persistTradePatch(patch);
  }

  async function closePosition() {
    if (localTrade.closed) {
      return;
    }
    const reason = window.prompt("Close reason:") ?? "";
    await persistTradePatch({
      closed: true,
      closed_at: new Date().toISOString(),
      closed_reason: reason || "Manual close",
    });
  }

  return (
    <main className="space-y-8 p-4 md:p-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/86 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-tds-dim shadow-sm hover:bg-white hover:text-tds-text"
      >
        Back to dashboard
      </Link>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="fin-panel p-6 sm:p-8">
          <p className="fin-kicker">Trade Snapshot</p>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-semibold tracking-[-0.05em] text-tds-text sm:text-4xl">
                {localTrade.ticker} {localTrade.direction === "LONG" ? "long" : "short"} {primarySetup} setup
              </h1>
              <p className="mt-3 text-sm leading-7 text-tds-dim">
                Cleaner hierarchy, clearer execution context, and one summary lane for conviction, alignment, and risk.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="fin-chip">{formatModeLabel(localTrade.mode)}</span>
              {localTrade.conviction ? <span className="fin-chip">{localTrade.conviction}</span> : null}
              <span className="fin-chip">{formatTradeState(localTrade)}</span>
              <span className="fin-chip">{formatSourceLabel(localTrade.source)}</span>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="fin-card p-5">
              <p className="fin-kicker">Identity</p>
              <p className="mt-3 text-lg font-semibold text-tds-text">{localTrade.asset_class}</p>
              <p className="mt-2 text-sm text-tds-dim">{localTrade.direction} bias with {formatTradeState(localTrade).toLowerCase()} execution state.</p>
            </div>
            <div className="fin-card p-5">
              <p className="fin-kicker">Risk Unit</p>
              <p className="mt-3 text-lg font-semibold text-tds-text">{pct(localTrade.risk_pct, 100)}</p>
              <p className="mt-2 text-sm text-tds-dim">{localTrade.shares} shares planned across two tranches.</p>
            </div>
            <div className="fin-card p-5">
              <p className="fin-kicker">Timing</p>
              <p className="mt-3 text-lg font-semibold text-tds-text">{localTrade.catalyst_window || "Open window"}</p>
              <p className="mt-2 text-sm text-tds-dim">Invalidation stays at {localTrade.invalidation.toLowerCase()}.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
            <div className="fin-card p-5">
              <p className="fin-kicker">Thesis</p>
              <p className="mt-3 text-sm leading-7 text-tds-text">{localTrade.thesis}</p>
            </div>

            <div className="fin-card p-5">
              <p className="fin-kicker">Strategy Frame</p>
              <p className="mt-3 text-sm leading-7 text-tds-text">{strategyLabel}</p>
              <p className="mt-2 text-sm leading-6 text-tds-dim">{strategyDescription}</p>
              <div className="mt-4 space-y-2 text-sm text-tds-dim">
                <p>Snapshot source: {strategySource}</p>
                <p>Revision: {strategySnapshot?.versionNumber ? `v${strategySnapshot.versionNumber}` : "Legacy / unknown"}</p>
                <p>Stored checks: {strategyMetricCount}</p>
                {strategySnapshot?.learningGoal ? <p>Learning goal: {strategySnapshot.learningGoal}</p> : null}
                <p>Setup types: {strategySetupTypes.length > 0 ? strategySetupTypes.join(", ") : "Not captured"}</p>
                <p>Conditions: {strategyConditions.length > 0 ? strategyConditions.join(", ") : "No extra conditions stored"}</p>
                <p>Chart pattern: {strategyChartPattern}</p>
                <p>Invalidation: {strategyInvalidation}</p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="fin-kicker">Assessment Matrix</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Stored strategy checks</h2>
              </div>
              <span className="fin-chip">{passedMetrics.length}/{Math.max(totalMetrics, 1)} aligned</span>
            </div>

            {totalMetrics === 0 ? (
              <div className="fin-card mt-5 p-5 text-sm text-tds-dim">No assessment metrics were stored for this trade.</div>
            ) : (
              <div className="mt-5">
                <AssessmentMatrix
                  metrics={scoreEntries.map((metric) => ({
                    id: metric.metricId,
                    name: metric.name,
                    description: metric.description,
                    type: metric.type,
                    note: metric.note,
                    value: metric.value,
                  }))}
                  mode={localTrade.mode}
                  direction={localTrade.direction}
                  noteLabel="Stored rationale"
                />
              </div>
            )}
          </div>

          <div className="mt-6">
            <TradeReassessmentCard trade={localTrade} availableStrategies={availableStrategies} onTradeUpdated={setLocalTrade} />
          </div>
        </div>

        <aside className="overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,#0D1528_0%,#11203A_55%,#14394C_100%)] p-6 text-white shadow-[0_38px_86px_-44px_rgba(13,21,40,0.68)]">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-300">Live Summary</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.05em]">{convictionHeading}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {passedMetrics.length} of {Math.max(totalMetrics, 1)} enabled checks are aligned for {localTrade.ticker}. The right rail now carries conviction, sizing, and execution so the main page stays readable.
          </p>

          <div className="mt-6 space-y-4">
            <div className="rounded-[26px] border border-white/10 bg-white/6 p-5 backdrop-blur">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-300">Conviction Score</p>
              <div className="mt-3 flex items-end justify-between gap-4">
                <p className="text-5xl font-semibold">{convictionScore}</p>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200">
                  {localTrade.conviction ?? "Pending"}
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full ${getConvictionBarClass(convictionScore)} ${getConvictionWidthClass(convictionScore)}`} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-400">Fundamentals</p>
                  <p className="mt-1 text-sm text-slate-200">{fPassCount}/{fMetrics.length || 0}</p>
                </div>
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-400">Technicals</p>
                  <p className="mt-1 text-sm text-slate-200">{tPassCount}/{tMetrics.length || 0}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/6 p-5 backdrop-blur">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-300">Position Sizing</p>
              <p className="mt-3 text-4xl font-semibold">{money(executionValue)}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {localTrade.risk_pct != null
                  ? `${pct(localTrade.risk_pct, 100)} risk unit, ${localTrade.shares} shares, ${localTrade.tranche1_shares} / ${localTrade.tranche2_shares} tranche split.`
                  : "Sizing has not been locked yet for this instrument."}
              </p>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/6 p-5 backdrop-blur">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-300">Position Health</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate-400">Current P&amp;L</p>
                  <p className="mt-2 text-lg font-semibold text-white">{signedMoney(livePnl)}</p>
                  <p className="mt-1 text-xs text-slate-400">{signedPct(livePnlPct)}</p>
                </div>
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate-400">Deployed</p>
                  <p className="mt-2 text-lg font-semibold text-white">{money(executionValue)}</p>
                  <p className="mt-1 text-xs text-slate-400">Book size {money(portfolioContext.equity)}</p>
                </div>
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate-400">Trade Heat</p>
                  <p className="mt-2 text-lg font-semibold text-white">{pct(tradeHeat)}</p>
                  <p className="mt-1 text-xs text-slate-400">Portfolio heat {portfolioContext.portfolioHeat.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate-400">Book Share</p>
                  <p className="mt-2 text-lg font-semibold text-white">{pct(bookShare)}</p>
                  <p className="mt-1 text-xs text-slate-400">Across {portfolioContext.activeTradeCount} active trade{portfolioContext.activeTradeCount === 1 ? "" : "s"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/6 p-5 backdrop-blur">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-300">Execution</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                <p>Current {money(currentPrice)}</p>
                <p>Entry {money(localTrade.entry_price)}</p>
                <p>Stop {money(localTrade.stop_loss)}</p>
                <p>2R {money(localTrade.r2_target)}</p>
                <p>4R {money(localTrade.r4_target)}</p>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/6 p-5 backdrop-blur">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-300">Live Risk Distance</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate-400">Distance to stop</p>
                  <p className="mt-2 text-lg font-semibold text-white">{signedPct(distanceToStopPct)}</p>
                </div>
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate-400">Distance to 2R</p>
                  <p className="mt-2 text-lg font-semibold text-white">{signedPct(distanceTo2RPct)}</p>
                </div>
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate-400">Distance to 4R</p>
                  <p className="mt-2 text-lg font-semibold text-white">{signedPct(distanceTo4RPct)}</p>
                </div>
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate-400">Live price context</p>
                  <p className="mt-2 text-lg font-semibold text-white">{money(currentPrice)}</p>
                  <p className="mt-1 text-xs text-slate-400">{liveQuote ? signedPct(liveQuote.changePct) : "Latest stored market price"}</p>
                  <QuoteStatusBadge
                    status={liveQuote?.dataStatus ?? null}
                    provider={liveQuote?.provider ?? null}
                    tone="dark"
                    className="mt-2"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/6 p-5 backdrop-blur">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-300">AI Note</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">{aiSummary}</p>
              {typeof insight?.edge === "string" ? <p className="mt-3 text-sm text-slate-400">Edge: {insight.edge}</p> : null}
              {typeof insight?.risks === "string" ? <p className="mt-2 text-sm text-slate-400">Risk: {insight.risks}</p> : null}
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/6 p-5 backdrop-blur">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-300">Strategy Alignment</p>
              <div className="mt-3 space-y-3 text-sm leading-6 text-slate-300">
                <p>Passing now: {passedHighlightText}</p>
                <p>Needs attention: {flaggedHighlightText}</p>
                <p>Invalidation line: {localTrade.invalidation}</p>
              </div>
            </div>

            {localTrade.confirmed && !localTrade.closed ? (
              <div className="rounded-[26px] border border-white/10 bg-white/6 p-5 backdrop-blur">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-300">Position Controls</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {([
                    ["exit_t1", localTrade.exit_t1, "T1"],
                    ["exit_t2", localTrade.exit_t2, "T2"],
                    ["exit_t3", localTrade.exit_t3, "T3"],
                  ] as const).map(([key, value, label]) => (
                    <Button
                      key={key}
                      type="button"
                      variant="secondary"
                      onClick={() => void toggleTranche(key)}
                      className={value ? "border-transparent bg-emerald-400 text-slate-950 hover:bg-emerald-300" : "border-white/10 bg-white/8 text-white hover:bg-white/12"}
                    >
                      {label}
                    </Button>
                  ))}
                </div>

                {!localTrade.tranche2_filled ? (
                  <p className="mt-4 rounded-[20px] border border-amber-300/15 bg-amber-300/10 px-4 py-3 text-xs leading-5 text-amber-100">
                    Tranche 2 deadline: {localTrade.tranche2_deadline ? new Date(localTrade.tranche2_deadline).toLocaleString() : "Pending"}
                  </p>
                ) : null}

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void closePosition()}
                  className="mt-4 w-full border-red-300/20 bg-red-400/12 text-red-100 hover:bg-red-400/18"
                >
                  Close Position
                </Button>
              </div>
            ) : null}
          </div>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <div className="fin-panel p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="fin-kicker">Price Context</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Entry, stop, and target map</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(["hour", "day", "week"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setChartTimeframe(value)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                    chartTimeframe === value ? "border-blue-200 bg-blue-50 text-tds-blue" : "border-white/80 bg-white text-tds-dim hover:text-tds-text"
                  }`}
                >
                  {value}
                </button>
              ))}
              <span className="fin-chip">{formatTradeState(localTrade)}</span>
            </div>
          </div>

          <div className="mt-6">
            <PriceChart
              candles={candles}
              direction={localTrade.direction}
              entryPrice={localTrade.entry_price ?? undefined}
              stopLoss={localTrade.stop_loss ?? undefined}
              r2Target={localTrade.r2_target ?? undefined}
              r4Target={localTrade.r4_target ?? undefined}
              timeframe={chartTimeframe}
            />
          </div>
        </div>

        <div className="fin-panel p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="fin-kicker">Structured Journal</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Execution notes and review trail</h2>
            </div>
            {status ? <span className="fin-chip">{status}</span> : null}
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <label htmlFor="entry-journal" className="text-xs font-semibold uppercase tracking-[0.16em] text-tds-dim">Entry notes</label>
              <textarea
                id="entry-journal"
                value={entryJournal}
                onChange={(event) => setEntryJournal(event.target.value)}
                title="Entry notes"
                placeholder="Capture the pre-trade thesis, context, and execution plan."
                className={journalFieldClass}
              />
            </div>

            {showExitJournal ? (
              <div>
                <label htmlFor="exit-journal" className="text-xs font-semibold uppercase tracking-[0.16em] text-tds-dim">Exit notes</label>
                <textarea
                  id="exit-journal"
                  value={exitJournal}
                  onChange={(event) => setExitJournal(event.target.value)}
                  title="Exit notes"
                  placeholder="Document what confirmed the exit and how execution was handled."
                  className={journalFieldClass}
                />
              </div>
            ) : null}

            {showPostJournal ? (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="post-journal" className="text-xs font-semibold uppercase tracking-[0.16em] text-tds-dim">Post-trade review</label>
                  {duePostReview ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">Due</span> : null}
                </div>
                <textarea
                  id="post-journal"
                  value={postJournal}
                  onChange={(event) => setPostJournal(event.target.value)}
                  title="Post-trade review"
                  placeholder="Review what worked, what failed, and what should change next time."
                  className={journalFieldClass}
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
