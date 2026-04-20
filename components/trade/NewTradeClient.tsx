"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ThesisStep from "@/components/trade/ThesisStep";
import AssessmentStep from "@/components/trade/AssessmentStep";
import SizingStep from "@/components/trade/SizingStep";
import ConfirmStep from "@/components/trade/ConfirmStep";
import InlineFrictionZone from "@/components/trade/InlineFrictionZone";
import CircuitBreakerModal from "@/components/trade/CircuitBreakerModal";
import AmbientNudges from "@/components/trade/AmbientNudges";
import { ContextualObserverRail } from "@/components/trade/ContextualObserverRail";
import PriceChart from "@/components/chart/PriceChart";
import { extractAIResponseMeta } from "@/lib/ai/response";
import { createClient } from "@/lib/supabase/client";
import { getCandleRange, getDefaultCandleTimeframe } from "@/lib/market/candle-range";
import { buildStructureLibraryInsert, normalizeStructureLibraryRow } from "@/lib/trading/structure-library";
import { getConviction } from "@/lib/trading/scoring";
import { updateStrategySnapshotStructure } from "@/lib/trading/strategies";
import { resolveMetricAssessmentDescription } from "@/lib/trading/user-metrics";
import { computeGatePermissions, detectContradictions, evaluateGates, isSizingComplete, validatePortfolioHeat } from "@/lib/trading/validation";
import { extractBrokenRules } from "@/lib/trading/override";
import { executionSchema, thesisSchema } from "@/lib/validation/forms";
import type { GatePermissions } from "@/lib/trading/validation";
import type { Database } from "@/types/database";
import type { TradeStructureLibraryItem, TradeStructureItemType } from "@/types/structure-library";
import type { SavedStrategy } from "@/types/strategy";
import type {
  AIInsight,
  ConvictionTier,
  DisciplineProfile,
  Position,
  TradeNotes,
  TradeScores,
  TradeThesis,
  TradeMode,
} from "@/types/trade";
import type { Candle, CandleTimeframe, Quote } from "@/types/market";
import type { AIResponseMeta } from "@/lib/ai/response";

type SizingState = {
  quote: Quote | null;
  entryPrice: number | null;
  stopLoss: number | null;
  position: Position | null;
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type NewTradeClientProps = {
  userId: string;
  initialMode: TradeMode;
  initialEquity: number;
  initialStrategies: SavedStrategy[];
  initialStrategyId: string;
  initialStructureLibrary: TradeStructureLibraryItem[];
  initialHeat: number;
};

type GateKey = keyof GatePermissions;

const DEFAULT_THESIS: TradeThesis = {
  ticker: "",
  direction: "LONG",
  assetClass: "Equity",
  setupTypes: [],
  conditions: [],
  chartPattern: "None",
  thesis: "",
  catalystWindow: "",
  invalidation: "",
};

const GATE_META: Array<{ key: keyof GatePermissions; label: string; detail: string }> = [
  { key: "identification", label: "Identification", detail: "Define the opportunity" },
  { key: "assessment", label: "Assessment", detail: "Score the evidence" },
  { key: "sizing", label: "Sizing", detail: "Lock risk and entries" },
  { key: "deployment", label: "Deployment", detail: "Review and deploy" },
];

function formatModeLabel(mode: TradeMode): string {
  if (mode === "daytrade") {
    return "Day Trade";
  }
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function SummaryPills({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="mt-2 text-sm leading-6 text-tds-dim">{emptyLabel}</p>;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="trade-summary-pill">
          {item}
        </span>
      ))}
    </div>
  );
}

export default function NewTradeClient({
  userId,
  initialMode,
  initialEquity,
  initialStrategies,
  initialStrategyId,
  initialStructureLibrary,
  initialHeat,
}: NewTradeClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const mode = initialMode;
  const equity = initialEquity;
  const currentHeat = initialHeat;

  const [selectedStrategyId, setSelectedStrategyId] = useState(initialStrategyId);
  const [structureLibrary, setStructureLibrary] = useState<TradeStructureLibraryItem[]>(initialStructureLibrary);
  const [thesis, setThesis] = useState<TradeThesis>(DEFAULT_THESIS);
  const [scores, setScores] = useState<TradeScores>({});
  const [notes, setNotes] = useState<TradeNotes>({});
  const [insight, setInsight] = useState<AIInsight | null>(null);

  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [assessmentMeta, setAssessmentMeta] = useState<AIResponseMeta | null>(null);
  const [draftMeta, setDraftMeta] = useState<AIResponseMeta | null>(null);
  const [insightMeta, setInsightMeta] = useState<AIResponseMeta | null>(null);
  const [smartStopHint, setSmartStopHint] = useState<string | null>(null);
  const [headerCandles, setHeaderCandles] = useState<Candle[]>([]);
  const [headerTimeframe, setHeaderTimeframe] = useState<CandleTimeframe>(() => getDefaultCandleTimeframe(mode));

  const [sizing, setSizing] = useState<SizingState>({
    quote: null,
    entryPrice: null,
    stopLoss: null,
    position: null,
  });

  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [overrideJustification, setOverrideJustification] = useState<string | null>(null);
  const [disciplineProfile, setDisciplineProfile] = useState<DisciplineProfile>("balanced");
  const [disciplineScore, setDisciplineScore] = useState<number | null>(null);
  const [circuitBreakerStatus, setCircuitBreakerStatus] = useState<{ tripped: boolean; reason: string | null; consecutiveLosses: number; drawdownPercent: number; config: { maxConsecutiveLosses: number; maxDrawdownPercent: number } } | null>(null);
  const [circuitBreakerOverridden, setCircuitBreakerOverridden] = useState(false);
  const [circuitBreakerModalOpen, setCircuitBreakerModalOpen] = useState(false);
  const [activeStepKey, setActiveStepKey] = useState<GateKey>("identification");
  const prefillAppliedRef = useRef(false);

  const selectedStrategy = initialStrategies.find((strategy) => strategy.id === selectedStrategyId) ?? initialStrategies[0] ?? null;
  const metrics = selectedStrategy?.metrics.filter((metric) => metric.enabled) ?? [];

  const fundamentalMetrics = metrics.filter((metric) => metric.type === "fundamental");
  const technicalMetrics = metrics.filter((metric) => metric.type === "technical");
  const fTotal = fundamentalMetrics.length;
  const tTotal = technicalMetrics.length;
  const fMin = Math.max(1, Math.ceil(fTotal * 0.7));
  const tMin = tTotal;

  const fScore = fundamentalMetrics.reduce((sum, metric) => sum + (scores[metric.id] ?? 0), 0);
  const tScore = technicalMetrics.reduce((sum, metric) => sum + (scores[metric.id] ?? 0), 0);
  const conviction: ConvictionTier | null = getConviction(fScore, fTotal, tScore, tTotal);

  // When overriding failed gates, use STD conviction as default
  const isOverrideApproved = overrideJustification !== null;
  const effectiveConviction: ConvictionTier | null = conviction ?? (isOverrideApproved ? { tier: "STD", risk: 0.02, color: "#d97706" } : null);

  const fPass = fScore >= fMin;
  const tPass = tScore >= tMin;

  const gateResult = evaluateGates(scores, fundamentalMetrics, technicalMetrics, disciplineProfile);
  const rawGatePermissions = computeGatePermissions(thesis, scores, metrics, gateResult, sizing.entryPrice, sizing.stopLoss);

  // Override unlocks sizing + deployment even when gates fail
  const assessmentComplete = rawGatePermissions.identification === "complete" && rawGatePermissions.assessment !== "locked";
  const isGateBlocked = !gateResult.passed && assessmentComplete;
  const gatePermissions: GatePermissions = isOverrideApproved && isGateBlocked
    ? (() => {
        const sizingDone = isSizingComplete(sizing.entryPrice, sizing.stopLoss, thesis.direction);
        return {
          ...rawGatePermissions,
          sizing: sizingDone ? "complete" as const : "active" as const,
          deployment: sizingDone ? "active" as const : "locked" as const,
        };
      })()
    : rawGatePermissions;

  const activeGate = GATE_META.find((g) => gatePermissions[g.key] === "active") ?? GATE_META[0];
  const availableStepKeys = useMemo(
    () => GATE_META.filter((gate, index) => index === 0 || gatePermissions[gate.key] !== "locked").map((gate) => gate.key),
    [gatePermissions],
  );
  const viewedGate = GATE_META.find((gate) => gate.key === activeStepKey) ?? activeGate;

  useEffect(() => {
    if (!availableStepKeys.includes(activeStepKey)) {
      setActiveStepKey(activeGate.key);
    }
  }, [activeGate.key, activeStepKey, availableStepKeys]);

  const rulesBroken = useMemo(
    () => extractBrokenRules(gateResult.action, gateResult.reason, fScore, fTotal, tScore, tTotal),
    [gateResult.action, gateResult.reason, fScore, fTotal, tScore, tTotal],
  );

  const contradictions = useMemo(() => {
    if (!thesis.thesis.trim() || thesis.setupTypes.length === 0) {
      return [];
    }

    return detectContradictions(thesis);
  }, [thesis]);

  function updateThesis(patch: Partial<TradeThesis>) {
    setThesis((previous) => ({ ...previous, ...patch }));
  }

  useEffect(() => {
    if (prefillAppliedRef.current) {
      return;
    }

    const ticker = searchParams.get("ticker")?.trim();
    const direction = searchParams.get("direction");
    const strategyId = searchParams.get("strategyId")?.trim();
    const thesisText = searchParams.get("thesis")?.trim();
    const setupTypes = searchParams
      .get("setupTypes")
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
    const conditions = searchParams
      .get("conditions")
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
    const chartPattern = searchParams.get("chartPattern")?.trim();
    const assetClass = searchParams.get("assetClass")?.trim();

    if (!ticker && !thesisText && !strategyId) {
      return;
    }

    prefillAppliedRef.current = true;

    if (strategyId && initialStrategies.some((strategy) => strategy.id === strategyId) && strategyId !== selectedStrategyId) {
      setSelectedStrategyId(strategyId);
    }

    setScores({});
    setNotes({});
    setInsight(null);
    setAssessmentError(null);
    setAssessmentMeta(null);
    setDraftMeta(null);
    setInsightMeta(null);
    setSmartStopHint(null);
    setDeployError(null);
    setSizing({
      quote: null,
      entryPrice: null,
      stopLoss: null,
      position: null,
    });
    setThesis((previous) => ({
      ...previous,
      ticker: ticker ? ticker.toUpperCase() : previous.ticker,
      direction: direction === "LONG" || direction === "SHORT" ? direction : previous.direction,
      assetClass: assetClass || previous.assetClass,
      setupTypes: setupTypes.length > 0 ? setupTypes : previous.setupTypes,
      conditions: conditions.length > 0 ? conditions : previous.conditions,
      chartPattern: chartPattern || previous.chartPattern,
      thesis: thesisText || previous.thesis,
    }));
  }, [initialStrategies, searchParams, selectedStrategyId]);

  function applyStrategyDefaults(strategy: SavedStrategy) {
    setThesis((previous) => ({
      ...previous,
      setupTypes: previous.setupTypes.length > 0 ? previous.setupTypes : strategy.structure.setupTypes,
      conditions: previous.conditions.length > 0 ? previous.conditions : strategy.structure.conditions,
      chartPattern: previous.chartPattern !== "None" ? previous.chartPattern : strategy.structure.chartPattern || "None",
      invalidation: previous.invalidation.trim() ? previous.invalidation : strategy.structure.invalidationStyle,
    }));
  }

  function handleStrategyChange(nextStrategyId: string) {
    const nextStrategy = initialStrategies.find((strategy) => strategy.id === nextStrategyId);
    if (!nextStrategy) {
      return;
    }

    setSelectedStrategyId(nextStrategyId);
    setScores({});
    setNotes({});
    setInsight(null);
    setAssessmentError(null);
    setDeployError(null);
    setAssessmentMeta(null);
    setDraftMeta(null);
    setInsightMeta(null);
    setSmartStopHint(null);
    setSizing({
      quote: null,
      entryPrice: null,
      stopLoss: null,
      position: null,
    });
    setThesis((previous) => ({
      ...previous,
      setupTypes: nextStrategy.structure.setupTypes,
      conditions: nextStrategy.structure.conditions,
      chartPattern: nextStrategy.structure.chartPattern || "None",
      invalidation: nextStrategy.structure.invalidationStyle,
    }));
  }

  useEffect(() => {
    if (selectedStrategy) {
      applyStrategyDefaults(selectedStrategy);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStrategyId]);

  useEffect(() => {
    setHeaderTimeframe(getDefaultCandleTimeframe(mode));
  }, [mode]);

  // Fetch discipline profile for override friction timer
  useEffect(() => {
    supabase
      .from("profiles")
      .select("discipline_profile")
      .eq("id", userId)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (error?.code === "42703" && (error.message ?? "").includes("discipline_profile")) {
          return;
        }

        if (data?.discipline_profile) {
          setDisciplineProfile(data.discipline_profile as DisciplineProfile);
        }
      });
  }, [supabase, userId]);

  // Fetch discipline score for ambient HUD
  useEffect(() => {
    fetch("/api/discipline")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data && typeof data.score === "number") setDisciplineScore(data.score);
      })
      .catch(() => {});
  }, []);

  // Fetch circuit breaker status on mount
  useEffect(() => {
    fetch("/api/circuit-breaker")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setCircuitBreakerStatus(data);
          if (data.tripped) setCircuitBreakerModalOpen(true);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    async function loadHeaderQuote() {
      if (!thesis.ticker.trim()) {
        setSizing((previous) => ({
          ...previous,
          quote: null,
        }));
        return;
      }

      try {
        const response = await fetch(`/api/market/quote?ticker=${encodeURIComponent(thesis.ticker)}`, { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const quote = (await response.json()) as Quote;
        setSizing((previous) => ({
          ...previous,
          quote,
          entryPrice: previous.entryPrice ?? quote.price,
        }));
      } catch {
        // Keep the header quiet if quote data is unavailable.
      }
    }

    void loadHeaderQuote();
  }, [thesis.ticker]);

  useEffect(() => {
    async function loadHeaderCandles() {
      if (!thesis.ticker.trim()) {
        setHeaderCandles([]);
        return;
      }

      const range = getCandleRange(mode, headerTimeframe);
      const params = new URLSearchParams({
        ticker: thesis.ticker,
        from: range.from,
        to: range.to,
        timeframe: range.timeframe,
      });

      try {
        const response = await fetch(`/api/market/candles?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) {
          setHeaderCandles([]);
          return;
        }

        const data = (await response.json()) as Candle[];
        setHeaderCandles(Array.isArray(data) ? data : []);
      } catch {
        setHeaderCandles([]);
      }
    }

    void loadHeaderCandles();
  }, [headerTimeframe, mode, thesis.ticker]);

  async function saveSharedStructureItem(itemType: TradeStructureItemType, label: string) {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      return;
    }

    const existing = structureLibrary.find(
      (item) => item.itemType === itemType && item.label.trim().toLowerCase() === trimmedLabel.toLowerCase(),
    );
    if (existing) {
      return;
    }

    const { data, error } = await supabase
      .from("user_trade_structure_items")
      .insert(buildStructureLibraryInsert(userId, itemType, trimmedLabel, "Custom", "Added from the guided thesis flow.", [trimmedLabel]))
      .select("*")
      .single();

    if (error || !data) {
      setToast({ type: "error", message: `Failed to save ${trimmedLabel} to the shared library.` });
      return;
    }

    setStructureLibrary((previous) => [normalizeStructureLibraryRow(data), ...previous]);
    setToast({ type: "success", message: `${trimmedLabel} is now available across all strategies.` });
  }

  const tradeStrategySnapshot = selectedStrategy
    ? updateStrategySnapshotStructure(selectedStrategy.snapshot, {
        setupTypes: thesis.setupTypes.length > 0 ? thesis.setupTypes : selectedStrategy.structure.setupTypes,
        conditions: thesis.conditions.length > 0 ? thesis.conditions : selectedStrategy.structure.conditions,
        chartPattern: thesis.chartPattern || selectedStrategy.structure.chartPattern,
        invalidationStyle: thesis.invalidation.trim() || selectedStrategy.structure.invalidationStyle,
      })
    : null;

  async function runAssessment() {
    if (!thesis.ticker || metrics.length === 0 || !selectedStrategy) {
      return;
    }

    setAssessmentLoading(true);
    setAssessmentError(null);
    setAssessmentMeta(null);

    try {
      const payload = {
        ticker: thesis.ticker,
        direction: thesis.direction,
        thesis: thesis.thesis,
        setups: thesis.setupTypes,
        conditions: thesis.conditions,
        chartPattern: thesis.chartPattern,
        asset: thesis.assetClass,
        mode,
        strategyName: selectedStrategy.name,
        strategyInstruction: selectedStrategy.aiInstruction,
        metrics: metrics.map((metric) => ({
          id: metric.id,
          name: metric.name,
          desc: resolveMetricAssessmentDescription(metric, thesis.direction),
        })),
      };

      const response = await fetch("/api/ai/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Assessment service unavailable");
      }

      setAssessmentMeta(extractAIResponseMeta(response));

      const data = (await response.json()) as Record<string, { v: "PASS" | "FAIL"; r: string }>;
      const nextScores: TradeScores = {};
      const nextNotes: TradeNotes = {};

      for (const metric of metrics) {
        const result = data[metric.id];
        if (!result) {
          continue;
        }
        nextScores[metric.id] = result.v === "PASS" ? 1 : 0;
        nextNotes[metric.id] = result.r;
      }

      setScores((previous) => ({ ...previous, ...nextScores }));
      setNotes((previous) => ({ ...previous, ...nextNotes }));
    } catch {
      setAssessmentError("AI assessment unavailable. You can still score metrics manually.");
    } finally {
      setAssessmentLoading(false);
    }
  }

  function isDirectionalStopValid(
    direction: "LONG" | "SHORT",
    entryPrice: number | null,
    stopLoss: number | null,
  ): boolean {
    if (entryPrice == null || stopLoss == null) {
      return false;
    }

    if (direction === "LONG") {
      return stopLoss < entryPrice;
    }

    return stopLoss > entryPrice;
  }

  async function runThesisDraft() {
    if (!selectedStrategy || !thesis.ticker.trim()) {
      setToast({ type: "error", message: "Enter a ticker first, then generate the AI draft." });
      return;
    }

    setDraftLoading(true);
    setDraftMeta(null);

    try {
      const response = await fetch("/api/ai/thesis-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: thesis.ticker,
          direction: thesis.direction,
          strategyId: selectedStrategy.id,
          assetClass: thesis.assetClass,
        }),
      });

      if (!response.ok) {
        throw new Error("Thesis draft service unavailable");
      }

      setDraftMeta(extractAIResponseMeta(response));

      const data = (await response.json()) as {
        thesis: string;
        catalystWindow: string;
        invalidation: string;
        suggestedStop: number | null;
        stopReason: string | null;
        quotePrice: number | null;
      };

      setThesis((previous) => ({
        ...previous,
        thesis: data.thesis || previous.thesis,
        catalystWindow: data.catalystWindow || previous.catalystWindow,
        invalidation: data.invalidation || previous.invalidation,
      }));

      const nextEntryPrice = sizing.entryPrice ?? data.quotePrice ?? null;
      const canApplySuggestedStop =
        typeof data.suggestedStop === "number" &&
        Number.isFinite(data.suggestedStop) &&
        data.suggestedStop > 0 &&
        isDirectionalStopValid(thesis.direction, nextEntryPrice, data.suggestedStop);

      if (canApplySuggestedStop) {
        setSizing((previous) => ({
          ...previous,
          entryPrice: previous.entryPrice ?? data.quotePrice ?? null,
          stopLoss: data.suggestedStop,
        }));
      }

      setSmartStopHint(data.stopReason ?? null);
      setToast({
        type: "success",
        message: canApplySuggestedStop
          ? "AI draft applied. Smart stop prefilled in sizing."
          : "AI draft applied. Review the suggested stop in sizing.",
      });
    } catch {
      setToast({ type: "error", message: "AI thesis draft unavailable right now." });
    } finally {
      setDraftLoading(false);
    }
  }

  async function runInsight() {
    setInsightLoading(true);
    setInsightMeta(null);
    try {
      const passed = metrics.filter((metric) => scores[metric.id] === 1).map((metric) => metric.name);
      const failed = metrics.filter((metric) => scores[metric.id] === 0).map((metric) => metric.name);

      const response = await fetch("/api/ai/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: thesis.ticker,
          direction: thesis.direction,
          passed,
          failed,
          thesis: thesis.thesis,
        }),
      });

      if (!response.ok) {
        throw new Error("insight failed");
      }

      setInsightMeta(extractAIResponseMeta(response));
      const insightData = (await response.json()) as AIInsight;
      setInsight(insightData);
    } catch {
      setToast({ type: "error", message: "AI insight unavailable right now." });
    } finally {
      setInsightLoading(false);
    }
  }

  async function onThesisNext() {
    const validation = thesisSchema.safeParse({
      ticker: thesis.ticker,
      direction: thesis.direction,
      assetClass: thesis.assetClass,
      setupTypes: thesis.setupTypes,
      thesis: thesis.thesis,
      invalidation: thesis.invalidation,
      catalystWindow: thesis.catalystWindow,
    });

    if (!validation.success) {
      setToast({ type: "error", message: validation.error.issues[0]?.message ?? "Invalid thesis inputs." });
      return;
    }

    setActiveStepKey("assessment");
    await runAssessment();
  }

  async function onAssessmentNext() {
    if (!selectedStrategy || !tradeStrategySnapshot) {
      setToast({ type: "error", message: "Choose a saved strategy before continuing." });
      return;
    }

    if (fPass && !tPass) {
      await supabase.from("trades").insert({
        user_id: userId,
        strategy_id: selectedStrategy.id,
        strategy_version_id: selectedStrategy.activeVersionId,
        strategy_name: selectedStrategy.name,
        strategy_snapshot: tradeStrategySnapshot as unknown as Database["public"]["Tables"]["trades"]["Insert"]["strategy_snapshot"],
        ticker: thesis.ticker,
        direction: thesis.direction,
        asset_class: thesis.assetClass,
        mode,
        setup_types: thesis.setupTypes,
        conditions: thesis.conditions,
        chart_pattern: thesis.chartPattern,
        thesis: thesis.thesis,
        catalyst_window: thesis.catalystWindow || null,
        invalidation: thesis.invalidation,
        scores,
        notes,
        f_score: fScore,
        t_score: tScore,
        f_total: fTotal,
        t_total: tTotal,
        source: "thesis",
        confirmed: false,
        closed: false,
      });

      await supabase.from("watchlist_items").upsert(
        {
          user_id: userId,
          strategy_id: selectedStrategy.id,
          strategy_version_id: selectedStrategy.activeVersionId,
          strategy_name: selectedStrategy.name,
          strategy_snapshot: tradeStrategySnapshot as unknown as Database["public"]["Tables"]["watchlist_items"]["Insert"]["strategy_snapshot"],
          ticker: thesis.ticker,
          direction: thesis.direction,
          asset_class: thesis.assetClass,
          mode,
          scores: {
            fScore,
            tScore,
            fTotal,
            tTotal,
          },
          verdict: "WATCH",
          note: "Fundamentals pass, technical gate pending.",
          source: "thesis",
          last_scored_at: new Date().toISOString(),
        },
        { onConflict: "user_id,strategy_id,ticker,direction" },
      );

      router.push("/marketwatch");
      return;
    }

    if (!(fPass && tPass)) {
      setToast({ type: "error", message: "Assessment gates not met yet." });
      return;
    }

    setActiveStepKey("sizing");
  }

  function goToStep(step: GateKey) {
    if (!availableStepKeys.includes(step)) {
      return;
    }

    setActiveStepKey(step);
  }

  async function onDeploy() {
    // Circuit breaker check — block unless overridden
    if (circuitBreakerStatus?.tripped && !circuitBreakerOverridden) {
      setCircuitBreakerModalOpen(true);
      return;
    }

    if (!effectiveConviction || !sizing.position || sizing.entryPrice == null || sizing.stopLoss == null || !selectedStrategy || !tradeStrategySnapshot) {
      setDeployError("Missing required sizing data.");
      return;
    }

    const executionValidation = executionSchema.safeParse({
      entryPrice: sizing.entryPrice,
      stopLoss: sizing.stopLoss,
    });
    if (!executionValidation.success) {
      setDeployError(executionValidation.error.issues[0]?.message ?? "Invalid execution values.");
      return;
    }

    const heatCheck = validatePortfolioHeat(currentHeat / 100, effectiveConviction.risk);
    if (!heatCheck.allowed) {
      setDeployError(heatCheck.reason);
      return;
    }

    setDeployError(null);
    setDeploying(true);

    try {
      const trancheDeadline = new Date();
      trancheDeadline.setDate(trancheDeadline.getDate() + 7);

      const payload: Database["public"]["Tables"]["trades"]["Insert"] = {
        user_id: userId,
        strategy_id: selectedStrategy.id,
        strategy_version_id: selectedStrategy.activeVersionId,
        strategy_name: selectedStrategy.name,
        strategy_snapshot: tradeStrategySnapshot as unknown as Database["public"]["Tables"]["trades"]["Insert"]["strategy_snapshot"],
        ticker: thesis.ticker,
        direction: thesis.direction,
        asset_class: thesis.assetClass,
        mode,
        setup_types: thesis.setupTypes,
        conditions: thesis.conditions,
        chart_pattern: thesis.chartPattern,
        thesis: thesis.thesis,
        catalyst_window: thesis.catalystWindow || null,
        invalidation: thesis.invalidation,
        scores,
        notes,
        f_score: fScore,
        t_score: tScore,
        f_total: fTotal,
        t_total: tTotal,
        conviction: effectiveConviction.tier,
        risk_pct: effectiveConviction.risk,
        entry_price: sizing.entryPrice,
        stop_loss: sizing.stopLoss,
        shares: sizing.position.shares,
        tranche1_shares: sizing.position.tranche1,
        tranche2_shares: sizing.position.tranche2,
        tranche2_filled: false,
        tranche2_deadline: trancheDeadline.toISOString(),
        exit_t1: false,
        exit_t2: false,
        exit_t3: false,
        r2_target: sizing.position.r2Target,
        r4_target: sizing.position.r4Target,
        market_price: sizing.quote?.price ?? null,
        confirmed: true,
        closed: false,
        source: "thesis",
        state: "deployed",
        classification: "in_policy",
        insight: insight as Database["public"]["Tables"]["trades"]["Insert"]["insight"],
      };

      const { error } = await supabase.from("trades").insert(payload);
      if (error) {
        throw error;
      }

      window.dispatchEvent(new Event("tds:trade-deployed"));
      setToast({ type: "success", message: "Trade deployed successfully." });
      setTimeout(() => {
        router.push("/dashboard");
      }, 700);
    } catch {
      setDeployError("Failed to deploy trade. Please retry.");
    } finally {
      setDeploying(false);
    }
  }

  async function handleOverrideConfirm(justification: string) {
    if (!effectiveConviction || !sizing.position || sizing.entryPrice == null || sizing.stopLoss == null || !selectedStrategy || !tradeStrategySnapshot) {
      throw new Error("Missing required trade data.");
    }

    // 1. Insert the trade as blocked first
    const trancheDeadline = new Date();
    trancheDeadline.setDate(trancheDeadline.getDate() + 7);

    const payload: Database["public"]["Tables"]["trades"]["Insert"] = {
      user_id: userId,
      strategy_id: selectedStrategy.id,
      strategy_version_id: selectedStrategy.activeVersionId,
      strategy_name: selectedStrategy.name,
      strategy_snapshot: tradeStrategySnapshot as unknown as Database["public"]["Tables"]["trades"]["Insert"]["strategy_snapshot"],
      ticker: thesis.ticker,
      direction: thesis.direction,
      asset_class: thesis.assetClass,
      mode,
      setup_types: thesis.setupTypes,
      conditions: thesis.conditions,
      chart_pattern: thesis.chartPattern,
      thesis: thesis.thesis,
      catalyst_window: thesis.catalystWindow || null,
      invalidation: thesis.invalidation,
      scores,
      notes,
      f_score: fScore,
      t_score: tScore,
      f_total: fTotal,
      t_total: tTotal,
      conviction: effectiveConviction.tier,
      risk_pct: effectiveConviction.risk,
      entry_price: sizing.entryPrice,
      stop_loss: sizing.stopLoss,
      shares: sizing.position.shares,
      tranche1_shares: sizing.position.tranche1,
      tranche2_shares: sizing.position.tranche2,
      tranche2_filled: false,
      tranche2_deadline: trancheDeadline.toISOString(),
      exit_t1: false,
      exit_t2: false,
      exit_t3: false,
      r2_target: sizing.position.r2Target,
      r4_target: sizing.position.r4Target,
      market_price: sizing.quote?.price ?? null,
      confirmed: false,
      closed: false,
      source: "thesis",
      state: "blocked",
      classification: "override",
      insight: insight as Database["public"]["Tables"]["trades"]["Insert"]["insight"],
    };

    const { data: insertedTrade, error: insertError } = await supabase
      .from("trades")
      .insert(payload)
      .select("id")
      .single();

    if (insertError || !insertedTrade) {
      throw new Error("Failed to save trade.");
    }

    // 2. Call override API to transition blocked → overridden
    const overrideRes = await fetch("/api/trade/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tradeId: insertedTrade.id, justification }),
    });

    if (!overrideRes.ok) {
      const errData = await overrideRes.json().catch(() => ({}));
      throw new Error(errData.error ?? "Override failed.");
    }

    window.dispatchEvent(new Event("tds:trade-deployed"));
    setToast({ type: "success", message: "Trade deployed via override." });
    setTimeout(() => {
      router.push("/dashboard");
    }, 700);
  }

  return (
    <main className="new-trade-terminal">
      <div className="trade-header-row">
        <div className="terminal-page-header">
          <p className="meta-label">Trade execution</p>
          <h1>New Trade Entry</h1>
          <p className="page-intro">Build the thesis, clear the gates, and size the position inside the {formatModeLabel(mode).toLowerCase()} lane.</p>
        </div>

        <div className="trade-gate-indicators" aria-label="gate progress">
          {GATE_META.map((gate, index) => (
            <button
              key={gate.key}
              type="button"
              className="trade-gate-indicator"
              data-state={gatePermissions[gate.key]}
              aria-current={activeStepKey === gate.key ? "step" : undefined}
              disabled={!availableStepKeys.includes(gate.key)}
              onClick={() => goToStep(gate.key)}
            >
              <span className="gate-number">{String(index + 1).padStart(2, "0")}</span>
              <span>{gate.label}</span>
            </button>
          ))}
        </div>
      </div>

      {circuitBreakerStatus?.tripped && !circuitBreakerOverridden && (
        <div className="circuit-breaker-banner" role="alert">
          <span className="circuit-breaker-banner-icon">⚠</span>
          <div>
            <strong>Circuit Breaker Active</strong>
            <p>{circuitBreakerStatus.reason}</p>
          </div>
          <button className="circuit-breaker-banner-btn" onClick={() => setCircuitBreakerModalOpen(true)}>
            Details
          </button>
        </div>
      )}

      <section className="surface-panel trade-form-shell">
        <div className="trade-context-band">
          <div className="trade-context-summary">
            <div className="trade-context-header">
              <div>
                <p className="meta-label">Pinned Trade Context</p>
                <h2>{thesis.ticker || "Select a ticker"} {thesis.direction === "LONG" ? "· Long" : "· Short"}</h2>
              </div>
              <div className="trade-context-price">
                <span className="meta-label">Live Price</span>
                <strong>{sizing.quote ? `$${sizing.quote.price.toFixed(2)}` : "Awaiting quote"}</strong>
              </div>
            </div>

            <div className="trade-context-pill-row">
              {selectedStrategy ? <span className="trade-summary-pill">{selectedStrategy.name}</span> : null}
              {thesis.setupTypes.slice(0, 2).map((setup) => (
                <span key={setup} className="trade-summary-pill">{setup}</span>
              ))}
            </div>

            {activeStepKey !== "identification" && (
            <div className="trade-context-chart-shell">
              <div className="trade-context-chart-toolbar">
                <div>
                  <p className="meta-label">Ticker Chart</p>
                  <p className="trade-context-caption">This chart stays in view while you move through the trade workflow.</p>
                </div>
                <div className="trade-context-timeframe-row">
                  {(["hour", "day", "week"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setHeaderTimeframe(value)}
                      className={`trade-context-timeframe ${headerTimeframe === value ? "is-active" : ""}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <PriceChart
                candles={headerCandles}
                direction={thesis.direction}
                entryPrice={sizing.entryPrice ?? undefined}
                stopLoss={sizing.stopLoss ?? undefined}
                r2Target={sizing.position?.r2Target}
                r4Target={sizing.position?.r4Target}
                timeframe={headerTimeframe}
                height={220}
              />
            </div>
            )}

            <div className="trade-context-story">
              <div>
                <p className="meta-label">Trade Story</p>
                <p className="trade-context-story-text">{thesis.thesis.trim() || "Start with the trade story first. The thesis stays visible here while you score, size, and deploy the idea."}</p>
              </div>
              <div className="trade-context-mini-grid">
                <article>
                  <span>Catalyst</span>
                  <strong>{thesis.catalystWindow.trim() || "Pending"}</strong>
                </article>
                <article>
                  <span>Invalidation</span>
                  <strong>{thesis.invalidation.trim() || "Pending"}</strong>
                </article>
              </div>
            </div>
          </div>
        </div>

        <div className="trade-stage-header">
          <div className="trade-stage-title">
            <p className="meta-label">Mechanical Gate System</p>
            <h2>{viewedGate.label}</h2>
          </div>
          <div className="trade-stage-strategy">
            <p className="meta-label">Active Strategy</p>
            <strong>{selectedStrategy?.name ?? "Pending Strategy"}</strong>
            <span>Revision {selectedStrategy?.versionNumber ?? 0}</span>
          </div>
        </div>

        <div className="trade-step-panel active">
          <div className="trade-step-body-grid trade-workbench-grid">
            <div className="trade-stage-main">
              <div className="trade-inline-summary-grid">
                <article className="trade-kpi-card">
                  <p className="meta-label">Current Window</p>
                  <strong>{viewedGate.label}</strong>
                  <span>{viewedGate.detail}</span>
                </article>
                <article className="trade-kpi-card">
                  <p className="meta-label">Portfolio Heat</p>
                  <strong>{currentHeat.toFixed(2)}%</strong>
                  <span>Equity {money(equity)}</span>
                </article>
                <article className="trade-kpi-card">
                  <p className="meta-label">Assessment</p>
                  <strong>F {fScore}/{fTotal} · T {tScore}/{tTotal}</strong>
                  <span>{conviction ? `${conviction.tier} conviction` : "Conviction pending"}</span>
                </article>
              </div>

              <div className="trade-strategy-strip">
                <div>
                  <p className="meta-label">Execution Strategy</p>
                  <p className="trade-stage-note">
                    This thesis is scored and deployed against a named saved strategy. Changing the strategy resets the scoring stage and swaps the execution context.
                  </p>
                </div>

                <div className="trade-strategy-grid">
                  <div className="trade-field">
                    <label htmlFor="trade-strategy-select" className="meta-label">
                      Score and deploy with
                    </label>
                    <select
                      id="trade-strategy-select"
                      value={selectedStrategyId}
                      onChange={(event) => handleStrategyChange(event.target.value)}
                      title="Trade strategy"
                      className="trade-select"
                    >
                      {initialStrategies.map((strategy) => (
                        <option key={strategy.id} value={strategy.id}>
                          {strategy.name} {strategy.isDefault ? "• default" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedStrategy ? (
                    <article className="trade-review-card trade-compact-card">
                      <p className="meta-label">Strategy Brief</p>
                      <h4>{selectedStrategy.name}</h4>
                      <p>{selectedStrategy.description}</p>
                      <div className="assessment-list compact">
                        <div>
                          <span>Enabled checks</span>
                          <strong>{metrics.length}</strong>
                        </div>
                        <div>
                          <span>Preferred setups</span>
                          <strong>{selectedStrategy.structure.setupTypes.length}</strong>
                        </div>
                      </div>
                    </article>
                  ) : null}
                </div>
              </div>

              {/* Gate 1: Identification */}
              {activeStepKey === "identification" ? (
              <div className="fin-gate-panel" data-state={gatePermissions.identification}>
                <div className="fin-gate-label">
                  <span className="gate-number">01</span>
                  Identification
                </div>
                <ThesisStep
                  thesis={thesis}
                  contradictions={contradictions}
                  draftLoading={draftLoading}
                  draftMeta={draftMeta}
                  smartStopHint={smartStopHint}
                  sharedLibraryItems={structureLibrary}
                  onSaveLibraryItem={saveSharedStructureItem}
                  onChange={updateThesis}
                  onGenerateDraft={runThesisDraft}
                  onNext={onThesisNext}
                  candles={headerCandles}
                  timeframe={headerTimeframe}
                  onTimeframeChange={setHeaderTimeframe}
                />
              </div>
              ) : null}

              {/* Gate 2: Assessment */}
              {activeStepKey === "assessment" ? (
              <div className="fin-gate-panel" data-state={gatePermissions.assessment}>
                <div className="fin-gate-label">
                  <span className="gate-number">02</span>
                  Assessment
                </div>
                {gatePermissions.assessment !== "locked" ? (
                  <AssessmentStep
                    thesis={thesis}
                    mode={mode}
                    metrics={metrics.map((metric) => ({
                      ...metric,
                      description: resolveMetricAssessmentDescription(metric, thesis.direction),
                    }))}
                    scores={scores}
                    notes={notes}
                    loading={assessmentLoading}
                    error={assessmentError}
                    assessmentMeta={assessmentMeta}
                    insight={insight}
                    insightMeta={insightMeta}
                    insightLoading={insightLoading}
                    onBack={() => goToStep("identification")}
                    onRerun={runAssessment}
                    onScoreChange={(metricId, value) => {
                      setScores((previous) => ({ ...previous, [metricId]: value }));
                    }}
                    onInsight={runInsight}
                    onNext={onAssessmentNext}
                  />
                ) : (
                  <div className="gate-locked-placeholder">
                    <p>Complete identification to unlock scoring.</p>
                  </div>
                )}
              </div>
              ) : null}

              {/* Gate 3: Sizing */}
              {activeStepKey === "sizing" ? (
              <div className="fin-gate-panel" data-state={gatePermissions.sizing} data-discipline={disciplineScore === null ? undefined : disciplineScore >= 80 ? "high" : disciplineScore >= 50 ? "mid" : "low"}>
                <div className="fin-gate-label">
                  <span className="gate-number">03</span>
                  Sizing
                </div>
                {gatePermissions.sizing !== "locked" && effectiveConviction ? (
                  <SizingStep
                    thesis={thesis}
                    equity={equity}
                    conviction={effectiveConviction}
                    value={sizing}
                    onChange={setSizing}
                    onBack={() => goToStep("assessment")}
                    onNext={() => goToStep("deployment")}
                  />
                ) : isGateBlocked ? (
                  <InlineFrictionZone
                    rulesBroken={rulesBroken}
                    ticker={thesis.ticker}
                    direction={thesis.direction}
                    disciplineProfile={disciplineProfile}
                    gateReason={gateResult.reason ?? "Trade does not pass gate requirements."}
                    onConfirm={async (justification) => {
                      setOverrideJustification(justification);
                    }}
                  />
                ) : (
                  <div className="gate-locked-placeholder">
                    <p>Pass assessment gates to unlock sizing.</p>
                  </div>
                )}
              </div>
              ) : null}

              {/* Gate 4: Deployment */}
              {activeStepKey === "deployment" ? (
              <div className="fin-gate-panel" data-state={gatePermissions.deployment}>
                <div className="fin-gate-label">
                  <span className="gate-number">04</span>
                  Deployment
                </div>
                {gatePermissions.deployment !== "locked" && effectiveConviction && sizing.position && sizing.entryPrice != null && sizing.stopLoss != null ? (
                  <ConfirmStep
                    thesis={thesis}
                    conviction={effectiveConviction}
                    position={sizing.position}
                    entryPrice={sizing.entryPrice}
                    stopLoss={sizing.stopLoss}
                    currentHeat={currentHeat}
                    deploying={deploying}
                    deployError={deployError}
                    isOverride={isOverrideApproved}
                    onBack={() => goToStep("sizing")}
                    onDeploy={isOverrideApproved ? () => void handleOverrideConfirm(overrideJustification!) : onDeploy}
                  />
                ) : (
                  <div className="gate-locked-placeholder">
                    <p>Complete sizing to unlock deployment review.</p>
                  </div>
                )}
              </div>
              ) : null}
            </div>

            <aside className="trade-stage-sidebar">
              <div className="trade-side-stack">
                <article className="trade-review-card trade-rail-card">
                  <p className="meta-label">Trade Identity</p>
                  <h4>{thesis.ticker || "Pending"}</h4>
                  <p>{thesis.direction} · {thesis.assetClass} · {formatModeLabel(mode)}</p>
                </article>

                <article className="trade-review-card trade-rail-card">
                  <p className="meta-label">Structure Stack</p>
                  <div className="mt-3 space-y-4">
                    <div>
                      <p className="meta-label">Setup Types</p>
                      <SummaryPills items={thesis.setupTypes} emptyLabel="No setup types selected yet." />
                    </div>
                    <div>
                      <p className="meta-label">Conditions</p>
                      <SummaryPills items={thesis.conditions} emptyLabel="No conditions selected yet." />
                    </div>
                    <div>
                      <p className="meta-label">Chart Pattern</p>
                      <SummaryPills items={thesis.chartPattern !== "None" ? [thesis.chartPattern] : []} emptyLabel="No dominant pattern selected." />
                    </div>
                  </div>
                </article>

                <article className="trade-review-card trade-rail-card">
                  <p className="meta-label">Trade Story</p>
                  <h4>Execution context</h4>
                  <p>{thesis.thesis.trim() || "Document the core thesis, the catalyst, and the invalidation to lock the trade story."}</p>
                  <div className="assessment-list compact">
                    <div>
                      <span>Catalyst</span>
                      <strong>{thesis.catalystWindow.trim() || "Pending"}</strong>
                    </div>
                    <div>
                      <span>Invalidation</span>
                      <strong>{thesis.invalidation.trim() || "Pending"}</strong>
                    </div>
                  </div>
                </article>

                <article className="trade-review-card trade-rail-card">
                  <p className="meta-label">Observer Rail</p>
                  <h4>Live review</h4>
                  <div className="mt-3">
                    <ContextualObserverRail thesis={thesis} aiSuggestion={insight?.summary ?? null} />
                  </div>
                </article>

                <article className="trade-review-card trade-rail-card">
                  <p className="meta-label">Gate Status</p>
                  <div className="assessment-list compact">
                    <div>
                      <span>Strategy</span>
                      <strong>{selectedStrategy?.name ?? "Pending"}</strong>
                    </div>
                    <div>
                      <span>Fundamentals</span>
                      <strong className={fPass ? "text-tds-green" : "text-tds-amber"}>{fScore}/{fTotal}</strong>
                    </div>
                    <div>
                      <span>Technicals</span>
                      <strong className={tPass ? "text-tds-green" : "text-tds-amber"}>{tScore}/{tTotal}</strong>
                    </div>
                    <div>
                      <span>Deploy state</span>
                      <strong>{deploying ? "Deploying" : gatePermissions.deployment !== "locked" ? "Ready for final review" : "Working through gates"}</strong>
                    </div>
                  </div>
                </article>

                {sizing.position ? (
                  <article className="trade-review-card trade-rail-card">
                    <p className="meta-label">Sizing Snapshot</p>
                    <h4>{sizing.position.shares} shares</h4>
                    <p>{money(sizing.position.value)} total position value.</p>
                    <div className="assessment-list compact">
                      <div>
                        <span>Entry</span>
                        <strong>{sizing.entryPrice?.toFixed(2) ?? "-"}</strong>
                      </div>
                      <div>
                        <span>Stop</span>
                        <strong>{sizing.stopLoss?.toFixed(2) ?? "-"}</strong>
                      </div>
                    </div>
                  </article>
                ) : null}

                {contradictions.length > 0 ? (
                  <article className="priority-card warn">
                    <p className="meta-label">Contradictions</p>
                    <div className="mt-3 space-y-2 text-sm text-tds-text">
                      {contradictions.map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  </article>
                ) : null}

                {insight ? (
                  <article className="trade-review-card trade-rail-card">
                    <p className="meta-label">AI Insight</p>
                    <h4>{insight.verdict}</h4>
                    <p>{insight.summary}</p>
                    <div className="mt-3 space-y-2 text-sm text-tds-dim">
                      {insight.edge ? <p>Edge: <span className="text-tds-text">{insight.edge}</span></p> : null}
                      {insight.risks ? <p>Risk: <span className="text-tds-text">{insight.risks}</span></p> : null}
                    </div>
                  </article>
                ) : null}

                <AmbientNudges userId={userId} />
              </div>
            </aside>
          </div>
        </div>
      </section>
      {toast ? (
        <div
          className={`fixed left-4 top-4 z-50 rounded-[20px] border px-4 py-3 text-sm shadow-[0_20px_44px_-28px_rgba(15,23,42,0.35)] md:left-[292px] ${
            toast.type === "success"
              ? "border-tds-green/20 bg-white text-tds-text"
              : "border-tds-red/20 bg-white text-tds-text"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      {circuitBreakerStatus && (
        <CircuitBreakerModal
          open={circuitBreakerModalOpen}
          status={circuitBreakerStatus}
          onClose={() => setCircuitBreakerModalOpen(false)}
          onReview={() => {
            setCircuitBreakerModalOpen(false);
            router.push("/settings");
          }}
          onOverride={() => {
            setCircuitBreakerOverridden(true);
            setCircuitBreakerModalOpen(false);
          }}
        />
      )}
    </main>
  );
}