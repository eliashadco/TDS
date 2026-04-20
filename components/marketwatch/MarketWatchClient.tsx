"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import InstrumentPreviewDrawer, { type StrategySelectionOption } from "@/components/marketwatch/InstrumentPreviewDrawer";
import MoversTable from "@/components/marketwatch/MoversTable";
import ScoredList, { type ScoredMover } from "@/components/marketwatch/ScoredList";
import { broadcastMarketDataRefresh, getStoredMarketDataRefreshToken } from "@/lib/market/refresh";
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
  mode: TradeMode | null;
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

type SavedWatchlistProfile = {
  id: string;
  name: string;
  strategyId: string;
  itemKeys: string[];
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

type DroppedMoverPayload = {
  mover: Mover;
  direction?: "LONG" | "SHORT";
};

const MOVERS_PAGE_SIZE = 10;
const WATCHLIST_PAGE_SIZE = 10;

function buildWatchlistProfileId(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "my-watchlist";
}

function buildDefaultWatchlistProfile(strategyId: string): SavedWatchlistProfile {
  return {
    id: "my-watchlist",
    name: "My Watchlist",
    strategyId,
    itemKeys: [],
  };
}

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

function formatModeLabel(mode: TradeMode | null): string {
  if (!mode) {
    return "No lane selected";
  }

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

function formatWatchlistDate(value?: string | null): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function buildTriggerLevel(price: number | null, direction: "LONG" | "SHORT", mode: TradeMode | null): number | null {
  if (!mode) {
    return null;
  }

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

function readDroppedMoverFromEvent(event: DragEvent<HTMLElement>): DroppedMoverPayload | null {
  const rawMover = event.dataTransfer.getData("application/x-tds-mover");
  const ticker = event.dataTransfer.getData("text/plain").trim().toUpperCase();
  const rawDirection = event.dataTransfer.getData("application/x-tds-direction");
  const direction = rawDirection === "LONG" || rawDirection === "SHORT" ? rawDirection : undefined;

  if (rawMover) {
    try {
      const parsed = normalizeMover(JSON.parse(rawMover) as unknown);
      if (parsed.ticker) {
        return { mover: parsed, direction };
      }
    } catch {
      // Fall back to plain ticker handling below.
    }
  }

  if (!ticker) {
    return null;
  }

  return {
    mover: normalizeMover({
      ticker,
      name: ticker,
      price: 0,
      change: 0,
      changePct: 0,
      volume: "-",
      volumeValue: 0,
      reason: "Dragged from marketwatch board.",
      sourceLabel: "drag-drop",
    }),
    direction,
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

function buildWatchlistItemKey(item: Pick<WatchlistItemView, "strategyId" | "ticker" | "direction">): string {
  return buildStrategyScopedKey(item.strategyId, item.ticker, item.direction);
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

function serializeTradePrefill(values: string[]): string {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .join(",");
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

function buildHistoricalStrategyOptions(rows: HistoricalStrategyRow[], strategies: SavedStrategy[], mode: TradeMode | null): StrategySelectionOption[] {
  const metricPool = strategies.flatMap((strategy) => strategy.metrics);
  const effectiveMode = mode ?? "swing";

  return rows.flatMap((row) => {
    const storedSnapshot = parseStrategySnapshot(row.strategy_snapshot, effectiveMode);
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
      mode: effectiveMode,
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
  const [selectedMover, setSelectedMover] = useState<Mover | null>(null);
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null);
  const [previewQuoteLoading, setPreviewQuoteLoading] = useState(false);
  const [refreshingFeed, setRefreshingFeed] = useState(false);
  const [, setLastRefreshToken] = useState<number | null>(null);
  const [previewStrategies, setPreviewStrategies] = useState<StrategySelectionOption[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState(defaultStrategyId ?? strategies[0]?.id ?? "");
  const [previewDirection, setPreviewDirection] = useState<"LONG" | "SHORT">("LONG");
  const [watchlistName, setWatchlistName] = useState("My Watchlist");
  const [watchlistStrategyId, setWatchlistStrategyId] = useState(defaultStrategyId ?? strategies[0]?.id ?? "");
  const [watchlistProfiles, setWatchlistProfiles] = useState<SavedWatchlistProfile[]>([]);
  const [activeWatchlistId, setActiveWatchlistId] = useState("my-watchlist");
  const [workbenchStrategyId, setWorkbenchStrategyId] = useState(defaultStrategyId ?? strategies[0]?.id ?? "");
  const [watchlistProfileInitialized, setWatchlistProfileInitialized] = useState(false);
  const [moverRefreshToken, setMoverRefreshToken] = useState(0);
  const [moversPage, setMoversPage] = useState(1);
  const [watchlistPage, setWatchlistPage] = useState(1);
  const [watchlistDropActive, setWatchlistDropActive] = useState(false);
  const [workbenchDropActive, setWorkbenchDropActive] = useState(false);
  const [circuitBreakerTripped, setCircuitBreakerTripped] = useState(false);
  const laneSelected = Boolean(mode);

  const savedStrategyOptions = useMemo(() => buildSavedStrategyOptions(strategies), [strategies]);
  const strategyConfigured = savedStrategyOptions.length > 0;
  const marketWatchActionsEnabled = laneSelected && strategyConfigured;
  const marketWatchDisabledReason = !laneSelected
    ? "Choose a lane configuration to save, score, and deploy from MarketWatch."
    : "Create or enable a strategy with at least one check to score and deploy from MarketWatch.";

  const defaultStrategy = useMemo(
    () => strategies.find((strategy) => strategy.id === defaultStrategyId) ?? strategies[0] ?? null,
    [defaultStrategyId, strategies],
  );

  const defaultStrategyOption = useMemo(
    () => savedStrategyOptions.find((option) => option.strategyId === defaultStrategy?.id) ?? savedStrategyOptions[0] ?? null,
    [defaultStrategy?.id, savedStrategyOptions],
  );

  const modeStorageKey = mode ?? "account";
  const watchlistProfilesStorageKey = useMemo(() => `tds:marketwatch:watchlist-profiles:${userId}:${modeStorageKey}`, [modeStorageKey, userId]);
  const legacyWatchlistProfileStorageKey = useMemo(() => `tds:marketwatch:watchlist-profile:${userId}:${modeStorageKey}`, [modeStorageKey, userId]);
  const activeWatchlistStorageKey = useMemo(() => `tds:marketwatch:watchlist-active:${userId}:${modeStorageKey}`, [modeStorageKey, userId]);

  const activeWatchlistProfile = useMemo(
    () => watchlistProfiles.find((profile) => profile.id === activeWatchlistId) ?? null,
    [activeWatchlistId, watchlistProfiles],
  );

  const selectedWatchlistStrategy = useMemo(
    () => savedStrategyOptions.find((option) => option.strategyId === watchlistStrategyId) ?? defaultStrategyOption ?? null,
    [defaultStrategyOption, savedStrategyOptions, watchlistStrategyId],
  );

  const visibleWatchlistItems = useMemo(() => {
    if (!activeWatchlistProfile) {
      return [];
    }

    const itemKeySet = new Set(activeWatchlistProfile.itemKeys);
    return watchlistItems.filter((item) => itemKeySet.has(buildWatchlistItemKey(item)));
  }, [activeWatchlistProfile, watchlistItems]);

  const selectedWorkbenchStrategy = useMemo(
    () => savedStrategyOptions.find((option) => option.id === workbenchStrategyId || option.strategyId === workbenchStrategyId) ?? defaultStrategyOption ?? null,
    [defaultStrategyOption, savedStrategyOptions, workbenchStrategyId],
  );

  const scored = useMemo(
    () => mergeScoredItems([], visibleWatchlistItems.flatMap((item) => (item.workbench ? [item.workbench] : []))),
    [visibleWatchlistItems],
  );

  const feedQuality = useMemo(() => buildFeedQuality(feedState), [feedState]);

  const visibleMovers = useMemo(
    () =>
      movers.filter((mover) => {
        if (filter === "gainers") {
          return mover.changePct >= 0;
        }
        if (filter === "losers") {
          return mover.changePct < 0;
        }
        return true;
      }),
    [filter, movers],
  );

  const moverTotalPages = Math.max(1, Math.ceil(visibleMovers.length / MOVERS_PAGE_SIZE));
  const watchlistTotalPages = Math.max(1, Math.ceil(visibleWatchlistItems.length / WATCHLIST_PAGE_SIZE));

  const pagedMovers = useMemo(() => {
    const startIndex = (moversPage - 1) * MOVERS_PAGE_SIZE;
    return visibleMovers.slice(startIndex, startIndex + MOVERS_PAGE_SIZE);
  }, [moversPage, visibleMovers]);

  const pagedWatchlistItems = useMemo(() => {
    const startIndex = (watchlistPage - 1) * WATCHLIST_PAGE_SIZE;
    return visibleWatchlistItems.slice(startIndex, startIndex + WATCHLIST_PAGE_SIZE);
  }, [visibleWatchlistItems, watchlistPage]);

  const selectedStrategy = previewStrategies.find((strategy) => strategy.id === selectedStrategyId) ?? previewStrategies[0] ?? null;

  useEffect(() => {
    setLastRefreshToken(getStoredMarketDataRefreshToken());
    fetch("/api/circuit-breaker")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.tripped) setCircuitBreakerTripped(true); })
      .catch(() => {});
  }, []);

  const previewWorkbench = useMemo(() => {
    if (!selectedMover) {
      return null;
    }

    const strategyId = selectedStrategy?.strategyId ?? defaultStrategy?.id ?? null;
    return visibleWatchlistItems.find((item) => buildStrategyScopedKey(item.strategyId, item.ticker, item.direction) === buildStrategyScopedKey(strategyId, selectedMover.ticker, previewDirection))?.workbench ?? null;
  }, [defaultStrategy?.id, previewDirection, selectedMover, selectedStrategy?.strategyId, visibleWatchlistItems]);

  const previewPlanTradeHref = useMemo(() => {
    if (!selectedMover || !selectedStrategy || previewWorkbench?.verdict !== "GO") {
      return null;
    }

    const params = new URLSearchParams({
      ticker: selectedMover.ticker,
      direction: previewDirection,
      strategyId: selectedStrategy.strategyId ?? "",
      thesis: selectedStrategy.strategyThesis ? `${selectedMover.reason} Historical anchor: ${selectedStrategy.strategyThesis}` : selectedMover.reason,
      setupTypes: serializeTradePrefill(selectedStrategy.setupTypes),
      conditions: serializeTradePrefill(selectedStrategy.conditions),
      chartPattern: selectedStrategy.chartPattern,
      assetClass: "Equity",
      source: "marketwatch",
    });

    if (!selectedStrategy.strategyId) {
      params.delete("strategyId");
    }

    if (!selectedStrategy.chartPattern || selectedStrategy.chartPattern === "None") {
      params.delete("chartPattern");
    }

    if (selectedStrategy.setupTypes.length === 0) {
      params.delete("setupTypes");
    }

    if (selectedStrategy.conditions.length === 0) {
      params.delete("conditions");
    }

    return `/trade/new?${params.toString()}`;
  }, [previewDirection, previewWorkbench?.verdict, selectedMover, selectedStrategy]);

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
      if (!mode) {
        setWatchlistItems([]);
        setWatchlistLoading(false);
        return;
      }

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
    setWatchlistProfileInitialized(false);
  }, [watchlistProfilesStorageKey]);

  useEffect(() => {
    if (watchlistProfileInitialized) {
      return;
    }

    const fallbackStrategyId = defaultStrategyOption?.strategyId ?? savedStrategyOptions[0]?.strategyId ?? "";
    let nextProfiles = [buildDefaultWatchlistProfile(fallbackStrategyId)];
    let nextActiveId = nextProfiles[0]?.id ?? "my-watchlist";

    try {
      const rawProfiles = window.localStorage.getItem(watchlistProfilesStorageKey);
      if (rawProfiles) {
        const parsedProfiles = JSON.parse(rawProfiles) as SavedWatchlistProfile[];
        if (Array.isArray(parsedProfiles) && parsedProfiles.length > 0) {
          nextProfiles = parsedProfiles
            .filter((profile) => typeof profile?.name === "string" && profile.name.trim())
            .map((profile) => ({
              id: typeof profile.id === "string" && profile.id.trim() ? profile.id : buildWatchlistProfileId(profile.name),
              name: profile.name.trim(),
              strategyId: typeof profile.strategyId === "string" ? profile.strategyId.trim() : fallbackStrategyId,
              itemKeys: Array.isArray(profile.itemKeys) ? profile.itemKeys.filter((itemKey): itemKey is string => typeof itemKey === "string") : [],
            }));
        }
      } else {
        const rawLegacyProfile = window.localStorage.getItem(legacyWatchlistProfileStorageKey);
        if (rawLegacyProfile) {
          const parsedLegacyProfile = JSON.parse(rawLegacyProfile) as { name?: string; strategyId?: string };
          const legacyName = typeof parsedLegacyProfile.name === "string" && parsedLegacyProfile.name.trim() ? parsedLegacyProfile.name.trim() : "My Watchlist";
          const legacyStrategyId = typeof parsedLegacyProfile.strategyId === "string" && parsedLegacyProfile.strategyId.trim()
            ? parsedLegacyProfile.strategyId.trim()
            : fallbackStrategyId;
          nextProfiles = [{ id: buildWatchlistProfileId(legacyName), name: legacyName, strategyId: legacyStrategyId, itemKeys: [] }];
        }
      }

      const storedActiveId = window.localStorage.getItem(activeWatchlistStorageKey);
      if (storedActiveId && nextProfiles.some((profile) => profile.id === storedActiveId)) {
        nextActiveId = storedActiveId;
      }
    } catch {
      nextProfiles = [buildDefaultWatchlistProfile(fallbackStrategyId)];
      nextActiveId = nextProfiles[0]?.id ?? "my-watchlist";
    }

    const normalizedProfiles = nextProfiles.map((profile, index) => ({
      ...profile,
      strategyId:
        profile.strategyId && savedStrategyOptions.some((option) => option.strategyId === profile.strategyId)
          ? profile.strategyId
          : fallbackStrategyId,
      id: profile.id || `${buildWatchlistProfileId(profile.name)}-${index}`,
    }));

    const resolvedActiveProfile = normalizedProfiles.find((profile) => profile.id === nextActiveId) ?? normalizedProfiles[0] ?? buildDefaultWatchlistProfile(fallbackStrategyId);

    setWatchlistProfiles(normalizedProfiles);
    setActiveWatchlistId(resolvedActiveProfile.id);
    setWatchlistName(resolvedActiveProfile.name);
    setWatchlistStrategyId(resolvedActiveProfile.strategyId);
    setWatchlistProfileInitialized(true);
  }, [activeWatchlistStorageKey, defaultStrategyOption?.strategyId, legacyWatchlistProfileStorageKey, savedStrategyOptions, watchlistProfileInitialized, watchlistProfilesStorageKey]);

  useEffect(() => {
    if (!watchlistProfileInitialized) {
      return;
    }

    try {
      window.localStorage.setItem(watchlistProfilesStorageKey, JSON.stringify(watchlistProfiles));
      window.localStorage.setItem(activeWatchlistStorageKey, activeWatchlistId);
    } catch {
      // Ignore local persistence failures.
    }
  }, [activeWatchlistId, activeWatchlistStorageKey, watchlistProfileInitialized, watchlistProfiles, watchlistProfilesStorageKey]);

  useEffect(() => {
    if (!activeWatchlistProfile) {
      return;
    }

    setWatchlistName(activeWatchlistProfile.name);
    setWatchlistStrategyId(activeWatchlistProfile.strategyId);
    setWatchlistPage(1);
  }, [activeWatchlistProfile]);

  useEffect(() => {
    if (!watchlistStrategyId) {
      const fallbackStrategyId = defaultStrategyOption?.strategyId ?? savedStrategyOptions[0]?.strategyId ?? "";
      if (fallbackStrategyId) {
        setWatchlistStrategyId(fallbackStrategyId);
      }
      return;
    }

    if (!savedStrategyOptions.some((option) => option.strategyId === watchlistStrategyId)) {
      const fallbackStrategyId = defaultStrategyOption?.strategyId ?? savedStrategyOptions[0]?.strategyId ?? "";
      setWatchlistStrategyId(fallbackStrategyId);
    }
  }, [defaultStrategyOption?.strategyId, savedStrategyOptions, watchlistStrategyId]);

  useEffect(() => {
    if (!workbenchStrategyId) {
      const fallbackStrategyId = defaultStrategyOption?.id ?? savedStrategyOptions[0]?.id ?? "";
      if (fallbackStrategyId) {
        setWorkbenchStrategyId(fallbackStrategyId);
      }
      return;
    }

    if (!savedStrategyOptions.some((option) => option.id === workbenchStrategyId || option.strategyId === workbenchStrategyId)) {
      const fallbackStrategyId = defaultStrategyOption?.id ?? savedStrategyOptions[0]?.id ?? "";
      setWorkbenchStrategyId(fallbackStrategyId);
    }
  }, [defaultStrategyOption?.id, savedStrategyOptions, workbenchStrategyId]);

  useEffect(() => {
    setMoversPage(1);
  }, [filter]);

  useEffect(() => {
    if (moversPage > moverTotalPages) {
      setMoversPage(moverTotalPages);
    }
  }, [moverTotalPages, moversPage]);

  useEffect(() => {
    if (watchlistPage > watchlistTotalPages) {
      setWatchlistPage(watchlistTotalPages);
    }
  }, [watchlistPage, watchlistTotalPages]);

  function syncWatchlistMembership(itemKeys: string[], profileId = activeWatchlistId) {
    setWatchlistProfiles((previous) =>
      previous.map((profile) =>
        profile.id === profileId
          ? { ...profile, itemKeys: Array.from(new Set([...profile.itemKeys, ...itemKeys])) }
          : profile,
      ),
    );
  }

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
        mode
          ? supabase
              .from("trades")
              .select("id, strategy_id, strategy_version_id, strategy_name, strategy_snapshot, direction, setup_types, conditions, chart_pattern, thesis, scores, conviction, created_at")
              .eq("user_id", userId)
              .eq("ticker", mover.ticker)
              .eq("mode", mode)
              .order("created_at", { ascending: false })
              .limit(4)
          : Promise.resolve({ data: [], error: null }),
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
    if (!mode) {
      throw new Error("MarketWatch requires a selected lane before saving watchlist items.");
    }

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

  async function addToWatchlist(mover: Mover, direction: "LONG" | "SHORT", note: string, strategyOverride?: StrategySelectionOption | null) {
    if (!marketWatchActionsEnabled) {
      setWatchlistMessage(marketWatchDisabledReason);
      return;
    }

    const normalized = await persistWatchlistRow({
      mover,
      direction,
      verdict: "WATCH",
      note,
      strategyId: strategyOverride?.strategyId ?? undefined,
      strategyVersionId: strategyOverride?.strategyVersionId ?? undefined,
      strategyName: strategyOverride?.label ?? undefined,
      strategySnapshot: strategyOverride?.strategySnapshot ?? undefined,
    });

    setWatchlistItems((previous) => mergeWatchlistItems(previous, [normalized]));
    syncWatchlistMembership([buildWatchlistItemKey(normalized)]);
  }

  async function persistWorkbenchItem(item: ScoredMover) {
    if (!marketWatchActionsEnabled) {
      setWatchlistMessage(marketWatchDisabledReason);
      return;
    }

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
    syncWatchlistMembership([buildWatchlistItemKey(normalized)]);
  }

  async function scoreMoverAgainstStrategy(params: {
    mover: Mover;
    strategy: StrategySelectionOption;
    direction: "LONG" | "SHORT";
    quote?: Quote | null;
    successMessage: string;
    closePreview?: boolean;
  }) {
    if (!marketWatchActionsEnabled || !mode) {
      setError(marketWatchDisabledReason);
      return;
    }

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
      closePreview: false,
    });
  }

  function updateWorkbenchField(strategyId: string, ticker: string, direction: "LONG" | "SHORT", field: "entry" | "stop", value: number | null) {
    const targetItem = visibleWatchlistItems.find((item) => buildStrategyScopedKey(item.strategyId, item.ticker, item.direction) === buildStrategyScopedKey(strategyId, ticker, direction))?.workbench;
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
    if (!marketWatchActionsEnabled) {
      setWatchlistMessage(marketWatchDisabledReason);
      return;
    }

    setWatchingTicker(mover.ticker);
    const watchlistStrategy = selectedWatchlistStrategy;
    const watchlistLabel = watchlistName.trim() || "My Watchlist";

    try {
      await addToWatchlist(
        mover,
        mover.changePct >= 0 ? "LONG" : "SHORT",
        `Added to ${watchlistLabel} for ${watchlistStrategy?.label ?? "the assigned strategy lane"}. ${mover.reason}`,
        watchlistStrategy,
      );
      setWatchlistMessage(`${mover.ticker} was added to ${watchlistLabel} (${watchlistStrategy?.label ?? "assigned strategy"}).`);
      setError(null);
    } catch {
      setError(`Unable to add ${mover.ticker} to the custom watchlist.`);
    } finally {
      setWatchingTicker(null);
    }
  }

  async function scoreWatchlistTicker(item: WatchlistItemView) {
    if (!marketWatchActionsEnabled) {
      setWatchlistMessage(marketWatchDisabledReason);
      return;
    }

    const strategy = selectedWorkbenchStrategy;
    if (!strategy) {
      setWatchlistMessage("Select a strategy for the scored workbench first.");
      return;
    }

    await scoreMoverAgainstStrategy({
      mover: buildMoverFromWatchlist(item),
      strategy,
      direction: item.direction,
      successMessage: `${item.ticker} scored with ${strategy.label} and moved to the scored workbench.`,
    });
  }

  async function handleDropToWatchlist(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setWatchlistDropActive(false);

    if (!marketWatchActionsEnabled) {
      setWatchlistMessage(marketWatchDisabledReason);
      return;
    }

    const dropped = readDroppedMoverFromEvent(event);
    if (!dropped) {
      return;
    }

    setWatchingTicker(dropped.mover.ticker);
    try {
      const watchlistStrategy = selectedWatchlistStrategy;
      const watchlistLabel = watchlistName.trim() || "My Watchlist";
      await addToWatchlist(
        dropped.mover,
        dropped.direction ?? (dropped.mover.changePct >= 0 ? "LONG" : "SHORT"),
        `Added via drag and drop into ${watchlistLabel} for ${watchlistStrategy?.label ?? "the assigned strategy lane"}.`,
        watchlistStrategy,
      );
      setWatchlistMessage(`${dropped.mover.ticker} was added to ${watchlistLabel} (${watchlistStrategy?.label ?? "assigned strategy"}).`);
      setError(null);
    } catch {
      setError(`Unable to add ${dropped.mover.ticker} to the custom watchlist.`);
    } finally {
      setWatchingTicker(null);
    }
  }

  async function handleDropToWorkbench(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setWorkbenchDropActive(false);

    if (!marketWatchActionsEnabled) {
      setWatchlistMessage(marketWatchDisabledReason);
      return;
    }

    const dropped = readDroppedMoverFromEvent(event);
    if (!dropped) {
      return;
    }

    const strategy = selectedWorkbenchStrategy;
    if (!strategy) {
      setWatchlistMessage("Select a strategy before dropping a ticker into the scored workbench.");
      return;
    }

    await scoreMoverAgainstStrategy({
      mover: dropped.mover,
      strategy,
      direction: dropped.direction ?? (dropped.mover.changePct >= 0 ? "LONG" : "SHORT"),
      successMessage: `${dropped.mover.ticker} scored with ${strategy.label} and saved to the scored workbench.`,
    });
  }

  async function removeWatchlistItem(item: WatchlistItemView) {
    setWatchingTicker(item.ticker);

    const itemKey = buildWatchlistItemKey(item);
    const existsInOtherWatchlists = watchlistProfiles.some((profile) => profile.id !== activeWatchlistId && profile.itemKeys.includes(itemKey));

    try {
      setWatchlistProfiles((previous) =>
        previous.map((profile) =>
          profile.id === activeWatchlistId ? { ...profile, itemKeys: profile.itemKeys.filter((entry) => entry !== itemKey) } : profile,
        ),
      );

      if (!existsInOtherWatchlists) {
        const { error: deleteError } = await supabase.from("watchlist_items").delete().eq("id", item.id);

        if (deleteError) {
          throw deleteError;
        }

        setWatchlistItems((previous) => previous.filter((entry) => entry.id !== item.id));
      }

      setWatchlistMessage(`${item.ticker} was removed from ${activeWatchlistProfile?.name ?? "the current watchlist"}.`);
      setError(null);
    } catch {
      setError(`Unable to remove ${item.ticker} from the current watchlist.`);
    } finally {
      setWatchingTicker(null);
    }
  }

  async function importTickers() {
    if (!marketWatchActionsEnabled) {
      setWatchlistMessage(marketWatchDisabledReason);
      return;
    }

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

      const watchlistStrategy = selectedWatchlistStrategy;
      const watchlistLabel = watchlistName.trim() || "My Watchlist";

      const persistedRows = await Promise.all(
        importedMovers.map((mover) =>
          persistWatchlistRow({
            mover,
            direction: (mover.changePct >= 0 ? "LONG" : "SHORT") as "LONG" | "SHORT",
            verdict: "WATCH",
            note: `Added manually into ${watchlistLabel} for ${watchlistStrategy?.label ?? "the assigned strategy lane"}.`,
            strategyId: watchlistStrategy?.strategyId ?? undefined,
            strategyVersionId: watchlistStrategy?.strategyVersionId ?? undefined,
            strategyName: watchlistStrategy?.label ?? undefined,
            strategySnapshot: watchlistStrategy?.strategySnapshot ?? undefined,
          }),
        ),
      );

      setMovers((previous) => mergeMovers(previous, importedMovers));
      setWatchlistItems((previous) => mergeWatchlistItems(previous, persistedRows));
      syncWatchlistMembership(persistedRows.map((item) => buildWatchlistItemKey(item)));
      setManualInput("");
      setError(null);

      const unresolved = Array.isArray(payload.unresolvedTickers) && payload.unresolvedTickers.length > 0
        ? ` Unavailable: ${payload.unresolvedTickers.join(", ")}.`
        : "";
      setWatchlistMessage(`Added ${importedMovers.length} ticker${importedMovers.length === 1 ? "" : "s"} to ${watchlistLabel} (${watchlistStrategy?.label ?? "assigned strategy"}).${unresolved}`);
    } catch (importError) {
      setWatchlistMessage(importError instanceof Error ? importError.message : "Ticker import failed.");
    } finally {
      setImporting(false);
    }
  }

  function saveWatchlistProfile() {
    if (!marketWatchActionsEnabled) {
      setWatchlistMessage(marketWatchDisabledReason);
      return;
    }

    const nextName = watchlistName.trim();
    if (!nextName) {
      setWatchlistMessage("Enter a custom watchlist name before saving.");
      return;
    }

    const strategy = selectedWatchlistStrategy;
    if (!strategy?.strategyId) {
      setWatchlistMessage("Pick a strategy before saving this watchlist profile.");
      return;
    }

    const matchingProfile = watchlistProfiles.find((profile) => profile.name.trim().toLowerCase() === nextName.toLowerCase()) ?? null;
    const nextProfileId = matchingProfile?.id ?? buildWatchlistProfileId(nextName);

    const safeStrategyId = strategy.strategyId!;

    try {
      setWatchlistProfiles((previous) => {
        if (previous.some((profile) => profile.id === nextProfileId)) {
          return previous.map((profile) =>
            profile.id === nextProfileId
              ? { ...profile, name: nextName, strategyId: safeStrategyId, itemKeys: profile.itemKeys }
              : profile,
          );
        }

        return [...previous, { id: nextProfileId, name: nextName, strategyId: safeStrategyId, itemKeys: [] }];
      });
      setActiveWatchlistId(nextProfileId);
      setWatchlistName(nextName);
      setWatchlistStrategyId(strategy.strategyId);
      setWatchlistMessage(`Saved \"${nextName}\" and mapped it to ${strategy.label}.`);
    } catch {
      setWatchlistMessage("Unable to save the custom watchlist profile locally.");
    }
  }

  function refreshMarketFeed() {
    const token = broadcastMarketDataRefresh("marketwatch-manual-refresh");
    setLastRefreshToken(token);
    setMoverRefreshToken(token);
  }

  async function deploy(item: ScoredMover) {
    if (!marketWatchActionsEnabled || !mode) {
      setError(marketWatchDisabledReason);
      return;
    }

    if (!userId || !item.conviction || item.entry == null || item.stop == null) {
      return;
    }

    if (circuitBreakerTripped) {
      setError("Circuit breaker is active. Use the full trade wizard to override.");
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
        state: "deployed",
        classification: "in_policy",
      });

      if (insertError) {
        throw insertError;
      }

      const watchlistRow = watchlistItems.find((entry) => buildStrategyScopedKey(entry.strategyId, entry.ticker, entry.direction) === buildStrategyScopedKey(item.strategyId, item.ticker, item.direction));
      if (watchlistRow) {
        const { error: deleteError } = await supabase.from("watchlist_items").delete().eq("id", watchlistRow.id);
        if (!deleteError) {
          setWatchlistItems((previous) => previous.filter((entry) => entry.id !== watchlistRow.id));
          const itemKey = buildWatchlistItemKey(watchlistRow);
          setWatchlistProfiles((previous) => previous.map((profile) => ({ ...profile, itemKeys: profile.itemKeys.filter((entry) => entry !== itemKey) })));
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
    <main className="terminal-page-shell marketwatch-terminal">
      <section className="surface-panel marketwatch-toolbar">
        <div className="terminal-page-header">
          <p className="meta-label">MarketWatch</p>
          <h2>MarketWatch</h2>
          <p className="page-intro">Discovery stays visible at the account level. The {formatModeLabel(mode)} configuration only changes scoring, watchlists, and deploy defaults.</p>
        </div>
        <div className="marketwatch-actions">
          <div className="import-shell">
            <input
              value={manualInput}
              onChange={(event) => setManualInput(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void importTickers();
                }
              }}
              placeholder="Import Tickers (e.g. NVDA, AAPL)"
              aria-label="Import tickers"
              disabled={!marketWatchActionsEnabled}
              className="import-input"
            />
            <button
              type="button"
              onClick={() => void importTickers()}
              disabled={importing || !marketWatchActionsEnabled}
              aria-label="Import tickers to watchlist"
              className="square-action primary-square disabled:cursor-not-allowed disabled:opacity-60"
            >
              {importing ? "…" : "+"}
            </button>
            <button
              type="button"
              onClick={refreshMarketFeed}
              disabled={refreshingFeed}
              aria-label="Refresh movers feed"
              className="square-action disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshingFeed ? "…" : "↻"}
            </button>
          </div>
          <span className="tag">{watchlistName.trim() || "My Watchlist"}</span>
        </div>
      </section>

      {!marketWatchActionsEnabled ? (
        <section className="priority-card warn">
          <p className="meta-label">MarketWatch Configuration</p>
          <p className="mt-2 text-sm text-tds-text">{marketWatchDisabledReason}</p>
        </section>
      ) : null}

      <section className="marketwatch-terminal-grid">
        <section className="market-column">
          <div className="section-heading-row">
            <div className="heading-with-tabs">
              <h3>Active Movers</h3>
              <div className="segmented-mini-tabs">
                {[
                  { key: "all", label: "All" },
                  { key: "gainers", label: "Gainers" },
                  { key: "losers", label: "Losers" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFilter(item.key as FilterTab)}
                    className={cn("mini-tab", filter === item.key ? "active" : "")}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <span className="tag">{visibleMovers.length} visible</span>
          </div>

          {error ? <div className="movers-status-error">{error}</div> : null}

          {loading && movers.length === 0 ? (
            <div className="movers-status-note">Loading movers...</div>
          ) : null}

          {visibleMovers.length === 0 && !loading ? (
            <div className="movers-status-note">No movers match the active filter right now.</div>
          ) : null}

          <MoversTable
            movers={pagedMovers}
            asOf={feedState?.asOf ?? null}
            loadingTicker={scoringTicker}
            watchingTicker={watchingTicker}
            watchEnabled={marketWatchActionsEnabled}
            watchDisabledLabel={!laneSelected ? "Lane" : "Config"}
            refreshingFeed={refreshingFeed}
            feedQualityLabel={feedQuality.label}
            currentPage={moversPage}
            totalPages={moverTotalPages}
            onPageChange={setMoversPage}
            onRefresh={refreshMarketFeed}
            onPreview={(mover) => setSelectedMover(mover)}
            onWatch={(mover) => void watchMover(mover)}
          />
        </section>

        <section className="workbench-column">
          <section className="surface-panel p-6">
            <div className="section-heading-row">
              <div>
                <p className="meta-label">Custom Watchlist</p>
                <h3>{watchlistName.trim() || "My Watchlist"}</h3>
              </div>
              <span className="tag">{visibleWatchlistItems.length} staged</span>
            </div>

            <div className="watchlist-tabs mt-4">
              {watchlistProfiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => setActiveWatchlistId(profile.id)}
                  className={cn("watchlist-tab", profile.id === activeWatchlistId ? "active" : "")}
                >
                  {profile.name}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <input
                id="watchlist-name-input"
                value={watchlistName}
                onChange={(event) => setWatchlistName(event.target.value)}
                placeholder="Watchlist name"
                disabled={!marketWatchActionsEnabled}
                className="h-11 w-full rounded-2xl border border-white/80 bg-white px-4 text-sm text-tds-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tds-focus"
              />
              <select
                id="watchlist-strategy-select"
                value={watchlistStrategyId}
                onChange={(event) => setWatchlistStrategyId(event.target.value)}
                disabled={!marketWatchActionsEnabled || !savedStrategyOptions.length}
                title="Watchlist strategy"
                className="h-11 w-full rounded-2xl border border-white/80 bg-white px-4 text-sm text-tds-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tds-focus"
              >
                {savedStrategyOptions.length === 0 ? <option value="">No strategies available</option> : null}
                {savedStrategyOptions.map((option) => (
                  <option key={option.id} value={option.strategyId ?? ""}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button type="button" variant="secondary" onClick={saveWatchlistProfile} disabled={!marketWatchActionsEnabled || !savedStrategyOptions.length}>
                Save
              </Button>
            </div>

            <p className="drop-hint mt-4">{marketWatchActionsEnabled ? "Drop a ticker here to stage it into the watchlist lane." : marketWatchDisabledReason}</p>

            <section
              className={cn("terminal-table-shell watchlist-shell mt-4", watchlistDropActive ? "drag-active" : "")}
              onDragOver={(event) => {
                event.preventDefault();
                setWatchlistDropActive(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setWatchlistDropActive(false);
                }
              }}
              onDrop={(event) => void handleDropToWatchlist(event)}
            >
              <div className="terminal-table-header four-col-header">
                <span>Ticker</span>
                <span>Status</span>
                <span>Added</span>
                <span>Action</span>
              </div>

              {watchlistLoading ? (
                <div className="empty-state-panel">
                  <p>Loading custom watchlist...</p>
                </div>
              ) : null}

              {!watchlistLoading && pagedWatchlistItems.length === 0 ? (
                <div className="empty-state-panel">
                  <p>No symbols yet. Drag from Active Movers or import tickers above.</p>
                </div>
              ) : null}

              {!watchlistLoading && pagedWatchlistItems.length > 0 ? (
                <div className="terminal-row-list">
                  {pagedWatchlistItems.map((item, index) => {
                    const rowMover = buildMoverFromWatchlist(item);
                    const busy = watchingTicker === item.ticker || scoringTicker === item.ticker;

                    return (
                      <article
                        key={item.id}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/plain", rowMover.ticker);
                          event.dataTransfer.setData("application/x-tds-mover", JSON.stringify(rowMover));
                          event.dataTransfer.setData("application/x-tds-direction", item.direction);
                          event.dataTransfer.effectAllowed = "copy";
                        }}
                        className={cn("terminal-table-row four-col-row", index % 2 === 0 ? "bg-white/70" : "bg-slate-50/60")}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedMover(rowMover)}
                          className="ticker-cell w-fit text-left font-mono text-sm font-semibold"
                        >
                          {item.ticker}
                        </button>

                        <span>
                          <span className={cn("inline-tag neutral", item.workbench ? "scored" : "")}> 
                            {item.workbench ? `${Math.round(item.workbench.passRate * 100)}% Scored` : item.verdict ?? "Staged"}
                          </span>
                        </span>

                        <span className="font-mono text-xs text-tds-dim">{formatWatchlistDate(item.lastScoredAt)}</span>

                        <span className="row-actions">
                          <button
                            type="button"
                            onClick={() => void scoreWatchlistTicker(item)}
                            disabled={busy || !marketWatchActionsEnabled}
                            title={`Score ${item.ticker}`}
                            aria-label={`Score ${item.ticker}`}
                            className="square-action h-8 w-8 rounded-lg border border-slate-200 text-sm leading-none"
                          >
                            ⚡
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeWatchlistItem(item)}
                            disabled={watchingTicker === item.ticker}
                            aria-label={`Remove ${item.ticker} from watchlist`}
                            title={`Remove ${item.ticker} from watchlist`}
                            className="square-action h-8 w-8 rounded-lg border border-slate-200 text-sm leading-none"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </article>
                    );
                  })}
                </div>
              ) : null}

              {watchlistTotalPages > 1 ? (
                <div className="marketwatch-pagination border-t border-slate-200/80 px-5 py-4">
                  <Button type="button" size="sm" variant="secondary" disabled={watchlistPage <= 1} onClick={() => setWatchlistPage((previous) => Math.max(1, previous - 1))}>
                    Previous
                  </Button>
                  <span className="tag">Page {watchlistPage} of {watchlistTotalPages}</span>
                  <Button type="button" size="sm" variant="secondary" disabled={watchlistPage >= watchlistTotalPages} onClick={() => setWatchlistPage((previous) => Math.min(watchlistTotalPages, previous + 1))}>
                    Next
                  </Button>
                </div>
              ) : null}
            </section>

            {watchlistMessage ? <p className="mt-4 text-sm text-tds-dim">{watchlistMessage}</p> : null}
          </section>

          <section className="surface-panel p-6">
            <div className="section-heading-row">
              <div>
                <p className="meta-label">Scored Workbench</p>
                <h3>Strategy-scored queue</h3>
              </div>
              <span className="tag">{scored.length} items ready</span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="grid gap-2">
                <label htmlFor="workbench-strategy-select" className="text-xs font-semibold uppercase tracking-[0.16em] text-tds-dim">
                  Score Strategy
                </label>
                <select
                  id="workbench-strategy-select"
                  value={workbenchStrategyId}
                  onChange={(event) => setWorkbenchStrategyId(event.target.value)}
                  disabled={!marketWatchActionsEnabled || !savedStrategyOptions.length}
                  className="h-11 w-full rounded-2xl border border-white/80 bg-white px-4 text-sm text-tds-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tds-focus"
                >
                  {savedStrategyOptions.length === 0 ? <option value="">No strategies available</option> : null}
                  {savedStrategyOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <span className="tag">{selectedWorkbenchStrategy?.label ?? "No strategy selected"}</span>
            </div>

            <p className="drop-hint mt-4">{marketWatchActionsEnabled ? "Select a strategy first, then drag a ticker from Active Movers or Watchlist into this workbench to score it." : marketWatchDisabledReason}</p>

            <section
              className={cn("workbench-dropzone mt-4", workbenchDropActive ? "drag-active" : "")}
              onDragOver={(event) => {
                event.preventDefault();
                setWorkbenchDropActive(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setWorkbenchDropActive(false);
                }
              }}
              onDrop={(event) => void handleDropToWorkbench(event)}
            >
              {scored.length === 0 ? (
                <section className="surface-panel empty-workbench-card">
                  <div className="empty-state-panel">
                    <p>No scored items in workbench. Drag a ticker here to calculate a strategy-specific score.</p>
                  </div>
                </section>
              ) : (
                <ScoredList
                  items={scored}
                  equity={equity}
                  loadingKey={deployingKey}
                  onEntryChange={(strategyId, ticker, direction, value) => updateWorkbenchField(strategyId, ticker, direction, "entry", value)}
                  onStopChange={(strategyId, ticker, direction, value) => updateWorkbenchField(strategyId, ticker, direction, "stop", value)}
                  onDeploy={(item) => void deploy(item)}
                />
              )}
            </section>
          </section>
        </section>
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
        scoringEnabled={marketWatchActionsEnabled}
        scoringDisabledReason={marketWatchDisabledReason}
        onScore={() => void scoreSelectedPreview()}
        onClose={() => setSelectedMover(null)}
        existingConvictionLabel={previewWorkbench?.conviction?.tier ?? selectedStrategy?.previousConviction ?? null}
        feedQualityLabel={feedQuality.label}
        planTradeHref={previewPlanTradeHref}
      />
    </main>
  );
}
