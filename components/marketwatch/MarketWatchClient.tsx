"use client";

import { type DragEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, ListChecks, Radar, ShieldCheck, Sparkles, X } from "lucide-react";
import { QuoteStatusLegend } from "@/components/market/QuoteStatusBadge";
import InstrumentPreviewDrawer, { type StrategySelectionOption } from "@/components/marketwatch/InstrumentPreviewDrawer";
import MoversTable from "@/components/marketwatch/MoversTable";
import ScoredList, { type ScoredMover } from "@/components/marketwatch/ScoredList";
import { broadcastMarketDataRefresh, formatMarketDataRefreshTime, getStoredMarketDataRefreshToken } from "@/lib/market/refresh";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildStrategySnapshot,
  metricsFromStrategySnapshot,
  parseStrategySnapshot,
  updateStrategySnapshotStructure,
} from "@/lib/trading/strategies";
import { getMetricDefinition } from "@/lib/trading/presets";
import { calculatePosition, getConviction } from "@/lib/trading/scoring";
import { resolveMetricAssessmentDescription } from "@/lib/trading/user-metrics";
import type { Database, Json } from "@/types/database";
import type { SavedStrategy, StrategySnapshot } from "@/types/strategy";
import type { ConvictionTier, Metric, TradeMode } from "@/types/trade";
import type { Mover, Quote } from "@/types/market";

type FilterTab = "all" | "gainers" | "losers";

type MarketWatchClientProps = {
  userId: string;
  mode: TradeMode;
  equity: number;
  strategies: SavedStrategy[];
  defaultStrategyId: string | null;
};

type FeedState = {
  status: "live" | "fallback" | "empty";
  source: string;
  message: string;
  asOf?: number;
} | null;

type WatchlistItemView = {
  id: string;
  ticker: string;
  direction: "LONG" | "SHORT";
  verdict: string | null;
  note: string | null;
  source: string | null;
  lastScoredAt: string | null;
  strategyId: string | null;
  strategyVersionId: string | null;
  strategyName: string | null;
  strategySnapshot: StrategySnapshot | null;
  scorePayload: Record<string, unknown>;
  workbench: ScoredMover | null;
};

type HistoricalStrategyRow = {
  id: string;
  strategy_id: string | null;
  strategy_version_id: string | null;
  strategy_name: string | null;
  strategy_snapshot: Json | null;
  direction: "LONG" | "SHORT";
  setup_types: string[] | null;
  conditions: string[] | null;
  chart_pattern: string | null;
  thesis: string;
  scores: unknown;
  conviction: "MAX" | "HIGH" | "STD" | null;
  created_at: string;
};

type FeedQuality = {
  label: string;
  detail: string;
};

function calculateActivityScore(price: number, changePct: number, volumeValue: number): number {
  const dollarFlowScore = Math.log10(Math.max(price * volumeValue, 1));
  const volumeScore = Math.log10(Math.max(volumeValue, 1));
  const moveScore = Math.min(Math.abs(changePct), 20);
  const liquidityPenalty = price < 1 ? 0.58 : price < 5 ? 0.82 : 1;

  return Number((((dollarFlowScore * 1.35) + volumeScore + (moveScore * 0.7)) * liquidityPenalty).toFixed(3));
}

function compareMovers(left: Mover, right: Mover): number {
  return (right.activityScore ?? 0) - (left.activityScore ?? 0) || right.volumeValue - left.volumeValue || Math.abs(right.changePct) - Math.abs(left.changePct);
}

function mergeMovers(existing: Mover[], incoming: Mover[]): Mover[] {
  const byTicker = new Map<string, Mover>();

  existing.forEach((mover) => {
    byTicker.set(mover.ticker, mover);
  });

  incoming.forEach((mover) => {
    byTicker.set(mover.ticker, mover);
  });

  return Array.from(byTicker.values()).sort(compareMovers);
}

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
}

function asStringArray(input: unknown): string[] {
  return Array.isArray(input) ? input.filter((value): value is string => typeof value === "string") : [];
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNumberMap(input: unknown): Record<string, 0 | 1> {
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

function asStringMap(input: unknown): Record<string, string> {
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

function formatMetricFallbackLabel(metricId: string): string {
  return metricId
    .replace(/^[ft]_/, "")
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatModeLabel(mode: TradeMode): string {
  if (mode === "daytrade") {
    return "Day Trade";
  }
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function formatCompactVolume(volume: number): string {
  if (!Number.isFinite(volume) || volume <= 0) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(volume);
}

function buildTriggerLevel(price: number | null, direction: "LONG" | "SHORT", mode: TradeMode): number | null {
  if (price == null || !Number.isFinite(price) || price <= 0) {
    return null;
  }

  const offset = mode === "investment" ? 0.012 : mode === "swing" ? 0.006 : 0.003;
  return Number((direction === "LONG" ? price * (1 + offset) : price * (1 - offset)).toFixed(2));
}

function normalizeMover(input: unknown): Mover {
  const value = asRecord(input);
  const price = toNumber(value.price);
  const changePct = toNumber(value.changePct ?? value.change_pct);
  const volumeValue = toNumber(value.volumeValue ?? value.volume_value);
  const change = toNumber(value.change ?? (price > 0 ? (price * changePct) / 100 : 0));

  return {
    ticker: String(value.ticker ?? "").toUpperCase(),
    name: String(value.name ?? "Unknown"),
    price,
    change,
    changePct,
    volume: String(value.volume ?? "-"),
    volumeValue,
    reason: String(value.reason ?? "No reason provided"),
    sourceLabel: typeof value.sourceLabel === "string" ? value.sourceLabel : undefined,
    activityScore: toNumber(value.activityScore ?? value.activity_score, calculateActivityScore(price, changePct, volumeValue)),
  };
}

function asConvictionTier(input: unknown): ConvictionTier | null {
  const value = asRecord(input);
  const tier = value.tier;
  const risk = toNullableNumber(value.risk);
  const color = typeof value.color === "string" ? value.color : "#0EA5A4";

  if ((tier === "MAX" || tier === "HIGH" || tier === "STD") && risk != null) {
    return { tier, risk, color };
  }

  return null;
}

function parseWorkbenchItem(input: unknown): ScoredMover | null {
  const value = asRecord(input);
  const ticker = typeof value.ticker === "string" ? value.ticker.toUpperCase() : "";
  const direction = value.direction === "SHORT" ? "SHORT" : value.direction === "LONG" ? "LONG" : null;
  const verdict = value.verdict === "GO" || value.verdict === "CAUTION" || value.verdict === "SKIP" ? value.verdict : null;

  if (!ticker || !direction || !verdict) {
    return null;
  }

  const strategySnapshot = parseStrategySnapshot((value.strategySnapshot ?? null) as Json | null, "swing");

  return {
    ticker,
    name: typeof value.name === "string" ? value.name : ticker,
    direction,
    score: toNumber(value.score),
    total: toNumber(value.total),
    passRate: toNumber(value.passRate),
    verdict,
    note: typeof value.note === "string" ? value.note : "No workbench note saved.",
    conviction: asConvictionTier(value.conviction),
    fScore: toNumber(value.fScore),
    tScore: toNumber(value.tScore),
    fTotal: toNumber(value.fTotal),
    tTotal: toNumber(value.tTotal),
    scores: asNumberMap(value.scores),
    notes: asStringMap(value.notes),
    entry: toNullableNumber(value.entry),
    stop: toNullableNumber(value.stop),
    price: toNumber(value.price),
    reason: typeof value.reason === "string" ? value.reason : "No reasoning saved.",
    strategyId: typeof value.strategyId === "string" ? value.strategyId : "preset:general",
    strategyVersionId: typeof value.strategyVersionId === "string" ? value.strategyVersionId : null,
    strategyLabel: typeof value.strategyLabel === "string" ? value.strategyLabel : "General Strategy",
    strategyDetail: typeof value.strategyDetail === "string" ? value.strategyDetail : "Uses the active strategy stack.",
    strategySnapshot:
      strategySnapshot ??
      buildStrategySnapshot({
        strategyId: typeof value.strategyId === "string" ? value.strategyId : null,
        strategyVersionId: typeof value.strategyVersionId === "string" ? value.strategyVersionId : null,
        name: typeof value.strategyLabel === "string" ? value.strategyLabel : "Saved Strategy",
        description: typeof value.strategyDetail === "string" ? value.strategyDetail : "Persisted from MarketWatch.",
        learningGoal: null,
        aiInstruction: null,
        mode: "swing",
        metrics: [],
        structure: {
          setupTypes: asStringArray(value.setupTypes),
          conditions: asStringArray(value.conditions),
          chartPattern: typeof value.chartPattern === "string" ? value.chartPattern : "None",
          sizingNotes: "Persisted from MarketWatch.",
          invalidationStyle: "Review the saved workbench invalidation before deploy.",
        },
        source: "legacy",
        versionNumber: null,
      }),
    strategyMetricIds: asStringArray(value.strategyMetricIds),
    setupTypes: asStringArray(value.setupTypes),
    conditions: asStringArray(value.conditions),
    chartPattern: typeof value.chartPattern === "string" ? value.chartPattern : "None",
    thesisSummary: typeof value.thesisSummary === "string" ? value.thesisSummary : (typeof value.reason === "string" ? value.reason : "No thesis summary saved."),
    triggerLevel: toNullableNumber(value.triggerLevel),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
}

function normalizeWatchlistRow(input: {
  id: string;
  ticker: string;
  direction: "LONG" | "SHORT";
  verdict: string | null;
  note: string | null;
  source: string | null;
  last_scored_at: string | null;
  scores: unknown;
  strategy_id: string | null;
  strategy_version_id: string | null;
  strategy_name: string | null;
  strategy_snapshot: Json | null;
}): WatchlistItemView {
  const scorePayload = asRecord(input.scores);
  const strategySnapshot = parseStrategySnapshot(input.strategy_snapshot, "swing");

  return {
    id: input.id,
    ticker: input.ticker,
    direction: input.direction,
    verdict: input.verdict,
    note: input.note,
    source: input.source,
    lastScoredAt: input.last_scored_at,
    strategyId: input.strategy_id,
    strategyVersionId: input.strategy_version_id,
    strategyName: input.strategy_name,
    strategySnapshot,
    scorePayload,
    workbench: parseWorkbenchItem(scorePayload.workbench),
  };
}

function buildStrategyScopedKey(strategyId: string | null | undefined, ticker: string, direction: "LONG" | "SHORT"): string {
  return `${strategyId ?? "unassigned"}:${ticker}:${direction}`;
}

function mergeWatchlistItems(existing: WatchlistItemView[], incoming: WatchlistItemView[]): WatchlistItemView[] {
  const byKey = new Map<string, WatchlistItemView>();

  [...existing, ...incoming].forEach((item) => {
    byKey.set(buildStrategyScopedKey(item.strategyId, item.ticker, item.direction), item);
  });

  return Array.from(byKey.values()).sort((left, right) => {
    const leftWorkbench = left.workbench?.updatedAt ? new Date(left.workbench.updatedAt).getTime() : 0;
    const rightWorkbench = right.workbench?.updatedAt ? new Date(right.workbench.updatedAt).getTime() : 0;
    const leftTime = left.lastScoredAt ? new Date(left.lastScoredAt).getTime() : 0;
    const rightTime = right.lastScoredAt ? new Date(right.lastScoredAt).getTime() : 0;

    return rightWorkbench - leftWorkbench || rightTime - leftTime || left.ticker.localeCompare(right.ticker);
  });
}

function mergeScoredItems(existing: ScoredMover[], incoming: ScoredMover[]): ScoredMover[] {
  const byKey = new Map<string, ScoredMover>();

  [...existing, ...incoming].forEach((item) => {
    byKey.set(buildStrategyScopedKey(item.strategyId, item.ticker, item.direction), item);
  });

  return Array.from(byKey.values()).sort((left, right) => {
    const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
    const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
    return rightTime - leftTime || right.passRate - left.passRate;
  });
}

function verdictByPassRate(passRate: number): "GO" | "CAUTION" | "SKIP" {
  if (passRate >= 0.85) {
    return "GO";
  }
  if (passRate >= 0.65) {
    return "CAUTION";
  }
  return "SKIP";
}

function buildFeedQuality(feedState: FeedState): FeedQuality {
  if (!feedState) {
    return {
      label: "Feed Pending",
      detail: "Waiting for the next market scan response.",
    };
  }

  if (feedState.source === "polygon-top-movers" && feedState.status === "live") {
    return {
      label: "Live",
      detail: "Provider-backed movers and quotes are active.",
    };
  }

  if (feedState.source === "curated-fallback") {
    return {
      label: "Curated Fallback",
      detail: "The scan is using a ranked liquid-ticker universe because the live movers feed is empty.",
    };
  }

  if (feedState.source === "local-fallback") {
    return {
      label: "Starter Universe",
      detail: "This environment is using a built-in starter list because live market data is not configured.",
    };
  }

  return {
    label: "Feed Attention",
    detail: feedState.message,
  };
}

function resolveMetric(metricId: string, metricPool: Metric[]): Metric {
  const currentMetric = metricPool.find((metric) => metric.id === metricId);
  if (currentMetric) {
    return currentMetric;
  }

  const presetMetric = getMetricDefinition(metricId);
  if (presetMetric) {
    return { ...presetMetric, enabled: true };
  }

  return {
    id: metricId,
    name: formatMetricFallbackLabel(metricId),
    description: "Previously used custom metric saved on this symbol.",
    category: "trend",
    type: metricId.startsWith("f_") ? "fundamental" : "technical",
    enabled: true,
  };
}

function buildSavedStrategyOptions(strategies: SavedStrategy[]): StrategySelectionOption[] {
  return strategies.map((strategy) => {
    const enabledMetrics = strategy.metrics.filter((metric) => metric.enabled);

    return {
      id: strategy.id,
      label: strategy.isDefault ? `${strategy.name} · default` : strategy.name,
      detail: strategy.description,
      setupLabel: strategy.structure.setupTypes[0] ?? strategy.name,
      strategyId: strategy.id,
      strategyVersionId: strategy.activeVersionId,
      strategySnapshot: strategy.snapshot,
      metrics: enabledMetrics,
      metricIds: enabledMetrics.map((metric) => metric.id),
      metricLabels: enabledMetrics.map((metric) => metric.name),
      setupTypes: strategy.structure.setupTypes,
      conditions: strategy.structure.conditions,
      chartPattern: strategy.structure.chartPattern,
      source: "saved",
    } satisfies StrategySelectionOption;
  });
}

function buildHistoricalStrategyOptions(rows: HistoricalStrategyRow[], strategies: SavedStrategy[], mode: TradeMode): StrategySelectionOption[] {
  const metricPool = strategies.flatMap((strategy) => strategy.metrics);

  return rows.flatMap((row) => {
    const storedSnapshot = parseStrategySnapshot(row.strategy_snapshot, mode);
    const legacyMetricIds = Object.keys(asNumberMap(row.scores));
    const snapshotMetrics = storedSnapshot ? metricsFromStrategySnapshot(storedSnapshot).filter((metric) => metric.enabled) : [];
    const metrics = snapshotMetrics.length > 0 ? snapshotMetrics : legacyMetricIds.map((metricId) => resolveMetric(metricId, metricPool));
    const metricIds = metrics.map((metric) => metric.id);
    if (metrics.length === 0) {
      return [];
    }

    const setupTypes = row.setup_types ?? [];
    const setupLabel = setupTypes.length > 0 ? setupTypes.join(" / ") : "Saved ticker strategy";
    const dateLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(row.created_at));
    const snapshotSource = storedSnapshot?.source ?? "legacy";
    const snapshotVersionNumber = storedSnapshot?.versionNumber ?? null;
    const strategySnapshot = storedSnapshot ?? buildStrategySnapshot({
      strategyId: row.strategy_id,
      strategyVersionId: row.strategy_version_id,
      name: row.strategy_name ?? setupLabel,
      description: `Historical snapshot reused from ${dateLabel}.`,
      learningGoal: null,
      aiInstruction: null,
      mode,
      metrics,
      structure: {
        setupTypes,
        conditions: row.conditions ?? [],
        chartPattern: row.chart_pattern ?? "None",
        sizingNotes: "Historical strategy snapshot reused from a prior trade.",
        invalidationStyle: row.direction === "LONG" ? "Lose the prior support context." : "Reclaim the prior resistance context.",
      },
      source: snapshotSource,
      versionNumber: snapshotVersionNumber,
      createdAt: row.created_at,
    });

    return [{
      id: `history:${row.id}`,
      label: `${setupLabel} · ${dateLabel}`,
      detail: `Reuses ${metricIds.length} saved checks from a previous ${row.direction.toLowerCase()} setup in this ticker.`,
      setupLabel,
      strategyId: row.strategy_id,
      strategyVersionId: row.strategy_version_id,
      strategySnapshot,
      metrics,
      metricIds,
      metricLabels: metrics.map((metric) => metric.name),
      setupTypes,
      conditions: row.conditions ?? [],
      chartPattern: row.chart_pattern ?? "None",
      strategyThesis: row.thesis,
      previousConviction: row.conviction,
      source: "history",
    } satisfies StrategySelectionOption];
  });
}

function buildMoverFromWorkbench(item: ScoredMover, existing?: WatchlistItemView | null): Mover {
  const scorePayload = existing?.scorePayload ?? {};
  const sourceLabel = typeof scorePayload.sourceLabel === "string" ? scorePayload.sourceLabel : undefined;
  const changePct = toNumber(scorePayload.changePct);
  const activityScore = toNumber(scorePayload.activityScore, item.score);

  return {
    ticker: item.ticker,
    name: item.name,
    price: item.price,
    change: item.price > 0 && changePct !== 0 ? (item.price * changePct) / 100 : 0,
    changePct,
    volume: "-",
    volumeValue: 0,
    reason: item.reason,
    sourceLabel,
    activityScore,
  };
}

function buildMoverFromWatchlist(item: WatchlistItemView): Mover {
  if (item.workbench) {
    return buildMoverFromWorkbench(item.workbench, item);
  }

  const sourceLabel = typeof item.scorePayload.sourceLabel === "string" ? item.scorePayload.sourceLabel : undefined;
  const price = toNumber(item.scorePayload.price);
  const changePct = toNumber(item.scorePayload.changePct);

  return {
    ticker: item.ticker,
    name: item.ticker,
    price,
    change: price > 0 && changePct !== 0 ? (price * changePct) / 100 : 0,
    changePct,
    volume: "-",
    volumeValue: 0,
    reason: item.note ?? "Queued for review from MarketWatch.",
    sourceLabel,
    activityScore: toNumber(item.scorePayload.activityScore),
  };
}

export default function MarketWatchClient({ userId, mode, equity, strategies, defaultStrategyId }: MarketWatchClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [movers, setMovers] = useState<Mover[]>([]);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [scoringTicker, setScoringTicker] = useState<string | null>(null);
  const [deployingKey, setDeployingKey] = useState<string | null>(null);
  const [watchingTicker, setWatchingTicker] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [error, setError] = useState<string | null>(null);
  const [feedState, setFeedState] = useState<FeedState>(null);
  const [manualInput, setManualInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [watchlistMessage, setWatchlistMessage] = useState<string | null>(null);
  const [showFeedPopup, setShowFeedPopup] = useState(false);
  const [selectedMover, setSelectedMover] = useState<Mover | null>(null);
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null);
  const [previewQuoteLoading, setPreviewQuoteLoading] = useState(false);
  const [refreshingFeed, setRefreshingFeed] = useState(false);
  const [lastRefreshToken, setLastRefreshToken] = useState<number | null>(null);
  const [previewStrategies, setPreviewStrategies] = useState<StrategySelectionOption[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState(defaultStrategyId ?? strategies[0]?.id ?? "");
  const [previewDirection, setPreviewDirection] = useState<"LONG" | "SHORT">("LONG");
  const [dragStrategyId, setDragStrategyId] = useState<string | null>(null);
  const [moverRefreshToken, setMoverRefreshToken] = useState(0);

  const savedStrategyOptions = useMemo(() => buildSavedStrategyOptions(strategies), [strategies]);

  const defaultStrategy = useMemo(
    () => strategies.find((strategy) => strategy.id === defaultStrategyId) ?? strategies[0] ?? null,
    [defaultStrategyId, strategies],
  );

  const defaultStrategyOption = useMemo(
    () => savedStrategyOptions.find((option) => option.strategyId === defaultStrategy?.id) ?? savedStrategyOptions[0] ?? null,
    [defaultStrategy?.id, savedStrategyOptions],
  );

  const scored = useMemo(
    () => mergeScoredItems([], watchlistItems.flatMap((item) => (item.workbench ? [item.workbench] : []))),
    [watchlistItems],
  );

  const feedQuality = useMemo(() => buildFeedQuality(feedState), [feedState]);

  const selectedStrategy = previewStrategies.find((strategy) => strategy.id === selectedStrategyId) ?? previewStrategies[0] ?? null;

  useEffect(() => {
    setLastRefreshToken(getStoredMarketDataRefreshToken());
  }, []);

  const previewWorkbench = useMemo(() => {
    if (!selectedMover) {
      return null;
    }

    const strategyId = selectedStrategy?.strategyId ?? defaultStrategy?.id ?? null;
    return watchlistItems.find((item) => buildStrategyScopedKey(item.strategyId, item.ticker, item.direction) === buildStrategyScopedKey(strategyId, selectedMover.ticker, previewDirection))?.workbench ?? null;
  }, [defaultStrategy?.id, previewDirection, selectedMover, selectedStrategy?.strategyId, watchlistItems]);

  useEffect(() => {
    let isActive = true;

    async function loadMovers() {
      if (moverRefreshToken !== 0) {
        setRefreshingFeed(true);
      }
      setLoading(true);
      setError(null);
      setFeedState(null);
      setWatchlistMessage(null);

      try {
        const response = await fetch("/api/market/premarket?limit=18", { cache: "no-store" });

        const payload = (await response.json().catch(() => ({}))) as {
          movers?: unknown[];
          error?: string;
          source?: string;
          status?: "live" | "fallback" | "empty";
          message?: string;
          asOf?: number;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Automatic mover feed unavailable.");
        }
        if (!isActive) {
          return;
        }

        const automaticMovers = (Array.isArray(payload.movers) ? payload.movers : []).map(normalizeMover).filter((mover) => mover.ticker);
        setMovers(automaticMovers);
        setFeedState({
          status: payload.status ?? (automaticMovers.length > 0 ? "live" : "empty"),
          source: payload.source ?? "unknown",
          message: payload.message ?? (automaticMovers.length > 0 ? "Automatic mover feed is live." : "Automatic mover feed returned no movers."),
          asOf: typeof payload.asOf === "number" ? payload.asOf : undefined,
        });
      } catch (loadError) {
        if (!isActive) {
          return;
        }
        setMovers([]);
        setFeedState(null);
        setError(loadError instanceof Error ? loadError.message : "Automatic mover feed unavailable.");
      } finally {
        if (isActive) {
          setLoading(false);
          if (moverRefreshToken !== 0) {
            setRefreshingFeed(false);
          }
        }
      }
    }

    void loadMovers();

    return () => {
      isActive = false;
    };
  }, [mode, moverRefreshToken]);

  useEffect(() => {
    let isActive = true;

    async function loadWatchlist() {
      setWatchlistLoading(true);

      const { data, error: watchlistError } = await supabase
        .from("watchlist_items")
        .select("id, ticker, direction, verdict, note, source, last_scored_at, scores, strategy_id, strategy_version_id, strategy_name, strategy_snapshot")
        .eq("user_id", userId)
        .eq("mode", mode)
        .order("last_scored_at", { ascending: false });

      if (!isActive) {
        return;
      }

      if (watchlistError) {
        setWatchlistItems([]);
        setWatchlistMessage("Unable to load the custom watchlist right now.");
        setWatchlistLoading(false);
        return;
      }

      setWatchlistItems((data ?? []).map(normalizeWatchlistRow));
      setWatchlistLoading(false);
    }

    void loadWatchlist();

    return () => {
      isActive = false;
    };
  }, [mode, supabase, userId]);

  useEffect(() => {
    if (error || (feedState && feedState.status !== "live")) {
      setShowFeedPopup(true);
    }
  }, [error, feedState]);

  useEffect(() => {
    if (!selectedMover) {
      setPreviewQuote(null);
      setPreviewStrategies(savedStrategyOptions);
      setSelectedStrategyId(defaultStrategyId ?? savedStrategyOptions[0]?.id ?? "");
      return;
    }

    let isActive = true;
    const mover = selectedMover;
    const defaultDirection = mover.changePct >= 0 ? "LONG" : "SHORT";
    setPreviewQuoteLoading(true);
    setPreviewQuote(null);
    setPreviewStrategies(savedStrategyOptions);
    setSelectedStrategyId(defaultStrategyId ?? savedStrategyOptions[0]?.id ?? "");
    setPreviewDirection(defaultDirection);

    async function loadPreviewData() {
      const [quoteResult, historyResult] = await Promise.all([
        (async () => {
          try {
            const response = await fetch(`/api/market/quote?ticker=${mover.ticker}`, { cache: "no-store" });
            if (!response.ok) {
              return null;
            }
            return (await response.json()) as Quote;
          } catch {
            return null;
          }
        })(),
        supabase
          .from("trades")
          .select("id, strategy_id, strategy_version_id, strategy_name, strategy_snapshot, direction, setup_types, conditions, chart_pattern, thesis, scores, conviction, created_at")
          .eq("user_id", userId)
          .eq("ticker", mover.ticker)
          .eq("mode", mode)
          .order("created_at", { ascending: false })
          .limit(4),
      ]);

      if (!isActive) {
        return;
      }

      setPreviewQuote(quoteResult);
      const historyOptions = buildHistoricalStrategyOptions((historyResult.data ?? []) as HistoricalStrategyRow[], strategies, mode);
      const combined = [...savedStrategyOptions, ...historyOptions];
      setPreviewStrategies(combined);

      const preferredStrategyId = previewWorkbench?.strategyId;
      const preferredOption = preferredStrategyId
        ? combined.find((option) => option.strategyId === preferredStrategyId || option.id === preferredStrategyId) ?? null
        : null;
      if (preferredOption) {
        setSelectedStrategyId(preferredOption.id);
      } else if (defaultStrategyId && combined.some((option) => option.id === defaultStrategyId)) {
        setSelectedStrategyId(defaultStrategyId);
      }
      setPreviewQuoteLoading(false);
    }

    void loadPreviewData();

    return () => {
      isActive = false;
    };
  }, [defaultStrategyId, mode, previewWorkbench?.strategyId, savedStrategyOptions, selectedMover, strategies, supabase, userId]);

  const visibleMovers = movers.filter((mover) => {
    if (filter === "gainers") {
      return mover.changePct >= 0;
    }
    if (filter === "losers") {
      return mover.changePct < 0;
    }
    return true;
  });

  const strategyBuckets = useMemo(() => {
    const buckets = savedStrategyOptions.map((option) => ({
      id: option.strategyId ?? option.id,
      strategyId: option.strategyId,
      label: option.label,
      detail: option.detail,
      setupLabel: option.setupLabel,
      metricCount: option.metricIds.length,
      droppable: Boolean(option.strategyId),
      items: [] as WatchlistItemView[],
    }));

    const byStrategyId = new Map<string, (typeof buckets)[number]>();
    buckets.forEach((bucket) => {
      if (bucket.strategyId) {
        byStrategyId.set(bucket.strategyId, bucket);
      }
    });

    for (const item of watchlistItems) {
      const existingBucket = item.strategyId ? byStrategyId.get(item.strategyId) ?? null : null;
      if (existingBucket) {
        existingBucket.items.push(item);
        continue;
      }

      const fallbackId = item.strategyId ?? "unassigned";
      let fallbackBucket = buckets.find((bucket) => bucket.id === fallbackId) ?? null;
      if (!fallbackBucket) {
        fallbackBucket = {
          id: fallbackId,
          strategyId: item.strategyId,
          label: item.strategyName ?? item.workbench?.strategyLabel ?? "Unassigned lane",
          detail: item.workbench?.strategyDetail ?? "Legacy or manually saved rows that do not currently map to an active strategy lane.",
          setupLabel: item.workbench?.setupTypes[0] ?? "Manual queue",
          metricCount: item.workbench?.strategyMetricIds.length ?? 0,
          droppable: false,
          items: [],
        };
        buckets.push(fallbackBucket);
      }

      fallbackBucket.items.push(item);
    }

    buckets.forEach((bucket) => {
      bucket.items.sort((left, right) => {
        const leftWorkbench = left.workbench?.updatedAt ? new Date(left.workbench.updatedAt).getTime() : 0;
        const rightWorkbench = right.workbench?.updatedAt ? new Date(right.workbench.updatedAt).getTime() : 0;
        const leftTime = left.lastScoredAt ? new Date(left.lastScoredAt).getTime() : 0;
        const rightTime = right.lastScoredAt ? new Date(right.lastScoredAt).getTime() : 0;

        return rightWorkbench - leftWorkbench || rightTime - leftTime || left.ticker.localeCompare(right.ticker);
      });
    });

    return buckets.filter((bucket) => bucket.droppable || bucket.items.length > 0);
  }, [savedStrategyOptions, watchlistItems]);

  async function persistWatchlistRow(params: {
    mover: Mover;
    direction: "LONG" | "SHORT";
    verdict: string | null;
    note: string;
    workbench?: ScoredMover | null;
    strategyId?: string | null;
    strategyVersionId?: string | null;
    strategyName?: string | null;
    strategySnapshot?: StrategySnapshot | null;
    lastScoredAt?: string | null;
  }): Promise<WatchlistItemView> {
    const lookupStrategyId = params.strategyId ?? defaultStrategyOption?.strategyId ?? null;
    const existing = watchlistItems.find((item) => buildStrategyScopedKey(item.strategyId, item.ticker, item.direction) === buildStrategyScopedKey(lookupStrategyId, params.mover.ticker, params.direction))
      ?? watchlistItems.find((item) => item.strategyId == null && item.ticker === params.mover.ticker && item.direction === params.direction)
      ?? null;
    const resolvedStrategyId = params.strategyId ?? existing?.strategyId ?? defaultStrategyOption?.strategyId ?? null;
    const resolvedStrategyOption = resolvedStrategyId
      ? savedStrategyOptions.find((option) => option.strategyId === resolvedStrategyId) ?? null
      : null;
    const sourceLabel = typeof existing?.scorePayload.sourceLabel === "string" ? existing.scorePayload.sourceLabel : undefined;

    const serializedWorkbench = params.workbench
      ? ({ ...params.workbench, updatedAt: params.workbench.updatedAt ?? null } as unknown as Json)
      : null;

    const payload = {
      ...(existing?.scorePayload ?? {}),
      price: params.mover.price,
      changePct: params.mover.changePct,
      activityScore: params.mover.activityScore ?? 0,
      sourceLabel: params.mover.sourceLabel ?? sourceLabel ?? null,
      workbench: serializedWorkbench ?? (existing?.workbench ? ({ ...existing.workbench, updatedAt: existing.workbench.updatedAt ?? null } as unknown as Json) : null),
    } as unknown as Json;

    const rowPayload = {
      user_id: userId,
      strategy_id: resolvedStrategyId,
      strategy_version_id: params.strategyVersionId ?? existing?.strategyVersionId ?? resolvedStrategyOption?.strategyVersionId ?? null,
      strategy_name: params.strategyName ?? existing?.strategyName ?? resolvedStrategyOption?.label ?? null,
      strategy_snapshot: (params.strategySnapshot ?? existing?.strategySnapshot ?? resolvedStrategyOption?.strategySnapshot ?? null) as unknown as Json,
      ticker: params.mover.ticker,
      direction: params.direction,
      asset_class: "Equity",
      mode,
      scores: payload,
      verdict: params.verdict ?? existing?.verdict ?? "WATCH",
      note: params.note,
      source: "marketwatch",
      last_scored_at: params.lastScoredAt ?? new Date().toISOString(),
    };

    const writeRequest = existing?.id && (existing.strategyId ?? null) !== (resolvedStrategyId ?? null)
      ? supabase.from("watchlist_items").update(rowPayload).eq("id", existing.id)
      : supabase.from("watchlist_items").upsert(rowPayload, { onConflict: "user_id,strategy_id,ticker,direction" });

    const { data, error: watchlistError } = await writeRequest
      .select("id, ticker, direction, verdict, note, source, last_scored_at, scores, strategy_id, strategy_version_id, strategy_name, strategy_snapshot")
      .single();

    if (watchlistError) {
      throw watchlistError;
    }

    return normalizeWatchlistRow(data);
  }

  async function addToWatchlist(mover: Mover, direction: "LONG" | "SHORT", note: string) {
    const normalized = await persistWatchlistRow({
      mover,
      direction,
      verdict: "WATCH",
      note,
    });

    setWatchlistItems((previous) => mergeWatchlistItems(previous, [normalized]));
  }

  async function persistWorkbenchItem(item: ScoredMover) {
    const existing = watchlistItems.find((entry) => buildStrategyScopedKey(entry.strategyId, entry.ticker, entry.direction) === buildStrategyScopedKey(item.strategyId, item.ticker, item.direction)) ?? null;
    const mover = buildMoverFromWorkbench(item, existing);
    const normalized = await persistWatchlistRow({
      mover,
      direction: item.direction,
      verdict: item.verdict,
      note: `${item.strategyLabel}: ${item.note}`,
      workbench: item,
      strategyId: item.strategyId,
      strategyVersionId: item.strategyVersionId,
      strategyName: item.strategyLabel,
      strategySnapshot: item.strategySnapshot,
      lastScoredAt: item.updatedAt ?? new Date().toISOString(),
    });

    setWatchlistItems((previous) => mergeWatchlistItems(previous, [normalized]));
  }

  async function scoreMoverAgainstStrategy(params: {
    mover: Mover;
    strategy: StrategySelectionOption;
    direction: "LONG" | "SHORT";
    quote?: Quote | null;
    successMessage: string;
    closePreview?: boolean;
  }) {
    const selectedMetrics = params.strategy.metrics;
    if (selectedMetrics.length === 0) {
      setError(`No metrics are available for ${params.strategy.label}.`);
      return;
    }

    const effectiveMover: Mover = {
      ...params.mover,
      price: params.quote?.price ?? params.mover.price,
      change: params.quote?.change ?? params.mover.change,
      changePct: params.quote?.changePct ?? params.mover.changePct,
      volume: params.quote ? formatCompactVolume(params.quote.volume) : params.mover.volume,
      volumeValue: params.quote?.volume ?? params.mover.volumeValue,
    };
    const thesisSummary = params.strategy.strategyThesis ? `${params.mover.reason} Historical anchor: ${params.strategy.strategyThesis}` : params.mover.reason;
    const resolvedStrategyId = params.strategy.strategyId ?? defaultStrategy?.id ?? defaultStrategyOption?.strategyId ?? params.strategy.id;

    setScoringTicker(params.mover.ticker);
    try {
      const response = await fetch("/api/ai/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: params.mover.ticker,
          direction: params.direction,
          thesis: thesisSummary,
          setups: params.strategy.setupTypes.length > 0 ? params.strategy.setupTypes : [params.strategy.label],
          conditions: params.strategy.conditions,
          chartPattern: params.strategy.chartPattern,
          asset: "Equity",
          mode,
          strategyName: params.strategy.label,
          strategyInstruction: params.strategy.strategySnapshot.aiInstruction ?? null,
          metrics: selectedMetrics.map((metric) => ({
            id: metric.id,
            name: metric.name,
            desc: resolveMetricAssessmentDescription(metric, params.direction),
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("assessment failed");
      }

      const data = (await response.json()) as Record<string, { v: "PASS" | "FAIL"; r: string }>;
      const scoreMap: Record<string, 0 | 1> = {};
      const noteMap: Record<string, string> = {};

      for (const metric of selectedMetrics) {
        const result = data[metric.id];
        if (!result) {
          continue;
        }
        scoreMap[metric.id] = result.v === "PASS" ? 1 : 0;
        noteMap[metric.id] = result.r;
      }

      const fundamental = selectedMetrics.filter((metric) => metric.type === "fundamental");
      const technical = selectedMetrics.filter((metric) => metric.type === "technical");
      const fScore = fundamental.reduce((sum, metric) => sum + (scoreMap[metric.id] ?? 0), 0);
      const tScore = technical.reduce((sum, metric) => sum + (scoreMap[metric.id] ?? 0), 0);
      const fTotal = fundamental.length;
      const tTotal = technical.length;
      const total = selectedMetrics.length;
      const score = Object.values(scoreMap).reduce<number>((sum, value) => sum + value, 0);
      const passRate = total > 0 ? score / total : 0;
      const conviction = getConviction(fScore, fTotal, tScore, tTotal);
      const updatedAt = new Date().toISOString();
      const selectedStrategySnapshot = updateStrategySnapshotStructure(params.strategy.strategySnapshot, {
        setupTypes: params.strategy.setupTypes,
        conditions: params.strategy.conditions,
        chartPattern: params.strategy.chartPattern,
      });

      const scoredItem: ScoredMover = {
        ticker: effectiveMover.ticker,
        name: effectiveMover.name,
        direction: params.direction,
        score,
        total,
        passRate,
        verdict: verdictByPassRate(passRate),
        note: noteMap[Object.keys(noteMap)[0] ?? ""] ?? effectiveMover.reason,
        conviction,
        fScore,
        tScore,
        fTotal,
        tTotal,
        scores: scoreMap,
        notes: noteMap,
        entry: effectiveMover.price > 0 ? effectiveMover.price : null,
        stop: null,
        price: effectiveMover.price,
        reason: effectiveMover.reason,
        strategyId: resolvedStrategyId,
        strategyVersionId: params.strategy.strategyVersionId,
        strategyLabel: params.strategy.label,
        strategyDetail: params.strategy.detail,
        strategySnapshot: selectedStrategySnapshot,
        strategyMetricIds: params.strategy.metricIds,
        setupTypes: params.strategy.setupTypes,
        conditions: params.strategy.conditions,
        chartPattern: params.strategy.chartPattern,
        thesisSummary,
        triggerLevel: buildTriggerLevel(effectiveMover.price > 0 ? effectiveMover.price : null, params.direction, mode),
        updatedAt,
      };

      await persistWorkbenchItem(scoredItem);
      setWatchlistMessage(params.successMessage);
      setError(null);
      if (params.closePreview) {
        setSelectedMover(null);
      }
    } catch {
      setError(`Scoring failed for ${params.mover.ticker}.`);
    } finally {
      setScoringTicker(null);
    }
  }

  async function scoreSelectedPreview() {
    if (!selectedMover || !selectedStrategy) {
      return;
    }

    await scoreMoverAgainstStrategy({
      mover: selectedMover,
      strategy: selectedStrategy,
      direction: previewDirection,
      quote: previewQuote,
      successMessage: `${selectedMover.ticker} moved into the custom watchlist workbench using ${selectedStrategy.label}.`,
      closePreview: true,
    });
  }

  function updateWorkbenchField(strategyId: string, ticker: string, direction: "LONG" | "SHORT", field: "entry" | "stop", value: number | null) {
    const targetItem = watchlistItems.find((item) => buildStrategyScopedKey(item.strategyId, item.ticker, item.direction) === buildStrategyScopedKey(strategyId, ticker, direction))?.workbench;
    if (!targetItem) {
      return;
    }

    const updatedItem: ScoredMover = {
      ...targetItem,
      [field]: value,
      updatedAt: new Date().toISOString(),
    };

    setWatchlistItems((previous) =>
      mergeWatchlistItems(
        previous.map((item) =>
          buildStrategyScopedKey(item.strategyId, item.ticker, item.direction) === buildStrategyScopedKey(strategyId, ticker, direction)
            ? { ...item, workbench: updatedItem, note: `${updatedItem.strategyLabel}: ${updatedItem.note}`, lastScoredAt: updatedItem.updatedAt ?? item.lastScoredAt }
            : item,
        ),
        [],
      ),
    );

    void persistWorkbenchItem(updatedItem);
  }

  async function watchMover(mover: Mover) {
    setWatchingTicker(mover.ticker);

    try {
      await addToWatchlist(
        mover,
        mover.changePct >= 0 ? "LONG" : "SHORT",
        `Added manually from MarketWatch for later review in ${defaultStrategyOption?.label ?? "the default lane"}. ${mover.reason}`,
      );
      setWatchlistMessage(`${mover.ticker} was added to ${defaultStrategyOption?.label ?? "the default strategy lane"}.`);
      setError(null);
    } catch {
      setError(`Unable to add ${mover.ticker} to the custom watchlist.`);
    } finally {
      setWatchingTicker(null);
    }
  }

  function readDraggedMover(event: DragEvent<HTMLDivElement>): Mover | null {
    const rawMover = event.dataTransfer.getData("application/x-tds-mover");
    if (rawMover) {
      try {
        return normalizeMover(JSON.parse(rawMover) as unknown);
      } catch {
        return null;
      }
    }

    const ticker = event.dataTransfer.getData("text/plain").trim().toUpperCase();
    if (!ticker) {
      return null;
    }

    return movers.find((mover) => mover.ticker === ticker) ?? null;
  }

  async function dropMoverIntoStrategy(event: DragEvent<HTMLDivElement>, strategy: StrategySelectionOption) {
    event.preventDefault();
    setDragStrategyId(null);

    const mover = readDraggedMover(event);
    if (!mover) {
      setWatchlistMessage("The dropped symbol could not be read from the active tape.");
      return;
    }

    await scoreMoverAgainstStrategy({
      mover,
      strategy,
      direction: mover.changePct >= 0 ? "LONG" : "SHORT",
      successMessage: `${mover.ticker} was added to ${strategy.label} and scored automatically.`,
    });
  }

  async function removeWatchlistItem(item: WatchlistItemView) {
    setWatchingTicker(item.ticker);

    try {
      const { error: deleteError } = await supabase.from("watchlist_items").delete().eq("id", item.id);

      if (deleteError) {
        throw deleteError;
      }

      setWatchlistItems((previous) => previous.filter((entry) => entry.id !== item.id));
      setWatchlistMessage(`${item.ticker} was removed from the custom watchlist.`);
      setError(null);
    } catch {
      setError(`Unable to remove ${item.ticker} from the custom watchlist.`);
    } finally {
      setWatchingTicker(null);
    }
  }

  async function importTickers() {
    if (!manualInput.trim()) {
      setWatchlistMessage("Paste one or more ticker symbols to add to the custom watchlist.");
      return;
    }

    setImporting(true);
    setWatchlistMessage(null);

    try {
      const response = await fetch("/api/market/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawInput: manualInput }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        movers?: unknown[];
        unresolvedTickers?: string[];
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Ticker import failed.");
      }

      const importedMovers = (Array.isArray(payload.movers) ? payload.movers : []).map(normalizeMover).filter((mover) => mover.ticker);
      if (importedMovers.length === 0) {
        setWatchlistMessage("No pasted tickers could be enriched from the market data API.");
        return;
      }

      const persistedRows = await Promise.all(
        importedMovers.map((mover) =>
          persistWatchlistRow({
            mover,
            direction: (mover.changePct >= 0 ? "LONG" : "SHORT") as "LONG" | "SHORT",
            verdict: "WATCH",
            note: `Added manually from the MarketWatch custom watchlist into ${defaultStrategyOption?.label ?? "the default lane"}.`,
          }),
        ),
      );

      setMovers((previous) => mergeMovers(previous, importedMovers));
      setWatchlistItems((previous) => mergeWatchlistItems(previous, persistedRows));
      setManualInput("");
      setError(null);

      const unresolved = Array.isArray(payload.unresolvedTickers) && payload.unresolvedTickers.length > 0
        ? ` Unavailable: ${payload.unresolvedTickers.join(", ")}.`
        : "";
      setWatchlistMessage(`Added ${importedMovers.length} ticker${importedMovers.length === 1 ? "" : "s"} to ${defaultStrategyOption?.label ?? "the default strategy lane"}.${unresolved}`);
    } catch (importError) {
      setWatchlistMessage(importError instanceof Error ? importError.message : "Ticker import failed.");
    } finally {
      setImporting(false);
    }
  }

  function refreshMarketFeed() {
    const token = broadcastMarketDataRefresh("marketwatch-manual-refresh");
    setLastRefreshToken(token);
    setMoverRefreshToken(token);
  }

  async function deploy(item: ScoredMover) {
    if (!userId || !item.conviction || item.entry == null || item.stop == null) {
      return;
    }

    const position = calculatePosition(equity, item.conviction, item.entry, item.stop, item.direction);
    if (!position) {
      return;
    }

    setDeployingKey(buildStrategyScopedKey(item.strategyId, item.ticker, item.direction));
    try {
      const trancheDeadline = new Date();
      trancheDeadline.setDate(trancheDeadline.getDate() + 3);

      const { error: insertError } = await supabase.from("trades").insert({
        user_id: userId,
        strategy_id: item.strategyId,
        strategy_version_id: item.strategyVersionId,
        strategy_name: item.strategyLabel,
        strategy_snapshot: item.strategySnapshot as unknown as Database["public"]["Tables"]["trades"]["Insert"]["strategy_snapshot"],
        ticker: item.ticker,
        direction: item.direction,
        asset_class: "Equity",
        mode,
        setup_types: item.setupTypes.length > 0 ? item.setupTypes : [item.strategyLabel],
        conditions: item.conditions,
        chart_pattern: item.chartPattern || "None",
        thesis: item.thesisSummary,
        catalyst_window: "1-3 days",
        invalidation: item.strategySnapshot.structure.invalidationStyle || (item.direction === "LONG" ? "Lose intraday support" : "Reclaim intraday resistance"),
        scores: item.scores,
        notes: item.notes,
        f_score: item.fScore,
        t_score: item.tScore,
        f_total: item.fTotal,
        t_total: item.tTotal,
        conviction: item.conviction.tier,
        risk_pct: item.conviction.risk,
        entry_price: item.entry,
        stop_loss: item.stop,
        shares: position.shares,
        tranche1_shares: position.tranche1,
        tranche2_shares: position.tranche2,
        tranche2_filled: false,
        tranche2_deadline: trancheDeadline.toISOString(),
        exit_t1: false,
        exit_t2: false,
        exit_t3: false,
        r2_target: position.r2Target,
        r4_target: position.r4Target,
        market_price: item.price,
        confirmed: true,
        closed: false,
        source: "marketwatch",
      });

      if (insertError) {
        throw insertError;
      }

      const watchlistRow = watchlistItems.find((entry) => buildStrategyScopedKey(entry.strategyId, entry.ticker, entry.direction) === buildStrategyScopedKey(item.strategyId, item.ticker, item.direction));
      if (watchlistRow) {
        const { error: deleteError } = await supabase.from("watchlist_items").delete().eq("id", watchlistRow.id);
        if (!deleteError) {
          setWatchlistItems((previous) => previous.filter((entry) => entry.id !== watchlistRow.id));
        }
      }
      router.push("/dashboard");
    } catch {
      setError(`Deploy failed for ${item.ticker}.`);
    } finally {
      setDeployingKey(null);
    }
  }

  return (
    <main className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_320px]">
        <div className="fin-hero px-7 py-8 sm:px-8 sm:py-9">
          <div className="flex flex-wrap items-center gap-2">
            <p className="fin-chip fin-chip-strong">MarketWatch</p>
            <span className="rounded-full border border-white/16 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
              {feedQuality.label}
            </span>
          </div>
          <h1 className="mt-6 max-w-3xl text-3xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
            Scan movers, preview fast, and stage ideas.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/76 sm:text-base">
            Score each symbol with your strategy and keep plans saved in the workbench.
          </p>
          <p className="mt-4 max-w-2xl text-xs uppercase tracking-[0.16em] text-white/60">{feedQuality.detail}</p>
          <div className="mt-4 inline-flex rounded-full border border-white/16 bg-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/76">
            Market Sync {formatMarketDataRefreshTime(lastRefreshToken)}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-white/14 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Mode</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatModeLabel(mode)}</p>
            </div>
            <div className="rounded-[24px] border border-white/14 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Custom Watchlist</p>
              <p className="mt-2 font-mono text-3xl text-white">{watchlistItems.length}</p>
            </div>
            <div className="rounded-[24px] border border-white/14 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Workbench Queue</p>
              <p className="mt-2 font-mono text-3xl text-white">{scored.length}</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {[
              { key: "all", label: "All Movers" },
              { key: "gainers", label: "Gainers" },
              { key: "losers", label: "Losers" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key as FilterTab)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${filter === item.key ? "border-white/20 bg-white/18 text-white" : "border-white/14 bg-white/8 text-white/76 hover:bg-white/14"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <aside className="fin-panel p-6">
          <p className="fin-kicker">Scanner State</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Status</h2>
          <div className="mt-5 space-y-3">
            <div className="fin-card flex items-start gap-3 p-4">
              <Radar className="mt-0.5 h-5 w-5 text-tds-blue" />
              <div>
                <p className="fin-kicker">Metric Stack</p>
                <p className="mt-1 text-sm text-tds-text">{savedStrategyOptions.length} saved strateg{savedStrategyOptions.length === 1 ? "y" : "ies"} available.</p>
              </div>
            </div>
            <div className="fin-card flex items-start gap-3 p-4">
              <Sparkles className="mt-0.5 h-5 w-5 text-tds-teal" />
              <div>
                <p className="fin-kicker">Feed Quality</p>
                <p className="mt-1 text-sm text-tds-text">{feedQuality.label}. {feedQuality.detail}</p>
              </div>
            </div>
            <div className="fin-card p-4">
              <p className="fin-kicker">Quote Status</p>
              <p className="mt-1 text-sm text-tds-text">Shared quote labels across preview, sizing, and trade screens.</p>
              <QuoteStatusLegend className="mt-4" />
            </div>
            <div className="fin-card flex items-start gap-3 p-4">
              <ListChecks className="mt-0.5 h-5 w-5 text-tds-amber" />
              <div>
                <p className="fin-kicker">Watchlist Desk</p>
                <p className="mt-1 text-sm text-tds-text">{watchlistItems.length} staged name{watchlistItems.length === 1 ? "" : "s"}, {scored.length} workbench item{scored.length === 1 ? "" : "s"}.</p>
              </div>
            </div>
            <div className="fin-card flex items-start gap-3 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-tds-green" />
              <div>
                <p className="fin-kicker">Execution Queue</p>
                <p className="mt-1 text-sm text-tds-text">Deploy after preview, score, and planning.</p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      {error ? <div className="rounded-[22px] border border-tds-red/25 bg-tds-red/10 px-4 py-3 text-sm text-tds-red">{error}</div> : null}

      {loading && movers.length === 0 ? (
        <div className="fin-panel p-6 text-sm text-tds-dim">Loading movers...</div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="fin-panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="fin-kicker">Active Tape</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Most active movers</h2>
            </div>
            <span className="fin-chip">{visibleMovers.length} visible</span>
          </div>

          {visibleMovers.length === 0 && !loading ? (
            <div className="fin-card mt-6 p-6 text-sm leading-6 text-tds-dim">No movers match the active filter right now.</div>
          ) : null}

          <div className="mt-6">
            <MoversTable
              movers={visibleMovers}
              asOf={feedState?.asOf ?? null}
              loadingTicker={scoringTicker}
              watchingTicker={watchingTicker}
              refreshingFeed={refreshingFeed}
              feedQualityLabel={feedQuality.label}
              onRefresh={refreshMarketFeed}
              onPreview={(mover) => setSelectedMover(mover)}
              onWatch={(mover) => void watchMover(mover)}
            />
          </div>
        </div>

        <aside className="fin-panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="fin-kicker">Custom Watchlist</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Saved symbols</h2>
            </div>
            <span className="fin-chip">{watchlistItems.length}</span>
          </div>
          <p className="mt-3 text-sm leading-7 text-tds-dim">
            Add symbols here or from the tape. Scored and planned items stay saved until you deploy or remove them.
          </p>

          <textarea
            value={manualInput}
            onChange={(event) => setManualInput(event.target.value.toUpperCase())}
            placeholder="AAPL, NVDA, TSLA"
            className="mt-5 min-h-[132px] w-full rounded-[24px] border border-white/80 bg-white/88 px-4 py-3 text-sm text-tds-text shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_10px_24px_-18px_rgba(15,23,42,0.35)] placeholder:text-tds-dim"
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" disabled={importing} onClick={() => void importTickers()}>
              {importing ? "Adding..." : "Add to watchlist"}
            </Button>
            <p className="text-xs uppercase tracking-[0.16em] text-tds-dim">Validated before save</p>
          </div>

          {watchlistMessage ? <p className="mt-4 text-sm text-tds-dim">{watchlistMessage}</p> : null}

          <div className="mt-6 space-y-3">
            {watchlistLoading ? <div className="fin-card p-4 text-sm text-tds-dim">Loading custom watchlist...</div> : null}
            {!watchlistLoading && watchlistItems.length === 0 ? <div className="fin-card p-4 text-sm text-tds-dim">No symbols yet. Add from MarketWatch or paste above.</div> : null}
            {watchlistItems.slice(0, 8).map((item) => (
              <div key={item.id} className="fin-card flex items-start justify-between gap-3 p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-tds-text">{item.ticker}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${item.direction === "LONG" ? "bg-tds-green/10 text-tds-green" : "bg-tds-red/10 text-tds-red"}`}>{item.direction}</span>
                    <span className="fin-chip">{item.verdict ?? "WATCH"}</span>
                    {item.workbench ? <span className="fin-chip">Workbench</span> : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-tds-dim">{item.workbench ? `${item.workbench.strategyLabel} · ${Math.round(item.workbench.passRate * 100)}% saved.` : item.note ?? "Queued for review."}</p>
                </div>

                <button
                  type="button"
                  onClick={() => void removeWatchlistItem(item)}
                  disabled={watchingTicker === item.ticker}
                  aria-label={`Remove ${item.ticker} from watchlist`}
                  title={`Remove ${item.ticker} from watchlist`}
                  className="rounded-2xl border border-white/75 bg-white/80 p-2 text-tds-dim shadow-sm hover:bg-white hover:text-tds-text disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="fin-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="fin-kicker">Strategy Watchlists</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Strategy lanes</h2>
          </div>
          <span className="fin-chip">{strategyBuckets.reduce((sum, bucket) => sum + bucket.items.length, 0)} staged</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-tds-dim">Drop a ticker on a lane to score and save it there.</p>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {strategyBuckets.map((bucket) => {
            const bucketStrategy = bucket.strategyId
              ? savedStrategyOptions.find((option) => option.strategyId === bucket.strategyId) ?? null
              : null;

            return (
              <div
                key={bucket.id}
                onDragOver={(event) => {
                  if (!bucket.droppable) {
                    return;
                  }
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                  setDragStrategyId(bucket.strategyId ?? null);
                }}
                onDragLeave={() => {
                  if (dragStrategyId === bucket.strategyId) {
                    setDragStrategyId(null);
                  }
                }}
                onDrop={(event) => {
                  if (!bucket.droppable || !bucketStrategy) {
                    return;
                  }
                  void dropMoverIntoStrategy(event, bucketStrategy);
                }}
                className={cn(
                  "rounded-[28px] border p-5 transition-colors",
                  bucket.droppable ? "border-white/75 bg-white/90 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.24)]" : "border-slate-200/80 bg-slate-50/80",
                  dragStrategyId && dragStrategyId === bucket.strategyId ? "border-tds-blue bg-sky-50/90 shadow-[0_24px_56px_-30px_rgba(14,116,244,0.28)]" : "",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-tds-dim">{bucket.setupLabel}</p>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-tds-text">{bucket.label}</h3>
                    <p className="mt-2 text-sm leading-6 text-tds-dim">{bucket.detail}</p>
                  </div>
                  <span className="fin-chip">{bucket.items.length}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="fin-chip">{bucket.metricCount} checks</span>
                  {bucket.droppable ? <span className="fin-chip">Drop zone</span> : <span className="fin-chip">Read only</span>}
                </div>

                <div className="mt-5 space-y-3">
                  {bucket.items.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/88 px-4 py-5 text-sm leading-6 text-tds-dim">
                      {bucket.droppable ? "Drop a ticker here to score and save it in this lane." : "No items in this lane."}
                    </div>
                  ) : null}

                  {bucket.items.map((item) => (
                    <div key={item.id} className="rounded-[22px] border border-slate-200/80 bg-white/92 p-4 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.26)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewDirection(item.direction);
                                setSelectedMover(buildMoverFromWatchlist(item));
                              }}
                              className="font-mono text-sm font-semibold text-tds-blue hover:text-sky-700"
                            >
                              {item.ticker}
                            </button>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${item.direction === "LONG" ? "bg-tds-green/10 text-tds-green" : "bg-tds-red/10 text-tds-red"}`}>{item.direction}</span>
                            <span className="fin-chip">{item.verdict ?? "WATCH"}</span>
                            {item.workbench ? <span className="fin-chip">Workbench</span> : null}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-tds-dim">{item.workbench ? `${item.workbench.strategyLabel} · ${Math.round(item.workbench.passRate * 100)}% saved.` : item.note ?? "Queued for review."}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => void removeWatchlistItem(item)}
                          disabled={watchingTicker === item.ticker}
                          aria-label={`Remove ${item.ticker} from watchlist`}
                          title={`Remove ${item.ticker} from watchlist`}
                          className="rounded-2xl border border-white/75 bg-white/80 p-2 text-tds-dim shadow-sm hover:bg-white hover:text-tds-text disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="fin-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="fin-kicker">Custom Watchlist Workbench</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Saved planning queue</h2>
          </div>
          <span className="fin-chip">{scored.length} saved</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-tds-dim">Scores and planner fields stay here across refreshes until deployed.</p>

        {scored.length === 0 ? <p className="mt-6 text-sm text-tds-dim">Preview and score a mover to add it here.</p> : null}

        <div className="mt-6">
          <ScoredList
            items={scored}
            equity={equity}
            loadingKey={deployingKey}
            onEntryChange={(strategyId, ticker, direction, value) => updateWorkbenchField(strategyId, ticker, direction, "entry", value)}
            onStopChange={(strategyId, ticker, direction, value) => updateWorkbenchField(strategyId, ticker, direction, "stop", value)}
            onDeploy={(item) => void deploy(item)}
          />
        </div>
      </section>

      <InstrumentPreviewDrawer
        open={Boolean(selectedMover)}
        mover={selectedMover}
        mode={mode}
        quote={previewQuote}
        quoteLoading={previewQuoteLoading}
        selectedDirection={previewDirection}
        onDirectionChange={setPreviewDirection}
        strategyOptions={previewStrategies}
        selectedStrategyId={selectedStrategyId}
        onStrategyChange={setSelectedStrategyId}
        scoring={scoringTicker === selectedMover?.ticker}
        onScore={() => void scoreSelectedPreview()}
        onClose={() => setSelectedMover(null)}
        existingConvictionLabel={previewWorkbench?.conviction?.tier ?? selectedStrategy?.previousConviction ?? null}
        feedQualityLabel={feedQuality.label}
      />

      {showFeedPopup && (error || (feedState && feedState.status !== "live")) ? (
        <div className="fixed bottom-6 left-4 z-50 max-w-sm rounded-[24px] border border-white/75 bg-white/92 p-5 shadow-[0_28px_70px_-32px_rgba(15,23,42,0.38)] backdrop-blur md:left-[292px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <BellRing className="h-4 w-4 text-tds-amber" />
                <p className="fin-kicker">Market Feed Attention</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-tds-text">{error ?? feedState?.message}</p>
              {feedState ? <p className="mt-3 text-xs uppercase tracking-[0.16em] text-tds-dim">{feedQuality.label} · {feedState.source}</p> : null}
            </div>

            <button
              type="button"
              onClick={() => setShowFeedPopup(false)}
              aria-label="Dismiss market feed alert"
              title="Dismiss market feed alert"
              className="rounded-2xl border border-white/75 bg-white/80 p-2 text-tds-dim shadow-sm hover:bg-white hover:text-tds-text"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
