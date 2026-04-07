"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ThesisStep from "@/components/trade/ThesisStep";
import AssessmentStep from "@/components/trade/AssessmentStep";
import SizingStep from "@/components/trade/SizingStep";
import ConfirmStep from "@/components/trade/ConfirmStep";
import { extractAIResponseMeta } from "@/lib/ai/response";
import { createClient } from "@/lib/supabase/client";
import { buildStructureLibraryInsert, normalizeStructureLibraryRow } from "@/lib/trading/structure-library";
import { getConviction } from "@/lib/trading/scoring";
import { updateStrategySnapshotStructure } from "@/lib/trading/strategies";
import { resolveMetricAssessmentDescription } from "@/lib/trading/user-metrics";
import { detectContradictions, validatePortfolioHeat } from "@/lib/trading/validation";
import { executionSchema, thesisSchema } from "@/lib/validation/forms";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";
import type { TradeStructureLibraryItem, TradeStructureItemType } from "@/types/structure-library";
import type { SavedStrategy } from "@/types/strategy";
import type {
  AIInsight,
  ConvictionTier,
  Position,
  TradeNotes,
  TradeScores,
  TradeThesis,
  TradeMode,
} from "@/types/trade";
import type { Quote } from "@/types/market";
import type { AIResponseMeta } from "@/lib/ai/response";

type WizardStep = "thesis" | "assessment" | "sizing" | "confirm";

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

const STEP_META: Array<{ id: WizardStep; label: string; detail: string }> = [
  { id: "thesis", label: "Thesis", detail: "Define the opportunity" },
  { id: "assessment", label: "Assessment", detail: "Score the evidence" },
  { id: "sizing", label: "Sizing", detail: "Lock risk and entries" },
  { id: "confirm", label: "Confirm", detail: "Review before deploy" },
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
        <span key={item} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-tds-blue">
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
  const supabase = useMemo(() => createClient(), []);

  const mode = initialMode;
  const equity = initialEquity;
  const currentHeat = initialHeat;

  const [step, setStep] = useState<WizardStep>("thesis");
  const [selectedStrategyId, setSelectedStrategyId] = useState(initialStrategyId);
  const [structureLibrary, setStructureLibrary] = useState<TradeStructureLibraryItem[]>(initialStructureLibrary);
  const [thesis, setThesis] = useState<TradeThesis>(DEFAULT_THESIS);
  const [contradictions, setContradictions] = useState<string[]>([]);
  const [scores, setScores] = useState<TradeScores>({});
  const [notes, setNotes] = useState<TradeNotes>({});
  const [insight, setInsight] = useState<AIInsight | null>(null);

  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [assessmentMeta, setAssessmentMeta] = useState<AIResponseMeta | null>(null);
  const [insightMeta, setInsightMeta] = useState<AIResponseMeta | null>(null);

  const [sizing, setSizing] = useState<SizingState>({
    quote: null,
    entryPrice: null,
    stopLoss: null,
    position: null,
  });

  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

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

  const fPass = fScore >= fMin;
  const tPass = tScore >= tMin;
  const stepIndex = STEP_META.findIndex((item) => item.id === step);

  function updateThesis(patch: Partial<TradeThesis>) {
    setThesis((previous) => ({ ...previous, ...patch }));
  }

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
    setContradictions([]);
    setDeployError(null);
    setAssessmentMeta(null);
    setInsightMeta(null);
    setSizing({
      quote: null,
      entryPrice: null,
      stopLoss: null,
      position: null,
    });
    setStep("thesis");
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

    const warnings = detectContradictions(thesis);
    setContradictions(warnings);
    setStep("assessment");
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

    setStep("sizing");
  }

  async function onDeploy() {
    if (!conviction || !sizing.position || sizing.entryPrice == null || sizing.stopLoss == null || !selectedStrategy || !tradeStrategySnapshot) {
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

    const heatCheck = validatePortfolioHeat(currentHeat / 100, conviction.risk);
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
        conviction: conviction.tier,
        risk_pct: conviction.risk,
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
        insight: insight as Database["public"]["Tables"]["trades"]["Insert"]["insight"],
      };

      const { error } = await supabase.from("trades").insert(payload);
      if (error) {
        throw error;
      }

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

  return (
    <main className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_320px]">
        <div className="fin-panel p-6 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="fin-kicker">Trade Workspace</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-tds-text">Single decision path from thesis to deployment.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-tds-dim">Only one primary task per stage. Evidence drives conviction, conviction drives size, and sizing drives the final go or no-go decision.</p>
            </div>
            <span className="fin-chip">{STEP_META[stepIndex]?.detail}</span>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-4">
            {STEP_META.map((item, index) => {
              const isActive = item.id === step;
              const isComplete = index < stepIndex;
              return (
                <div key={item.id} className="fin-progress-step" data-active={isActive} data-complete={isComplete}>
                  <span className={cn("flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold", isActive ? "border-blue-200 bg-blue-50 text-tds-blue" : isComplete ? "border-tds-green/20 bg-tds-green/10 text-tds-green" : "border-white/80 bg-white text-tds-dim")}>
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-tds-text">{item.label}</p>
                    <p className="text-xs text-tds-dim">{item.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="fin-kicker">Execution Strategy</p>
                <p className="mt-2 text-sm leading-6 text-tds-dim">
                  This thesis will be assessed and deployed against a saved named strategy. Changing the strategy resets the scoring step and publishes a different historical context.
                </p>
              </div>
              {selectedStrategy ? <span className="fin-chip">Revision {selectedStrategy.versionNumber}</span> : null}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <label htmlFor="trade-strategy-select" className="text-xs font-semibold uppercase tracking-[0.16em] text-tds-dim">
                  Score and deploy with
                </label>
                <select
                  id="trade-strategy-select"
                  value={selectedStrategyId}
                  onChange={(event) => handleStrategyChange(event.target.value)}
                  title="Trade strategy"
                  className="mt-2 h-11 w-full rounded-2xl border border-white/80 bg-white px-4 text-sm text-tds-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tds-focus"
                >
                  {initialStrategies.map((strategy) => (
                    <option key={strategy.id} value={strategy.id}>
                      {strategy.name} {strategy.isDefault ? "• default" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {selectedStrategy ? (
                <div className="rounded-2xl border border-white/70 bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm font-semibold text-tds-text">{selectedStrategy.name}</p>
                  <p className="mt-2 text-sm leading-6 text-tds-dim">{selectedStrategy.description}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-tds-dim">
                    {metrics.length} enabled checks · {selectedStrategy.structure.setupTypes.length} preferred setups
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="fin-panel p-6">
          <p className="fin-kicker">Summary Rail</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Current trade context</h2>

          <div className="mt-5 space-y-3">
            <div className="fin-card p-4">
              <p className="fin-kicker">Strategy</p>
              <p className="mt-2 text-sm font-semibold text-tds-text">{selectedStrategy?.name ?? "Pending"}</p>
              <p className="mt-2 text-sm text-tds-dim">{selectedStrategy?.description ?? "Choose a saved strategy before running the assessment."}</p>
            </div>
            <div className="fin-card p-4">
              <p className="fin-kicker">Trade Identity</p>
              <p className="mt-2 font-mono text-2xl text-tds-text">{thesis.ticker || "Pending"}</p>
              <p className="mt-2 text-sm text-tds-dim">{thesis.direction} · {thesis.assetClass} · {formatModeLabel(mode)}</p>
            </div>
            <div className="fin-card p-4">
              <p className="fin-kicker">Structure Stack</p>
              <div className="mt-3 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-tds-dim">Setup types</p>
                  <SummaryPills items={thesis.setupTypes} emptyLabel="No setup types selected yet." />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-tds-dim">Conditions</p>
                  <SummaryPills items={thesis.conditions} emptyLabel="No conditions selected yet." />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-tds-dim">Chart pattern</p>
                  <SummaryPills items={thesis.chartPattern !== "None" ? [thesis.chartPattern] : []} emptyLabel="No dominant pattern selected." />
                </div>
              </div>
            </div>
            <div className="fin-card p-4">
              <p className="fin-kicker">Trade Story</p>
              <p className="mt-2 text-sm leading-6 text-tds-text">{thesis.thesis.trim() || "Document the core thesis, the catalyst, and the invalidation to lock the trade story."}</p>
              <div className="mt-4 space-y-2 text-sm text-tds-dim">
                <p>Catalyst: <span className="text-tds-text">{thesis.catalystWindow.trim() || "Pending"}</span></p>
                <p>Invalidation: <span className="text-tds-text">{thesis.invalidation.trim() || "Pending"}</span></p>
              </div>
            </div>
            <div className="fin-card p-4">
              <p className="fin-kicker">Portfolio State</p>
              <p className="mt-2 text-sm text-tds-text">Equity {money(equity)}</p>
              <p className="mt-2 text-sm text-tds-text">Current heat {currentHeat.toFixed(2)}%</p>
            </div>
            <div className="fin-card p-4">
              <p className="fin-kicker">Assessment Snapshot</p>
              <p className="mt-2 text-sm text-tds-text">F {fScore}/{fTotal} · T {tScore}/{tTotal}</p>
              <p className="mt-2 text-sm text-tds-dim">{assessmentLoading ? `Running ${selectedStrategy?.name ?? "selected strategy"}...` : conviction ? `${conviction.tier} conviction unlocked` : "Conviction not unlocked yet"}</p>
            </div>
            {sizing.position ? (
              <div className="fin-card p-4">
                <p className="fin-kicker">Sizing Snapshot</p>
                <p className="mt-2 text-sm text-tds-text">{sizing.position.shares} shares · {money(sizing.position.value)}</p>
                <p className="mt-2 text-sm text-tds-dim">Entry {sizing.entryPrice?.toFixed(2) ?? "-"} · Stop {sizing.stopLoss?.toFixed(2) ?? "-"}</p>
              </div>
            ) : null}
          </div>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="fin-panel p-6 sm:p-7">
          {step === "thesis" ? (
            <ThesisStep
              thesis={thesis}
              contradictions={contradictions}
              sharedLibraryItems={structureLibrary}
              onSaveLibraryItem={saveSharedStructureItem}
              onChange={updateThesis}
              onNext={onThesisNext}
            />
          ) : null}

          {step === "assessment" ? (
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
              onBack={() => setStep("thesis")}
              onRerun={runAssessment}
              onScoreChange={(metricId, value) => {
                setScores((previous) => ({ ...previous, [metricId]: value }));
              }}
              onInsight={runInsight}
              onNext={onAssessmentNext}
            />
          ) : null}

          {step === "sizing" && conviction ? (
            <SizingStep
              thesis={thesis}
              mode={mode}
              equity={equity}
              conviction={conviction}
              value={sizing}
              onChange={setSizing}
              onBack={() => setStep("assessment")}
              onNext={() => setStep("confirm")}
            />
          ) : null}

          {step === "confirm" && conviction && sizing.position && sizing.entryPrice != null && sizing.stopLoss != null ? (
            <ConfirmStep
              thesis={thesis}
              conviction={conviction}
              position={sizing.position}
              entryPrice={sizing.entryPrice}
              stopLoss={sizing.stopLoss}
              currentHeat={currentHeat}
              deploying={deploying}
              deployError={deployError}
              onBack={() => setStep("sizing")}
              onDeploy={onDeploy}
            />
          ) : null}
        </div>

        <aside className="space-y-6">
          {contradictions.length > 0 ? (
            <div className="fin-panel p-5">
              <p className="fin-kicker">Contradictions</p>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-tds-dim">
                {contradictions.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {insight ? (
            <div className="fin-panel p-5">
              <p className="fin-kicker">AI Insight</p>
              <p className="mt-3 text-sm leading-6 text-tds-text">{insight.summary}</p>
              {insight.edge ? <p className="mt-3 text-sm text-tds-dim">Edge: {insight.edge}</p> : null}
              {insight.risks ? <p className="mt-2 text-sm text-tds-dim">Risk: {insight.risks}</p> : null}
            </div>
          ) : null}

          <div className="fin-panel p-5">
            <p className="fin-kicker">Gate Status</p>
            <div className="mt-4 space-y-3 text-sm text-tds-dim">
              <p>Strategy: <span className="text-tds-text">{selectedStrategy?.name ?? "Pending"}</span></p>
              <p>Fundamentals: <span className={fPass ? "text-tds-green" : "text-tds-amber"}>{fScore}/{fTotal}</span></p>
              <p>Technicals: <span className={tPass ? "text-tds-green" : "text-tds-amber"}>{tScore}/{tTotal}</span></p>
              <p>Conviction: <span className="text-tds-text">{conviction ? conviction.tier : "Pending"}</span></p>
              <p>Deploy state: <span className="text-tds-text">{deploying ? "Deploying" : step === "confirm" ? "Ready for final review" : "Working through steps"}</span></p>
            </div>
          </div>
        </aside>
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
    </main>
  );
}