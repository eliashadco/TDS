"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Clock3, Command, LayoutGrid, Radio, RefreshCw, Search, ShieldAlert } from "lucide-react";
import AnalyticsClient from "@/components/analytics/AnalyticsClient";
import PriceChart from "@/components/chart/PriceChart";
import { QuoteStatusBadge, QuoteStatusLegend } from "@/components/market/QuoteStatusBadge";
import { getCandleRange, getDefaultCandleTimeframe } from "@/lib/market/candle-range";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { resolveMetricAssessmentDescription } from "@/lib/trading/user-metrics";
import type { Candle, CandleTimeframe, QuoteDataStatus, QuoteProvider } from "@/types/market";
import type { Metric, Trade, TradeMode } from "@/types/trade";

type ActiveTradeAnalyticsView = {
  id: string;
  ticker: string;
  direction: "LONG" | "SHORT";
  source: "thesis" | "marketwatch";
  conviction: "MAX" | "HIGH" | "STD" | null;
  setupTypes: string[];
  thesis: string;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number | null;
  targetOne: number | null;
  targetTwo: number | null;
  targetThree: number | null;
  shares: number;
  createdAt: string | null;
  dayChange: number;
  dayChangePct: number;
  quoteStatus: QuoteDataStatus | null;
  quoteProvider: QuoteProvider | null;
  livePnl: number;
  livePnlPct: number;
  riskPct: number;
  strategyName: string;
  strategyDescription: string;
  strategyVersionNumber: number | null;
  strategyMetrics: Metric[];
  usesDefaultStrategyFallback: boolean;
};

type ActiveStrategyContextView = {
  name: string;
  description: string;
  versionNumber: number | null;
  metricCount: number;
};

type StrategyRefresh = {
  tradeId: string;
  score: number;
  passed: number;
  total: number;
  verdict: "GO" | "CAUTION" | "STOP";
  summary: string;
  edge?: string;
  risks?: string;
  fallback: boolean;
};

type PortfolioAnalyticsOverviewProps = {
  accountEquity: number | null;
  mode: TradeMode | null;
  activeStrategy: ActiveStrategyContextView;
  activeTrades: ActiveTradeAnalyticsView[];
  closedTrades: Trade[];
};

type TerminalEvent = {
  id: string;
  tradeId?: string;
  tone: "neutral" | "success" | "warn" | "danger";
  category: string;
  summary: string;
  detail?: string;
  timestampLabel: string;
  searchable: string;
};

type SearchablePanelState = "live" | "historical";

const TIMEFRAME_OPTIONS: Array<{ key: string; label: string; hint: string; value: CandleTimeframe }> = [
  { key: "1", label: "Intraday", hint: "1H", value: "hour" },
  { key: "2", label: "Session", hint: "1D", value: "day" },
  { key: "3", label: "Position", hint: "1W", value: "week" },
];

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function preciseMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function pct(value: number, digits = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function formatModeLabel(mode: TradeMode | null): string {
  if (!mode) {
    return "No lane selected";
  }

  if (mode === "daytrade") {
    return "Day Trade";
  }

  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function fallbackVerdict(score: number): StrategyRefresh["verdict"] {
  if (score >= 80) {
    return "GO";
  }
  if (score >= 60) {
    return "CAUTION";
  }
  return "STOP";
}

function fallbackScore(trade: ActiveTradeAnalyticsView): number {
  const pnlBias = Math.min(20, Math.abs(trade.livePnlPct) * 3);
  const riskBias = Math.max(0, 20 - trade.riskPct * 100 * 1.5);
  const convictionBias = trade.conviction === "MAX" ? 18 : trade.conviction === "HIGH" ? 12 : 7;
  const directionalBias = trade.livePnl >= 0 ? 15 : 5;

  return Math.max(35, Math.min(92, Math.round(25 + pnlBias + riskBias + convictionBias + directionalBias)));
}

function resolveBaseMode(mode: TradeMode | null): TradeMode {
  return mode ?? "swing";
}

function formatHoldDuration(createdAt: string | null): string {
  if (!createdAt) {
    return "Saved trade";
  }

  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    return "Saved trade";
  }

  const diff = Math.max(0, Date.now() - created.getTime());
  const days = Math.floor(diff / 86_400_000);

  if (days === 0) {
    return "Opened today";
  }
  if (days === 1) {
    return "1 day";
  }
  if (days < 14) {
    return `${days} days`;
  }

  const weeks = Math.round(days / 7);
  return `${weeks} wk`;
}

function getMarketStatus() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const minutes = hour * 60 + minute;
  const isWeekend = weekday === "Sat" || weekday === "Sun";

  if (isWeekend) {
    return { label: "Closed", tone: "bg-slate-400" };
  }
  if (minutes < 570) {
    return { label: "Pre-market", tone: "bg-amber-500" };
  }
  if (minutes <= 960) {
    return { label: "Open", tone: "bg-emerald-500" };
  }
  return { label: "After-hours", tone: "bg-sky-500" };
}

function buildSparklinePath(points: number[], width = 84, height = 28): string {
  if (points.length < 2) {
    return `M0 ${height / 2} L${width} ${height / 2}`;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point - min) / range) * (height - 4) - 2;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function approximateTarget(trade: ActiveTradeAnalyticsView, multiple: number): number | null {
  if (trade.direction === "LONG") {
    if (multiple === 2 && trade.targetTwo) {
      return trade.targetTwo;
    }
    if (multiple === 4 && trade.targetThree) {
      return trade.targetThree;
    }
  }

  if (trade.stopLoss == null) {
    return null;
  }

  const unitRisk = Math.abs(trade.entryPrice - trade.stopLoss);
  if (unitRisk <= 0) {
    return null;
  }

  if (trade.direction === "LONG") {
    return trade.entryPrice + unitRisk * multiple;
  }

  return trade.entryPrice - unitRisk * multiple;
}

function ToneDot({ tone }: { tone: TerminalEvent["tone"] }) {
  return (
    <span
      className={cn(
        "mt-1 inline-flex h-2.5 w-2.5 flex-none rounded-full",
        tone === "success" && "bg-emerald-500",
        tone === "warn" && "bg-amber-500",
        tone === "danger" && "bg-rose-500",
        tone === "neutral" && "bg-slate-400",
      )}
    />
  );
}

function MiniSparkline({ points, positive }: { points: number[]; positive: boolean }) {
  return (
    <svg viewBox="0 0 84 28" className="h-7 w-20 overflow-visible" aria-hidden="true">
      <path
        d={buildSparklinePath(points)}
        fill="none"
        stroke={positive ? "#059669" : "#dc2626"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeatGauge({ value, max = 12 }: { value: number; max?: number }) {
  const normalized = Math.max(0, Math.min(value / max, 1));
  const circumference = 113;
  const dashOffset = circumference - normalized * circumference;
  const tone = normalized >= 0.8 ? "#dc2626" : normalized >= 0.55 ? "#d97706" : "#059669";

  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <svg viewBox="0 0 48 48" className="h-24 w-24 -rotate-90">
        <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r="18"
          fill="none"
          stroke={tone}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="absolute text-center">
        <p className="font-mono text-lg font-semibold text-tds-text">{value.toFixed(1)}%</p>
        <p className="text-[10px] uppercase tracking-[0.16em] text-tds-dim">Heat</p>
      </div>
    </div>
  );
}

async function mapInBatches<T, TResult>(
  items: T[],
  batchSize: number,
  worker: (item: T) => Promise<TResult>,
): Promise<TResult[]> {
  const results: TResult[] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    results.push(...(await Promise.all(batch.map(worker))));
  }

  return results;
}

export default function PortfolioAnalyticsOverview({ accountEquity, mode, activeStrategy, activeTrades, closedTrades }: PortfolioAnalyticsOverviewProps) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const baseMode = resolveBaseMode(mode);
  const [refreshRows, setRefreshRows] = useState<Record<string, StrategyRefresh>>({});
  const [loading, setLoading] = useState(activeTrades.length > 0);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(activeTrades[0]?.id ?? null);
  const [watchlistQuery, setWatchlistQuery] = useState("");
  const [logQuery, setLogQuery] = useState("");
  const [historyView, setHistoryView] = useState<SearchablePanelState>("live");
  const [chartTimeframe, setChartTimeframe] = useState<CandleTimeframe>(() => getDefaultCandleTimeframe(baseMode));
  const [chartCandles, setChartCandles] = useState<Candle[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [miniSeries, setMiniSeries] = useState<Record<string, number[]>>({});
  const [realtimeEvents, setRealtimeEvents] = useState<TerminalEvent[]>([]);
  const [flashedTradeIds, setFlashedTradeIds] = useState<Record<string, boolean>>({});
  const tradeSearchRef = useRef<HTMLInputElement>(null);
  const logSearchRef = useRef<HTMLInputElement>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeTrades.some((trade) => trade.id === selectedTradeId)) {
      setSelectedTradeId(activeTrades[0]?.id ?? null);
    }
  }, [activeTrades, selectedTradeId]);

  const selectedTrade = useMemo(
    () => activeTrades.find((trade) => trade.id === selectedTradeId) ?? activeTrades[0] ?? null,
    [activeTrades, selectedTradeId],
  );

  useEffect(() => {
    if (!selectedTrade) {
      setChartCandles([]);
      return;
    }

    let isActive = true;

    async function loadCandles() {
      setChartLoading(true);
      const range = getCandleRange(baseMode, chartTimeframe);
      const params = new URLSearchParams({
        ticker: selectedTrade.ticker,
        from: range.from,
        to: range.to,
        timeframe: range.timeframe,
      });

      try {
        const response = await fetch(`/api/market/candles?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) {
          if (isActive) {
            setChartCandles([]);
          }
          return;
        }

        const data = (await response.json()) as Candle[];
        if (isActive) {
          const nextCandles = Array.isArray(data) ? data : [];

          if (nextCandles.length === 0 && chartTimeframe !== "day") {
            setChartTimeframe("day");
            return;
          }

          setChartCandles(nextCandles);
        }
      } catch {
        if (isActive) {
          setChartCandles([]);
        }
      } finally {
        if (isActive) {
          setChartLoading(false);
        }
      }
    }

    void loadCandles();

    return () => {
      isActive = false;
    };
  }, [baseMode, chartTimeframe, selectedTrade]);

  useEffect(() => {
    if (activeTrades.length === 0) {
      setMiniSeries({});
      return;
    }

    let isActive = true;

    async function loadMiniSeries() {
      const to = new Date();
      const from = new Date(to);
      from.setDate(from.getDate() - 45);

      const entries = await Promise.all(
        activeTrades.map(async (trade) => {
          const params = new URLSearchParams({
            ticker: trade.ticker,
            from: from.toISOString().slice(0, 10),
            to: to.toISOString().slice(0, 10),
            timeframe: "day",
          });

          try {
            const response = await fetch(`/api/market/candles?${params.toString()}`, { cache: "no-store" });
            if (!response.ok) {
              return [trade.id, []] as const;
            }

            const data = (await response.json()) as Candle[];
            return [trade.id, Array.isArray(data) ? data.slice(-12).map((candle) => candle.close) : []] as const;
          } catch {
            return [trade.id, []] as const;
          }
        }),
      );

      if (isActive) {
        setMiniSeries(Object.fromEntries(entries));
      }
    }

    void loadMiniSeries();

    return () => {
      isActive = false;
    };
  }, [activeTrades]);

  useEffect(() => {
    let isActive = true;

    async function refreshStrategies() {
      if (activeTrades.length === 0) {
        setRefreshRows({});
        setLoading(false);
        return;
      }

      setLoading(true);

      const rows = await mapInBatches(activeTrades, 4, async (trade) => {
        const metrics = trade.strategyMetrics.filter((metric) => metric.enabled);

        if (metrics.length === 0) {
          return {
            tradeId: trade.id,
            score: 0,
            passed: 0,
            total: 0,
            verdict: "STOP",
            summary: `${trade.ticker} has no enabled checks saved in its assigned strategy, so the refresh could not be run.`,
            risks: "Reopen the strategy and restore at least one enabled check before relying on follow-up analytics.",
            fallback: true,
          } satisfies StrategyRefresh;
        }

          try {
            const assessResponse = await fetch("/api/ai/assess", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ticker: trade.ticker,
                direction: trade.direction,
                thesis: trade.thesis || `${trade.ticker} active trade follow-up review.`,
                setups: trade.setupTypes.length > 0 ? trade.setupTypes : [mode ? `${formatModeLabel(mode)} active strategy` : "Account-wide active trade review"],
                asset: "Equity",
                mode: mode ?? undefined,
                metrics: metrics.map((metric) => ({
                  id: metric.id,
                  name: metric.name,
                  desc: resolveMetricAssessmentDescription(metric, trade.direction),
                })),
              }),
            });

            if (!assessResponse.ok) {
              throw new Error("Assessment unavailable");
            }

            const assessPayload = (await assessResponse.json()) as Record<string, { v: "PASS" | "FAIL"; r: string }>;
            const passedMetrics = metrics.filter((metric) => assessPayload[metric.id]?.v === "PASS").map((metric) => metric.name);
            const failedMetrics = metrics.filter((metric) => assessPayload[metric.id]?.v === "FAIL").map((metric) => metric.name);
            const passed = passedMetrics.length;
            const total = metrics.length;
            const score = total > 0 ? Math.round((passed / total) * 100) : 0;

            let verdict: StrategyRefresh["verdict"] = score >= 80 ? "GO" : score >= 60 ? "CAUTION" : "STOP";
            let summary = `${trade.ticker} refreshed against ${trade.strategyName}${trade.strategyVersionNumber ? ` v${trade.strategyVersionNumber}` : ""}.`;
            let edge: string | undefined;
            let risks: string | undefined;

            try {
              const insightResponse = await fetch("/api/ai/insight", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ticker: trade.ticker,
                  direction: trade.direction,
                  passed: passedMetrics,
                  failed: failedMetrics,
                  thesis: trade.thesis || `${trade.ticker} active trade follow-up review.`,
                }),
              });

              if (insightResponse.ok) {
                const insight = (await insightResponse.json()) as { verdict: "GO" | "CAUTION" | "STOP"; summary: string; edge?: string; risks?: string };
                verdict = insight.verdict;
                summary = insight.summary;
                edge = insight.edge;
                risks = insight.risks;
              }
            } catch {
              // Fall back to the strategy score summary below.
            }

            return {
              tradeId: trade.id,
              score,
              passed,
              total,
              verdict,
              summary,
              edge,
              risks,
              fallback: false,
            } satisfies StrategyRefresh;
          } catch {
            const score = fallbackScore(trade);
            return {
              tradeId: trade.id,
              score,
              passed: 0,
              total: trade.strategyMetrics.length,
              verdict: fallbackVerdict(score),
              summary: `${trade.ticker} strategy refresh fell back to live performance, risk load, and conviction because AI follow-up for ${trade.strategyName} is unavailable right now.`,
              risks: trade.livePnl < 0 ? "Negative live P&L needs review before adding size." : "No AI risk summary available.",
              fallback: true,
            } satisfies StrategyRefresh;
          }
      });

      if (!isActive) {
        return;
      }

      setRefreshRows(
        rows.reduce<Record<string, StrategyRefresh>>((acc, row) => {
          acc[row.tradeId] = row;
          return acc;
        }, {}),
      );
      setLoading(false);
    }

    void refreshStrategies();

    return () => {
      isActive = false;
    };
  }, [activeTrades, mode]);

  useEffect(() => {
    const activeTradeIds = new Set(activeTrades.map((trade) => trade.id));
    const channel = supabase
      .channel("portfolio-analytics-trades")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trades" },
        (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          const tradeId = String(payload.new?.id ?? payload.old?.id ?? "");
          if (!tradeId || !activeTradeIds.has(tradeId)) {
            return;
          }

          setFlashedTradeIds((current) => ({ ...current, [tradeId]: true }));
          setTimeout(() => {
            setFlashedTradeIds((current) => {
              const next = { ...current };
              delete next[tradeId];
              return next;
            });
          }, 900);

          setRealtimeEvents((current) => {
            const nextEvent: TerminalEvent = {
              id: `${payload.eventType}-${tradeId}-${Date.now()}`,
              tradeId,
              tone: payload.eventType === "DELETE" ? "danger" : "neutral",
              category: payload.eventType,
              summary: `${payload.eventType === "INSERT" ? "New trade landed in the live book" : payload.eventType === "UPDATE" ? "Trade snapshot refreshed" : "Trade left the live book"}`,
              detail: `Trade ${tradeId} triggered a live workspace refresh.`,
              timestampLabel: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              searchable: `${payload.eventType} ${tradeId}`,
            };
            return [nextEvent, ...current].slice(0, 12);
          });

          if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
          }

          refreshTimerRef.current = setTimeout(() => {
            router.refresh();
          }, 300);
        },
      )
      .subscribe();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [activeTrades, router, supabase]);

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        tradeSearchRef.current?.focus();
        return;
      }

      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !isEditableTarget(event.target)) {
        event.preventDefault();
        logSearchRef.current?.focus();
        return;
      }

      if (event.key === "Escape") {
        setSelectedTradeId(null);
        setHistoryView("live");
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      const timeframeMap: Record<string, CandleTimeframe> = {
        "1": "hour",
        "2": "day",
        "3": "week",
      };

      if (timeframeMap[event.key]) {
        setChartTimeframe(timeframeMap[event.key]);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const aggregatePnl = activeTrades.reduce((sum, trade) => sum + trade.livePnl, 0);
  const deployedCapital = activeTrades.reduce((sum, trade) => sum + trade.entryPrice * trade.shares, 0);
  const buyingPower = accountEquity != null ? accountEquity - deployedCapital : null;
  const portfolioHeat = activeTrades.reduce((sum, trade) => sum + trade.riskPct * 100, 0);
  const aggregateDayDelta = activeTrades.reduce(
    (sum, trade) => sum + (trade.direction === "LONG" ? trade.dayChange : trade.dayChange * -1) * trade.shares,
    0,
  );
  const aggregateDayDeltaPct = accountEquity && accountEquity > 0 ? (aggregateDayDelta / accountEquity) * 100 : 0;
  const averageScore = average(Object.values(refreshRows).map((row) => row.score));
  const goCount = Object.values(refreshRows).filter((row) => row.verdict === "GO").length;
  const legacyFallbackCount = activeTrades.filter((trade) => trade.usesDefaultStrategyFallback).length;
  const marketStatus = getMarketStatus();

  const filteredTrades = activeTrades.filter((trade) => {
    const search = watchlistQuery.trim().toLowerCase();
    if (!search) {
      return true;
    }

    return [trade.ticker, trade.strategyName, trade.thesis, trade.direction].join(" ").toLowerCase().includes(search);
  });

  const selectedRefresh = selectedTrade ? refreshRows[selectedTrade.id] : null;

  const compositionRows = [
    { label: "Thesis", value: activeTrades.filter((trade) => trade.source === "thesis").length, tone: "bg-blue-500" },
    { label: "MarketWatch", value: activeTrades.filter((trade) => trade.source === "marketwatch").length, tone: "bg-amber-500" },
    { label: "Long", value: activeTrades.filter((trade) => trade.direction === "LONG").length, tone: "bg-emerald-500" },
    { label: "Short", value: activeTrades.filter((trade) => trade.direction === "SHORT").length, tone: "bg-rose-500" },
  ].filter((row) => row.value > 0);

  const scatterTrades = activeTrades.slice(0, 8);

  const terminalEvents = [
    ...realtimeEvents,
    ...activeTrades.flatMap<TerminalEvent>((trade) => {
      const refresh = refreshRows[trade.id];
      const events: TerminalEvent[] = [];

      if (refresh) {
        events.push({
          id: `refresh-${trade.id}`,
          tradeId: trade.id,
          tone: refresh.verdict === "GO" ? "success" : refresh.verdict === "CAUTION" ? "warn" : "danger",
          category: "Refresh",
          summary: `${trade.ticker} scored ${refresh.score} with a ${refresh.verdict.toLowerCase()} verdict.`,
          detail: refresh.summary,
          timestampLabel: "Live",
          searchable: `${trade.ticker} ${refresh.verdict} ${refresh.summary}`,
        });
      }

      if (trade.quoteStatus && trade.quoteStatus !== "live") {
        events.push({
          id: `quote-${trade.id}`,
          tradeId: trade.id,
          tone: "warn",
          category: "Quote",
          summary: `${trade.ticker} is running on ${trade.quoteStatus} quote data.`,
          detail: "Keep sizing and exit decisions conservative until live data resumes.",
          timestampLabel: "Feed",
          searchable: `${trade.ticker} ${trade.quoteStatus} quote`,
        });
      }

      if (trade.usesDefaultStrategyFallback) {
        events.push({
          id: `fallback-${trade.id}`,
          tradeId: trade.id,
          tone: "warn",
          category: "Lane",
          summary: `${trade.ticker} is using the default strategy lane as a legacy fallback.`,
          detail: "Restore a saved strategy snapshot if this trade should keep its original checks.",
          timestampLabel: "Legacy",
          searchable: `${trade.ticker} fallback legacy strategy`,
        });
      }

      return events;
    }),
  ].filter((event) => {
    const search = logQuery.trim().toLowerCase();
    if (!search) {
      return true;
    }

    return `${event.category} ${event.summary} ${event.detail ?? ""} ${event.searchable}`.toLowerCase().includes(search);
  });

  return (
    <div className="analytics-terminal trade-terminal analytics-cockpit flex flex-col gap-3 xl:h-[calc(100vh-12.25rem)]">
      <section className="surface-panel overflow-hidden rounded-[28px] border border-white/70 bg-white/90 px-4 py-3.5 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.32)] backdrop-blur-sm sm:px-4.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="meta-label">Portfolio Follow-Up Terminal</p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.05em] text-tds-text sm:text-2xl">Command ribbon for the live book</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-tds-dim">
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono"><Command className="h-3 w-3" />K search</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono">/ log</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono">1-3 frames</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono">Esc clear</span>
          </div>
        </div>

        <div className="mt-3 grid gap-2.5 lg:grid-cols-[1.35fr_repeat(5,minmax(0,1fr))]">
          <article className="rounded-[24px] border border-slate-200 bg-slate-950 px-4 py-3.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/60">Portfolio value</p>
            <div className="mt-2.5 flex flex-wrap items-end justify-between gap-3">
              <strong className="font-mono text-[1.7rem] font-semibold tracking-[-0.04em] sm:text-3xl">{accountEquity != null ? money(accountEquity) : "--"}</strong>
              <div className="text-right">
                <p className={cn("font-mono text-base", aggregateDayDelta >= 0 ? "text-emerald-400" : "text-rose-400")}>{aggregateDayDelta >= 0 ? "+" : "-"}{money(Math.abs(aggregateDayDelta))}</p>
                <p className="font-mono text-xs text-white/55">{pct(aggregateDayDeltaPct)}</p>
              </div>
            </div>
          </article>

          <article className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3.5">
            <p className="meta-label">Open trades</p>
            <strong className="mt-2.5 block font-mono text-[1.55rem] text-tds-text">{activeTrades.length}</strong>
            <p className="mt-1.5 text-xs text-tds-dim">{goCount} GO verdict{goCount === 1 ? "" : "s"}</p>
          </article>

          <article className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3.5">
            <p className="meta-label">Live P&amp;L</p>
            <strong className={cn("mt-2.5 block font-mono text-[1.55rem]", aggregatePnl >= 0 ? "text-tds-green" : "text-tds-red")}>{aggregatePnl >= 0 ? "+" : "-"}{money(Math.abs(aggregatePnl))}</strong>
            <p className="mt-1.5 text-xs text-tds-dim">{averageScore > 0 ? `${averageScore.toFixed(0)} avg strategy score` : "Refreshing strategy scores"}</p>
          </article>

          <article className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3.5">
            <p className="meta-label">Deployed capital</p>
            <strong className="mt-2.5 block font-mono text-[1.55rem] text-tds-text">{money(deployedCapital)}</strong>
            <p className="mt-1.5 text-xs text-tds-dim">Buying power {buyingPower != null ? money(Math.max(buyingPower, 0)) : "--"}</p>
          </article>

          <article className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3.5">
            <p className="meta-label">Portfolio heat</p>
            <strong className={cn("mt-2.5 block font-mono text-[1.55rem]", portfolioHeat > 8 ? "text-tds-red" : portfolioHeat > 5 ? "text-tds-amber" : "text-tds-green")}>{portfolioHeat.toFixed(1)}%</strong>
            <p className="mt-1.5 text-xs text-tds-dim">Risk load across the active book</p>
          </article>

          <article className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3.5">
            <p className="meta-label">Market status</p>
            <div className="mt-2.5 flex items-center gap-2 font-mono text-[1.55rem] text-tds-text">
              <span className={cn("inline-flex h-3 w-3 rounded-full", marketStatus.tone)} />
              <strong>{marketStatus.label}</strong>
            </div>
            <p className="mt-1.5 text-xs text-tds-dim">Lane {formatModeLabel(mode)} · {activeStrategy.metricCount} checks live</p>
          </article>
        </div>
      </section>

      <section className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_380px]">
        <aside className="surface-panel flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/90 p-3.5 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.28)] xl:p-3.5 2xl:p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="meta-label">Watchlist and active operations</p>
              <h3 className="mt-1 text-lg font-semibold tracking-[-0.04em] text-tds-text">Selected book</h3>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-tds-dim"><Search className="h-3 w-3" /> Scan</span>
          </div>

          <label className="mt-3 flex items-center gap-2 rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-tds-dim">
            <Search className="h-4 w-4" />
            <input
              ref={tradeSearchRef}
              value={watchlistQuery}
              onChange={(event) => setWatchlistQuery(event.target.value)}
              placeholder="Search ticker, strategy, thesis"
              className="w-full bg-transparent font-mono text-sm text-tds-text outline-none placeholder:text-tds-dim"
            />
          </label>

          <div className="mt-3 flex-1 space-y-2.5 overflow-y-auto pr-1">
            {filteredTrades.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-tds-dim">No active trades match the current watchlist filter.</div>
            ) : (
              filteredTrades.map((trade) => {
                const refresh = refreshRows[trade.id];
                const isSelected = selectedTrade?.id === trade.id;
                const sparkPoints = miniSeries[trade.id] ?? [];

                return (
                  <div
                    key={trade.id}
                    className={cn(
                      "rounded-[24px] border bg-white px-3 py-2.5 transition",
                      isSelected ? "border-slate-900 shadow-[0_20px_45px_-38px_rgba(15,23,42,0.55)]" : "border-slate-200 hover:border-slate-300",
                      flashedTradeIds[trade.id] && "ring-2 ring-blue-200",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" onClick={() => setSelectedTradeId(trade.id)} className="min-w-0 flex-1 text-left">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", trade.direction === "LONG" ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600")}>{trade.direction}</span>
                          <span className="font-mono text-base font-semibold text-tds-text">{trade.ticker}</span>
                          <QuoteStatusBadge status={trade.quoteStatus ?? null} provider={trade.quoteProvider ?? null} />
                        </div>
                        <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                          <div>
                            <p className="font-mono text-xs text-tds-dim">Entry {preciseMoney(trade.entryPrice)}</p>
                            <p className="mt-1 font-mono text-xs text-tds-dim">Current {preciseMoney(trade.currentPrice)}</p>
                          </div>
                          <div className="text-right">
                            <p className={cn("font-mono text-sm font-semibold", trade.livePnl >= 0 ? "text-tds-green" : "text-tds-red")}>{trade.livePnl >= 0 ? "+" : "-"}{money(Math.abs(trade.livePnl))}</p>
                            <p className="font-mono text-[11px] text-tds-dim">{pct(trade.livePnlPct)}</p>
                          </div>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between gap-3">
                          <MiniSparkline points={sparkPoints} positive={trade.livePnl >= 0} />
                          <div className="text-right">
                            <p className="font-mono text-[11px] text-tds-dim">Risk {(trade.riskPct * 100).toFixed(2)}%</p>
                            <p className="font-mono text-[11px] text-tds-dim">Hold {formatHoldDuration(trade.createdAt)}</p>
                          </div>
                        </div>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-tds-dim">
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{trade.source === "marketwatch" ? "MarketWatch" : "Thesis"}</span>
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{refresh?.verdict ?? "Pending"}</span>
                        </div>
                      </button>

                      <Link href={`/trade/${trade.id}`} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-tds-text transition hover:bg-white">
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <section className="surface-panel flex min-h-0 flex-col overflow-y-auto rounded-[28px] border border-white/70 bg-white/90 p-3.5 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.28)] xl:p-3.5 2xl:p-4">
          {selectedTrade ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="meta-label">Selected instrument</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h3 className="text-[1.8rem] font-semibold tracking-[-0.05em] text-tds-text xl:text-[2rem]">{selectedTrade.ticker}</h3>
                    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", selectedTrade.direction === "LONG" ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600")}>{selectedTrade.direction}</span>
                    {selectedTrade.conviction ? <span className="inline-tag neutral">{selectedTrade.conviction}</span> : null}
                    <QuoteStatusBadge status={selectedTrade.quoteStatus ?? null} provider={selectedTrade.quoteProvider ?? null} />
                  </div>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-tds-dim">{selectedTrade.strategyName}{selectedTrade.strategyVersionNumber ? ` v${selectedTrade.strategyVersionNumber}` : ""} · {selectedTrade.strategyMetrics.length} saved checks · {formatHoldDuration(selectedTrade.createdAt)}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {TIMEFRAME_OPTIONS.map((item) => (
                    <button
                      key={`${item.key}-${item.label}`}
                      type="button"
                      onClick={() => setChartTimeframe(item.value)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-left transition",
                        chartTimeframe === item.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-tds-dim hover:bg-white",
                      )}
                    >
                      <span className="block font-mono text-[10px] uppercase tracking-[0.16em]">{item.key} {item.hint}</span>
                      <span className="mt-0.5 block text-xs font-semibold uppercase tracking-[0.08em]">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 grid gap-3 2xl:grid-cols-[minmax(0,1fr)_220px]">
                <div className="flex flex-col rounded-[26px] border border-slate-200 bg-slate-950 p-2.5 text-white">
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3 px-2 pt-1">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">Focused context chart</p>
                      <p className="mt-1 text-sm text-white/70">Entry and stop overlays remain pinned to the selected trade.</p>
                    </div>
                    <Link href={`/trade/${selectedTrade.id}`} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-white transition hover:bg-white/10">
                      Open trade
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>

                  <div className="h-[340px] overflow-hidden rounded-[22px] border border-white/10 bg-black/20 p-2">
                    {chartLoading ? (
                      <div className="flex h-full items-center justify-center rounded-[20px] border border-white/10 bg-white/5 text-sm text-white/60">
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading market structure...
                      </div>
                    ) : (
                      <PriceChart
                        candles={chartCandles}
                        entryPrice={selectedTrade.entryPrice}
                        stopLoss={selectedTrade.stopLoss ?? undefined}
                        r2Target={approximateTarget(selectedTrade, 2) ?? undefined}
                        r4Target={approximateTarget(selectedTrade, 4) ?? undefined}
                        direction={selectedTrade.direction}
                        timeframe={chartTimeframe}
                        height={340}
                      />
                    )}
                  </div>
                </div>

                <div className="grid gap-2.5">
                  <article className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3.5">
                    <p className="meta-label">Live price</p>
                    <strong className="mt-3 block font-mono text-2xl text-tds-text">{preciseMoney(selectedTrade.currentPrice)}</strong>
                    <p className="mt-2 font-mono text-xs text-tds-dim">Day {pct(selectedTrade.dayChangePct)} · {preciseMoney(selectedTrade.dayChange)}</p>
                  </article>

                  <article className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3.5">
                    <p className="meta-label">Execution strip</p>
                    <dl className="mt-3 space-y-2 text-sm text-tds-dim">
                      <div className="flex items-center justify-between gap-3"><dt>Entry</dt><dd className="font-mono text-tds-text">{preciseMoney(selectedTrade.entryPrice)}</dd></div>
                      <div className="flex items-center justify-between gap-3"><dt>Stop</dt><dd className="font-mono text-tds-text">{selectedTrade.stopLoss != null ? preciseMoney(selectedTrade.stopLoss) : "--"}</dd></div>
                      <div className="flex items-center justify-between gap-3"><dt>Target</dt><dd className="font-mono text-tds-text">{approximateTarget(selectedTrade, 2) != null ? preciseMoney(approximateTarget(selectedTrade, 2) ?? 0) : "--"}</dd></div>
                      <div className="flex items-center justify-between gap-3"><dt>Heat</dt><dd className="font-mono text-tds-text">{(selectedTrade.riskPct * 100).toFixed(2)}%</dd></div>
                      <div className="flex items-center justify-between gap-3"><dt>Hold</dt><dd className="font-mono text-tds-text">{formatHoldDuration(selectedTrade.createdAt)}</dd></div>
                    </dl>
                  </article>

                  <article className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3.5">
                    <p className="meta-label">P&amp;L</p>
                    <strong className={cn("mt-3 block font-mono text-2xl", selectedTrade.livePnl >= 0 ? "text-tds-green" : "text-tds-red")}>{selectedTrade.livePnl >= 0 ? "+" : "-"}{money(Math.abs(selectedTrade.livePnl))}</strong>
                    <p className="mt-2 font-mono text-xs text-tds-dim">{pct(selectedTrade.livePnlPct)} · {selectedTrade.shares} shares</p>
                  </article>
                </div>
              </div>

              <div className="mt-3 grid gap-3 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <article className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3.5">
                  <p className="meta-label">Trade thesis</p>
                  <p className="mt-3 text-sm leading-6 text-tds-text">{selectedTrade.thesis || `${selectedTrade.ticker} remains in the active book without a saved thesis summary.`}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedTrade.setupTypes.length > 0 ? selectedTrade.setupTypes.slice(0, 4).map((setup) => <span key={setup} className="inline-tag neutral">{setup}</span>) : <span className="inline-tag neutral">No saved setup tags</span>}
                  </div>
                </article>

                <article className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3.5">
                  <p className="meta-label">Follow-up verdict</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", selectedRefresh?.verdict === "GO" ? "bg-emerald-500/10 text-emerald-600" : selectedRefresh?.verdict === "CAUTION" ? "bg-amber-500/10 text-amber-600" : "bg-rose-500/10 text-rose-600")}>{selectedRefresh?.verdict ?? "PENDING"}</span>
                    <span className="inline-tag neutral">{selectedRefresh ? `${selectedRefresh.passed}/${selectedRefresh.total} passed` : "Refreshing"}</span>
                    {selectedRefresh?.fallback ? <span className="inline-tag neutral">Fallback</span> : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-tds-text">{selectedRefresh?.summary ?? `Refreshing ${selectedTrade.strategyName} against live conditions...`}</p>
                  {selectedRefresh?.risks ? <p className="mt-2 text-xs leading-5 text-tds-dim">Risk: {selectedRefresh.risks}</p> : null}
                </article>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
              <LayoutGrid className="h-10 w-10 text-slate-400" />
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.04em] text-tds-text">No active ticker is selected</h3>
              <p className="mt-3 max-w-xl text-sm leading-6 text-tds-dim">Clear and compatible with the current platform means the center panel stays operational. Open positions will appear here as soon as the live book has a trade to inspect.</p>
            </div>
          )}
        </section>

        <aside className="surface-panel flex min-h-0 flex-col overflow-y-auto rounded-[28px] border border-white/70 bg-white/90 p-3.5 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.28)] xl:col-span-2 xl:p-3.5 2xl:col-span-1 2xl:p-4">
          <article className="rounded-[26px] border border-slate-200 bg-slate-950 px-4 py-3.5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">Strategy thesis monitor</p>
                <h3 className="mt-1 text-lg font-semibold tracking-[-0.04em]">Current scoring lane</h3>
              </div>
              <HeatGauge value={portfolioHeat} />
            </div>
            <div className="mt-4 space-y-2 text-sm text-white/72">
              <p>{activeStrategy.name}{activeStrategy.versionNumber != null ? ` · v${activeStrategy.versionNumber}` : ""}</p>
              <p>{activeStrategy.description}</p>
              <p>{legacyFallbackCount > 0 ? `${legacyFallbackCount} legacy fallback trade${legacyFallbackCount === 1 ? "" : "s"} still depend on the default lane.` : "Every active trade is reading from a saved strategy snapshot."}</p>
            </div>
          </article>

          <div className="mt-3 grid min-h-0 flex-1 gap-2.5 sm:grid-cols-2">
            <article className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3.5">
              <p className="meta-label">Book mix</p>
              <div className="mt-4 space-y-3">
                {compositionRows.length > 0 ? compositionRows.map((row) => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between gap-3 text-sm text-tds-dim"><span>{row.label}</span><span className="font-mono text-tds-text">{row.value}</span></div>
                    <div className="mt-2 h-2 rounded-full bg-slate-200">
                      <div className={cn("h-2 rounded-full", row.tone)} style={{ width: `${(row.value / Math.max(activeTrades.length, 1)) * 100}%` }} />
                    </div>
                  </div>
                )) : <p className="text-sm text-tds-dim">Open a live trade to build the active-book composition map.</p>}
              </div>
            </article>

            <article className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3.5">
              <p className="meta-label">Risk / reward scatter</p>
              {scatterTrades.length > 0 ? (
                <div className="relative mt-4 h-40 rounded-[18px] border border-slate-200 bg-white">
                  <div className="absolute inset-x-3 top-1/2 border-t border-dashed border-slate-200" />
                  <div className="absolute inset-y-3 left-1/2 border-l border-dashed border-slate-200" />
                  {scatterTrades.map((trade) => {
                    const left = Math.min(92, Math.max(6, trade.riskPct * 100 * 6));
                    const top = Math.min(88, Math.max(8, 50 - trade.livePnlPct * 3));
                    return (
                      <span
                        key={trade.id}
                        className={cn("absolute inline-flex h-8 min-w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full px-2 font-mono text-[10px] font-semibold text-white", trade.livePnl >= 0 ? "bg-emerald-500" : "bg-rose-500")}
                        style={{ left: `${left}%`, top: `${top}%` }}
                      >
                        {trade.ticker}
                      </span>
                    );
                  })}
                </div>
              ) : <p className="mt-4 text-sm text-tds-dim">Risk / reward points populate when active positions are available.</p>}
            </article>

            <article className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3.5">
              <p className="meta-label">Correlation grid</p>
              <div className="mt-4 rounded-[18px] border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-tds-dim">
                Correlation stays visible as a required panel, but this platform does not persist sector or rolling return series yet. Keep it in an operational empty state until a market-relative series feed is added.
              </div>
            </article>

            <article className="flex min-h-0 flex-col rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <p className="meta-label">Terminal log</p>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-tds-dim"><Radio className="h-3 w-3" /> Live</span>
              </div>
              <label className="mt-3 flex items-center gap-2 rounded-[16px] border border-slate-200 bg-white px-3 py-2 text-sm text-tds-dim">
                <Search className="h-4 w-4" />
                <input
                  ref={logSearchRef}
                  value={logQuery}
                  onChange={(event) => setLogQuery(event.target.value)}
                  placeholder="Search logs"
                  className="w-full bg-transparent font-mono text-sm text-tds-text outline-none placeholder:text-tds-dim"
                />
              </label>
              <div className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
                {terminalEvents.length > 0 ? terminalEvents.map((event) => (
                  <div key={event.id} className="rounded-[18px] border border-slate-200 bg-white px-3 py-3">
                    <div className="flex items-start gap-3">
                      <ToneDot tone={event.tone} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-tds-dim">{event.category}</p>
                          <span className="font-mono text-[11px] text-tds-dim">{event.timestampLabel}</span>
                        </div>
                        <p className="mt-1 text-sm leading-5 text-tds-text">{event.summary}</p>
                        {event.detail ? <p className="mt-1 text-xs leading-5 text-tds-dim">{event.detail}</p> : null}
                      </div>
                    </div>
                  </div>
                )) : <p className="rounded-[18px] border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-tds-dim">No log events match the current filter.</p>}
              </div>
            </article>
          </div>

          <div className="mt-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-tds-dim">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              <span>Mode {formatModeLabel(mode)} · {legacyFallbackCount > 0 ? `${legacyFallbackCount} fallback trade${legacyFallbackCount === 1 ? "" : "s"}` : "Snapshot-native live book"}</span>
            </div>
            <QuoteStatusLegend className="pt-3" />
          </div>
        </aside>
      </section>

      <section className={cn("surface-panel rounded-[28px] border border-white/70 bg-white/90 px-4 py-3.5 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.28)]", historyView === "historical" ? "overflow-hidden xl:h-[27vh] min-h-[260px]" : "overflow-visible") }>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="meta-label">Historical compression layer</p>
            <h3 className="mt-1 text-lg font-semibold tracking-[-0.04em] text-tds-text">Keep past performance secondary to current execution</h3>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1">
            <button type="button" onClick={() => setHistoryView("live")} className={cn("rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] transition", historyView === "live" ? "bg-slate-900 text-white" : "text-tds-dim")}>Live Focus</button>
            <button type="button" onClick={() => setHistoryView("historical")} className={cn("rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] transition", historyView === "historical" ? "bg-slate-900 text-white" : "text-tds-dim")}>Historical Review</button>
          </div>
        </div>

        {historyView === "historical" ? (
          <div className="mt-3 h-[calc(100%-4.25rem)] overflow-y-auto pr-1">
            <AnalyticsClient closedTrades={closedTrades} showHero={false} />
          </div>
        ) : (
          <div className="mt-2.5 flex items-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-tds-dim">
            <Clock3 className="h-4 w-4" /> Historical metrics stay docked until you deliberately switch into review mode.
          </div>
        )}
      </section>
    </div>
  );
}