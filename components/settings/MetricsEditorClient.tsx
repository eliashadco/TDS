"use client";

import { useEffect, useMemo, useState } from "react";
import AIProviderBadge from "@/components/ai/AIProviderBadge";
import { createClient } from "@/lib/supabase/client";
import { extractAIResponseMeta } from "@/lib/ai/response";
import StrategyTemplate from "@/components/learn/StrategyTemplate";
import { METRIC_LIBRARY } from "@/lib/trading/presets";
import { buildMetricsFromPreset } from "@/lib/trading/strategy-presets";
import { buildStructureLibraryInsert, normalizeStructureLibraryRow } from "@/lib/trading/structure-library";
import {
  buildBlankStrategyPreset,
  buildStrategyMetricSeed,
  buildStrategySnapshot,
  normalizeStrategyStructure,
} from "@/lib/trading/strategies";
import { equitySchema, metricCustomSchema } from "@/lib/validation/forms";
import type { Database, Json } from "@/types/database";
import type { TradeSetupCategory, TradeStructureLibraryItem, TradeStructureItemType } from "@/types/structure-library";
import type { TradeMode } from "@/types/trade";
import type { AIResponseMeta } from "@/lib/ai/response";
import type { SavedStrategy, StrategyPresetDefinition, StrategyStatus, StrategyStructureSnapshot } from "@/types/strategy";

type MetricType = "fundamental" | "technical";
type LibraryFilter = "all" | "bull" | "bear" | string;

type MetricRow = {
  id: string;
  strategyId: string;
  metricId: string;
  metricType: MetricType;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  sortOrder: number;
  isHard?: boolean;
};

type StrategyView = {
  id: string;
  name: string;
  description: string;
  learningGoal: string;
  aiInstruction: string;
  status: StrategyStatus;
  isDefault: boolean;
  isPresetClone: boolean;
  presetKey: string | null;
  activeVersionId: string | null;
  versionNumber: number;
  structure: StrategyStructureSnapshot;
  metrics: MetricRow[];
};

type RatingState = {
  score: number;
  assessment: string;
  missing?: string;
  redundant?: string;
};

type MetricsEditorClientProps = {
  userId: string;
  mode: TradeMode;
  initialEquity: number;
  initialStrategies: SavedStrategy[];
  initialStrategyId: string | null;
  initialStructureLibrary: TradeStructureLibraryItem[];
};

const CATEGORY_LABELS: Record<string, string> = {
  val: "VAL",
  quality: "QUALITY",
  mom: "MOM",
  risk: "RISK",
  macro: "MACRO",
  trend: "TREND",
  vol: "VOL",
  intra: "INTRA",
  struct: "STRUCT",
};

const BULL_CATEGORIES = new Set(["val", "quality", "mom", "trend", "intra"]);
const BEAR_CATEGORIES = new Set(["risk", "macro", "vol", "struct", "mom", "trend", "intra"]);

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category.toUpperCase();
}

function makeCustomMetricId(): string {
  return `custom_${crypto.randomUUID()}`;
}

function mapSavedStrategies(strategies: SavedStrategy[]): StrategyView[] {
  return strategies.map((strategy) => ({
    id: strategy.id,
    name: strategy.name,
    description: strategy.description,
    learningGoal: strategy.learningGoal ?? "",
    aiInstruction: strategy.aiInstruction ?? "",
    status: strategy.status,
    isDefault: strategy.isDefault,
    isPresetClone: strategy.isPresetClone,
    presetKey: strategy.presetKey,
    activeVersionId: strategy.activeVersionId,
    versionNumber: strategy.versionNumber,
    structure: strategy.structure,
    metrics: strategy.metrics.map((metric, index) => ({
      id: `${strategy.id}:${metric.id}:${index}`,
      strategyId: strategy.id,
      metricId: metric.id,
      metricType: metric.type,
      name: metric.name,
      description: metric.description,
      category: metric.category,
      enabled: metric.enabled,
      sortOrder: index,
      ...(metric.isHard !== undefined ? { isHard: metric.isHard } : {}),
    })),
  }));
}

function serializeListInput(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sortMetrics(rows: MetricRow[]): MetricRow[] {
  return [...rows].sort((left, right) => {
    if (left.metricType !== right.metricType) {
      return left.metricType.localeCompare(right.metricType);
    }

    return left.sortOrder - right.sortOrder;
  });
}

function buildMetricJsonRows(metrics: MetricRow[]) {
  return sortMetrics(metrics).map((metric) => ({
    id: metric.metricId,
    name: metric.name,
    description: metric.description,
    category: metric.category as "val" | "quality" | "mom" | "risk" | "macro" | "trend" | "vol" | "intra" | "struct",
    type: metric.metricType,
    enabled: metric.enabled,
    ...(metric.isHard !== undefined ? { isHard: metric.isHard } : {}),
  }));
}

export default function MetricsEditorClient({
  userId,
  mode,
  initialEquity,
  initialStrategies,
  initialStrategyId,
  initialStructureLibrary,
}: MetricsEditorClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const [strategies, setStrategies] = useState<StrategyView[]>(() => mapSavedStrategies(initialStrategies));
  const [structureLibrary, setStructureLibrary] = useState<TradeStructureLibraryItem[]>(initialStructureLibrary);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(
    initialStrategyId ?? initialStrategies[0]?.id ?? null,
  );
  const [equityInput, setEquityInput] = useState(String(initialEquity));
  const [equitySaving, setEquitySaving] = useState(false);
  const [equityMessage, setEquityMessage] = useState<string | null>(null);

  const [rating, setRating] = useState<RatingState | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [ratingMeta, setRatingMeta] = useState<AIResponseMeta | null>(null);

  const [modalType, setModalType] = useState<MetricType | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("all");
  const [customName, setCustomName] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customIsHard, setCustomIsHard] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [busyMetricId, setBusyMetricId] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [strategyMessage, setStrategyMessage] = useState<string | null>(null);
  const [busyPresetKey, setBusyPresetKey] = useState<string | null>(null);
  const [strategyBusyId, setStrategyBusyId] = useState<string | null>(null);
  const [structureBusyKey, setStructureBusyKey] = useState<string | null>(null);
  const [structureTab, setStructureTab] = useState<TradeStructureItemType>("setup_type");
  const [structureLabelInput, setStructureLabelInput] = useState("");
  const [structureFamilyInput, setStructureFamilyInput] = useState("Custom");
  const [structureDetailInput, setStructureDetailInput] = useState("");
  const [structureKeywordsInput, setStructureKeywordsInput] = useState("");
  const [structureSetupCategoryInput, setStructureSetupCategoryInput] = useState<TradeSetupCategory>("technical");

  const selectedStrategy = strategies.find((strategy) => strategy.id === selectedStrategyId) ?? strategies[0] ?? null;
  const metrics = useMemo(() => selectedStrategy?.metrics ?? [], [selectedStrategy]);

  const [strategyNameInput, setStrategyNameInput] = useState(selectedStrategy?.name ?? "");
  const [strategyDescriptionInput, setStrategyDescriptionInput] = useState(selectedStrategy?.description ?? "");
  const [learningGoalInput, setLearningGoalInput] = useState(selectedStrategy?.learningGoal ?? "");
  const [aiInstructionInput, setAiInstructionInput] = useState(selectedStrategy?.aiInstruction ?? "");
  const [statusInput, setStatusInput] = useState<StrategyStatus>(selectedStrategy?.status ?? "active");
  const [setupTypesInput, setSetupTypesInput] = useState(selectedStrategy?.structure.setupTypes.join(", ") ?? "");
  const [conditionsInput, setConditionsInput] = useState(selectedStrategy?.structure.conditions.join(", ") ?? "");
  const [chartPatternInput, setChartPatternInput] = useState(selectedStrategy?.structure.chartPattern ?? "None");
  const [sizingNotesInput, setSizingNotesInput] = useState(selectedStrategy?.structure.sizingNotes ?? "");
  const [invalidationStyleInput, setInvalidationStyleInput] = useState(selectedStrategy?.structure.invalidationStyle ?? "");

  useEffect(() => {
    if (!selectedStrategy) {
      return;
    }

    setStrategyNameInput(selectedStrategy.name);
    setStrategyDescriptionInput(selectedStrategy.description);
    setLearningGoalInput(selectedStrategy.learningGoal);
    setAiInstructionInput(selectedStrategy.aiInstruction);
    setStatusInput(selectedStrategy.status);
    setSetupTypesInput(selectedStrategy.structure.setupTypes.join(", "));
    setConditionsInput(selectedStrategy.structure.conditions.join(", "));
    setChartPatternInput(selectedStrategy.structure.chartPattern);
    setSizingNotesInput(selectedStrategy.structure.sizingNotes);
    setInvalidationStyleInput(selectedStrategy.structure.invalidationStyle);
  }, [selectedStrategyId, selectedStrategy]);

  const fundamentalMetrics = metrics
    .filter((metric) => metric.metricType === "fundamental")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const technicalMetrics = metrics
    .filter((metric) => metric.metricType === "technical")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const modalLibrary = useMemo(() => {
    if (!modalType) {
      return [];
    }

    const addedIds = new Set(
      metrics.filter((metric) => metric.metricType === modalType).map((metric) => metric.metricId),
    );

    return METRIC_LIBRARY[modalType]
      .filter((metric) => !addedIds.has(metric.id))
      .filter((metric) => {
        if (libraryFilter === "all") {
          return true;
        }
        if (libraryFilter === "bull") {
          return BULL_CATEGORIES.has(metric.category);
        }
        if (libraryFilter === "bear") {
          return BEAR_CATEGORIES.has(metric.category);
        }
        return metric.category === libraryFilter;
      });
  }, [libraryFilter, metrics, modalType]);

  const modalCategories = useMemo(() => {
    if (!modalType) {
      return [];
    }

    return Array.from(new Set(METRIC_LIBRARY[modalType].map((metric) => metric.category))).sort();
  }, [modalType]);

  const visibleStructureItems = useMemo(
    () =>
      [...structureLibrary]
        .filter((item) => item.itemType === structureTab)
        .sort((left, right) => left.label.localeCompare(right.label)),
    [structureLibrary, structureTab],
  );

  function setStrategyRows(strategyId: string, rows: MetricRow[]) {
    setStrategies((previous) =>
      previous.map((strategy) =>
        strategy.id === strategyId
          ? { ...strategy, metrics: rows }
          : strategy,
      ),
    );
  }

  function replaceStrategy(nextStrategy: StrategyView) {
    setStrategies((previous) => previous.map((strategy) => (strategy.id === nextStrategy.id ? nextStrategy : strategy)));
  }

  function notifyStrategyAnchorRefresh() {
    window.dispatchEvent(new Event("tds:strategy-anchor-refresh"));
  }

  async function publishStrategyVersion(strategy: StrategyView, nextMetrics: MetricRow[], nextStructure: StrategyStructureSnapshot, nextMeta?: {
    name?: string;
    description?: string;
    learningGoal?: string;
    aiInstruction?: string;
    status?: StrategyStatus;
  }) {
    const versionNumber = strategy.versionNumber + 1;
    const name = nextMeta?.name ?? strategy.name;
    const description = nextMeta?.description ?? strategy.description;
    const learningGoal = nextMeta?.learningGoal ?? strategy.learningGoal;
    const aiInstruction = nextMeta?.aiInstruction ?? strategy.aiInstruction;
    const status = nextMeta?.status ?? strategy.status;

    const snapshot = buildStrategySnapshot({
      strategyId: strategy.id,
      strategyVersionId: null,
      name,
      description,
      learningGoal,
      aiInstruction: aiInstruction || null,
      mode,
      metrics: buildMetricJsonRows(nextMetrics),
      structure: nextStructure,
      source: strategy.isPresetClone || strategy.presetKey ? "preset" : "custom",
      versionNumber,
    });

    const { data: version, error: versionError } = await supabase
      .from("strategy_versions")
      .insert({
        strategy_id: strategy.id,
        version_number: versionNumber,
        snapshot: snapshot as unknown as Json,
      })
      .select("id, created_at")
      .single();

    if (versionError || !version) {
      throw versionError ?? new Error("strategy_version_failed");
    }

    const finalizedSnapshot = buildStrategySnapshot({
      ...snapshot,
      strategyVersionId: version.id,
      createdAt: version.created_at,
    });

    const { error: snapshotError } = await supabase
      .from("strategy_versions")
      .update({ snapshot: finalizedSnapshot as unknown as Json })
      .eq("id", version.id);

    if (snapshotError) {
      throw snapshotError;
    }

    const { error: strategyError } = await supabase
      .from("user_strategies")
      .update({
        name,
        description,
        learning_goal: learningGoal || null,
        ai_instruction: aiInstruction || null,
        status,
        active_version_id: version.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", strategy.id);

    if (strategyError) {
      throw strategyError;
    }

    const updated: StrategyView = {
      ...strategy,
      name,
      description,
      learningGoal,
      aiInstruction,
      status,
      metrics: nextMetrics,
      structure: nextStructure,
      activeVersionId: version.id,
      versionNumber,
    };

    replaceStrategy(updated);
    notifyStrategyAnchorRefresh();
    return updated;
  }

  async function toggleMetric(metric: MetricRow) {
    if (!selectedStrategy) {
      return;
    }

    setActionError(null);
    setBusyMetricId(metric.id);

    const nextEnabled = !metric.enabled;
    const nextMetrics = metrics.map((row) => (row.id === metric.id ? { ...row, enabled: nextEnabled } : row));
    setStrategyRows(selectedStrategy.id, nextMetrics);

    const { error } = await supabase.from("user_metrics").update({ enabled: nextEnabled }).eq("id", metric.id);
    if (error) {
      setStrategyRows(selectedStrategy.id, metrics);
      setActionError("Failed to update metric state.");
      setBusyMetricId(null);
      return;
    }

    try {
      await publishStrategyVersion(selectedStrategy, nextMetrics, selectedStrategy.structure);
      setStrategyMessage(`${selectedStrategy.name} published as revision ${selectedStrategy.versionNumber + 1}.`);
    } catch {
      setActionError("Metric changed, but the strategy revision could not be published.");
    } finally {
      setBusyMetricId(null);
    }
  }

  async function removeMetric(metric: MetricRow) {
    if (!selectedStrategy) {
      return;
    }

    setActionError(null);
    setBusyMetricId(metric.id);

    const nextMetrics = metrics.filter((row) => row.id !== metric.id);
    setStrategyRows(selectedStrategy.id, nextMetrics);

    const { error } = await supabase.from("user_metrics").delete().eq("id", metric.id);
    if (error) {
      setStrategyRows(selectedStrategy.id, metrics);
      setActionError("Failed to remove metric.");
      setBusyMetricId(null);
      return;
    }

    try {
      await publishStrategyVersion(selectedStrategy, nextMetrics, selectedStrategy.structure);
      setStrategyMessage(`${selectedStrategy.name} revision ${selectedStrategy.versionNumber + 1} saved.`);
    } catch {
      setActionError("Metric removed, but the strategy revision could not be published.");
    } finally {
      setBusyMetricId(null);
    }
  }

  async function persistSortOrder(rows: MetricRow[]) {
    const updates = rows.map((row, index) =>
      supabase.from("user_metrics").update({ sort_order: index }).eq("id", row.id),
    );
    const results = await Promise.all(updates);
    const errored = results.some((result) => result.error);
    if (errored) {
      throw new Error("sort_update_failed");
    }
  }

  async function moveMetric(metric: MetricRow, delta: -1 | 1) {
    if (!selectedStrategy) {
      return;
    }

    setActionError(null);

    const section = metrics
      .filter((row) => row.metricType === metric.metricType)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const index = section.findIndex((row) => row.id === metric.id);
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= section.length) {
      return;
    }

    const swapped = [...section];
    const temp = swapped[index];
    swapped[index] = swapped[nextIndex];
    swapped[nextIndex] = temp;

    const resequenced = swapped.map((row, i) => ({ ...row, sortOrder: i }));
    const nextMetrics = [
      ...metrics.filter((row) => row.metricType !== metric.metricType),
      ...resequenced,
    ];

    setStrategyRows(selectedStrategy.id, nextMetrics);

    try {
      await persistSortOrder(resequenced);
      await publishStrategyVersion(selectedStrategy, nextMetrics, selectedStrategy.structure);
      setStrategyMessage(`${selectedStrategy.name} revision ${selectedStrategy.versionNumber + 1} saved.`);
    } catch {
      setStrategyRows(selectedStrategy.id, metrics);
      setActionError("Failed to update order.");
    }
  }

  async function addLibraryMetric(metricType: MetricType, metricId: string) {
    if (!selectedStrategy) {
      return;
    }

    setModalError(null);
    setBusyMetricId(metricId);

    const source = METRIC_LIBRARY[metricType].find((metric) => metric.id === metricId);
    if (!source) {
      setBusyMetricId(null);
      return;
    }

    const nextSort = metrics.filter((row) => row.metricType === metricType).length;
    const insertPayload = {
      user_id: userId,
      mode,
      strategy_id: selectedStrategy.id,
      metric_id: source.id,
      metric_type: metricType,
      name: source.name,
      description: source.description,
      category: source.category,
      enabled: true,
      sort_order: nextSort,
    } satisfies Database["public"]["Tables"]["user_metrics"]["Insert"];

    const { data, error } = await supabase
      .from("user_metrics")
      .insert(insertPayload)
      .select("id, strategy_id, metric_id, metric_type, name, description, category, enabled, sort_order")
      .single();

    if (error || !data) {
      setModalError("Failed to add metric.");
      setBusyMetricId(null);
      return;
    }

    const nextMetrics = [
      ...metrics,
      {
        id: data.id,
        strategyId: selectedStrategy.id,
        metricId: data.metric_id,
        metricType: data.metric_type,
        name: data.name,
        description: data.description ?? data.name,
        category: data.category ?? "macro",
        enabled: data.enabled,
        sortOrder: data.sort_order,
      },
    ];

    setStrategyRows(selectedStrategy.id, nextMetrics);

    try {
      await publishStrategyVersion(selectedStrategy, nextMetrics, selectedStrategy.structure);
      setStrategyMessage(`${source.name} added to ${selectedStrategy.name}.`);
    } catch {
      setModalError("Metric added, but the strategy revision could not be published.");
    } finally {
      setBusyMetricId(null);
    }
  }

  async function addCustomMetric(metricType: MetricType) {
    if (!selectedStrategy) {
      return;
    }

    setModalError(null);

    const customValidation = metricCustomSchema.safeParse({
      name: customName,
      description: customDescription,
    });
    if (!customValidation.success) {
      setModalError(customValidation.error.issues[0]?.message ?? "Invalid custom metric.");
      return;
    }

    const trimmedName = customValidation.data.name;
    const trimmedDescription = customValidation.data.description;

    const category = metricType === "fundamental" ? "macro" : "struct";
    const nextSort = metrics.filter((row) => row.metricType === metricType).length;
    const customId = makeCustomMetricId();

    const { data, error } = await supabase
      .from("user_metrics")
      .insert({
        user_id: userId,
        mode,
        strategy_id: selectedStrategy.id,
        metric_id: customId,
        metric_type: metricType,
        name: trimmedName,
        description: trimmedDescription,
        category,
        enabled: true,
        sort_order: nextSort,
      })
      .select("id, strategy_id, metric_id, metric_type, name, description, category, enabled, sort_order")
      .single();

    if (error || !data) {
      setModalError("Failed to create custom metric.");
      return;
    }

    const nextMetrics = [
      ...metrics,
      {
        id: data.id,
        strategyId: selectedStrategy.id,
        metricId: data.metric_id,
        metricType: data.metric_type,
        name: data.name,
        description: data.description ?? data.name,
        category: data.category ?? category,
        enabled: data.enabled,
        sortOrder: data.sort_order,
        ...(customIsHard ? { isHard: true } : {}),
      },
    ];

    setStrategyRows(selectedStrategy.id, nextMetrics);

    try {
      await publishStrategyVersion(selectedStrategy, nextMetrics, selectedStrategy.structure);
      setStrategyMessage(`${trimmedName} added to ${selectedStrategy.name}.`);
      setCustomName("");
      setCustomDescription("");
      setCustomIsHard(false);
    } catch {
      setModalError("Custom metric created, but the strategy revision could not be published.");
    }
  }

  async function runRating() {
    const activeMetricNames = metrics.filter((metric) => metric.enabled).map((metric) => metric.name);
    if (activeMetricNames.length === 0) {
      setRatingError("Enable at least one metric to rate this strategy.");
      return;
    }

    setRatingLoading(true);
    setRatingError(null);
    setRatingMeta(null);

    try {
      const response = await fetch("/api/ai/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, metrics: activeMetricNames }),
      });

      const data = (await response.json()) as RatingState | { error: string };
      if (!response.ok || "error" in data) {
        throw new Error("rate_failed");
      }

      setRatingMeta(extractAIResponseMeta(response));
      setRating(data);
    } catch {
      setRatingError("AI rating is unavailable right now.");
    } finally {
      setRatingLoading(false);
    }
  }

  async function saveEquity() {
    setEquitySaving(true);
    setEquityMessage(null);

    const equityValidation = equitySchema.safeParse({ equity: Number(equityInput) });
    if (!equityValidation.success) {
      setEquitySaving(false);
      setEquityMessage(equityValidation.error.issues[0]?.message ?? "Enter a valid positive equity value.");
      return;
    }
    const numericEquity = equityValidation.data.equity;

    const { error } = await supabase
      .from("profiles")
      .update({ equity: numericEquity })
      .eq("id", userId);

    if (error) {
      setEquityMessage("Failed to save portfolio equity.");
    } else {
      setEquityMessage("Portfolio equity updated.");
    }

    setEquitySaving(false);
  }

  async function saveStructureLibraryItem() {
    const trimmedLabel = structureLabelInput.trim();
    if (!trimmedLabel) {
      setActionError("A shared library label is required.");
      return;
    }

    const duplicate = structureLibrary.find(
      (item) => item.itemType === structureTab && item.label.trim().toLowerCase() === trimmedLabel.toLowerCase(),
    );
    if (duplicate) {
      setActionError(`${trimmedLabel} already exists in the shared library.`);
      return;
    }

    setActionError(null);
    setStructureBusyKey(`save:${structureTab}`);

    const { data, error } = await supabase
      .from("user_trade_structure_items")
      .insert(
        buildStructureLibraryInsert(
          userId,
          structureTab,
          trimmedLabel,
          structureFamilyInput,
          structureDetailInput,
          serializeListInput(structureKeywordsInput),
          structureTab === "setup_type" ? { setupCategory: structureSetupCategoryInput } : undefined,
        ),
      )
      .select("*")
      .single();

    if (error || !data) {
      setActionError("Failed to save the shared structure entry.");
      setStructureBusyKey(null);
      return;
    }

    setStructureLibrary((previous) => [normalizeStructureLibraryRow(data), ...previous]);
    setStrategyMessage(`${trimmedLabel} was added to the shared ${structureTab.replace("_", " ")} library.`);
    setStructureLabelInput("");
    setStructureFamilyInput("Custom");
    setStructureDetailInput("");
    setStructureKeywordsInput("");
    setStructureSetupCategoryInput("technical");
    setStructureBusyKey(null);
  }

  async function deleteStructureLibraryItem(item: TradeStructureLibraryItem) {
    setActionError(null);
    setStructureBusyKey(item.id);

    const { error } = await supabase.from("user_trade_structure_items").delete().eq("id", item.id);
    if (error) {
      setActionError("Failed to remove the shared structure entry.");
      setStructureBusyKey(null);
      return;
    }

    setStructureLibrary((previous) => previous.filter((entry) => entry.id !== item.id));
    setStrategyMessage(`${item.label} was removed from the shared library.`);
    setStructureBusyKey(null);
  }

  async function saveStrategyDetails() {
    if (!selectedStrategy) {
      return;
    }

    const trimmedName = strategyNameInput.trim();
    if (!trimmedName) {
      setActionError("Strategy name is required.");
      return;
    }

    setActionError(null);
    setStrategyBusyId(selectedStrategy.id);

    const nextStructure = normalizeStrategyStructure(
      {
        setupTypes: serializeListInput(setupTypesInput),
        conditions: serializeListInput(conditionsInput),
        chartPattern: chartPatternInput.trim() || "None",
        sizingNotes: sizingNotesInput.trim(),
        invalidationStyle: invalidationStyleInput.trim(),
      },
      selectedStrategy.structure,
    );

    const nextStrategy: StrategyView = {
      ...selectedStrategy,
      name: trimmedName,
      description: strategyDescriptionInput.trim(),
      learningGoal: learningGoalInput.trim(),
      aiInstruction: aiInstructionInput.trim(),
      status: statusInput,
      structure: nextStructure,
    };
    replaceStrategy(nextStrategy);

    try {
      await publishStrategyVersion(selectedStrategy, metrics, nextStructure, {
        name: trimmedName,
        description: strategyDescriptionInput.trim(),
        learningGoal: learningGoalInput.trim(),
        aiInstruction: aiInstructionInput.trim(),
        status: statusInput,
      });
      setStrategyMessage(`${trimmedName} published as revision ${selectedStrategy.versionNumber + 1}.`);
    } catch {
      replaceStrategy(selectedStrategy);
      setActionError("Failed to save strategy details.");
    } finally {
      setStrategyBusyId(null);
    }
  }

  async function setDefaultStrategy(targetStrategy: StrategyView) {
    setStrategyBusyId(targetStrategy.id);
    setActionError(null);

    const { error: clearError } = await supabase
      .from("user_strategies")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("mode", mode);

    if (clearError) {
      setActionError("Failed to switch default strategy.");
      setStrategyBusyId(null);
      return;
    }

    const { error: setError } = await supabase
      .from("user_strategies")
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq("id", targetStrategy.id);

    if (setError) {
      setActionError("Failed to switch default strategy.");
      setStrategyBusyId(null);
      return;
    }

    setStrategies((previous) => previous.map((strategy) => ({ ...strategy, isDefault: strategy.id === targetStrategy.id })));
    setStrategyMessage(`${targetStrategy.name} is now the default strategy for ${mode}.`);
    notifyStrategyAnchorRefresh();
    setStrategyBusyId(null);
  }

  async function createBlankStrategy() {
    const preset = buildBlankStrategyPreset(mode);
    setStrategyBusyId("blank");
    setActionError(null);

    const { data: strategy, error } = await supabase
      .from("user_strategies")
      .insert({
        user_id: userId,
        mode,
        name: preset.name,
        description: preset.description,
        learning_goal: preset.learningGoal,
        ai_instruction: null,
        status: "draft",
        preset_key: preset.key,
        is_preset_clone: false,
        is_default: false,
      })
      .select("*")
      .single();

    if (error || !strategy) {
      setActionError("Failed to create blank strategy.");
      setStrategyBusyId(null);
      return;
    }

    const draftStrategy: StrategyView = {
      id: strategy.id,
      name: strategy.name,
      description: strategy.description,
      learningGoal: strategy.learning_goal ?? "",
      aiInstruction: strategy.ai_instruction ?? "",
      status: strategy.status,
      isDefault: strategy.is_default,
      isPresetClone: strategy.is_preset_clone,
      presetKey: strategy.preset_key,
      activeVersionId: null,
      versionNumber: 0,
      structure: {
        setupTypes: [...preset.setupTypes],
        conditions: [...preset.conditions],
        chartPattern: preset.chartPattern,
        sizingNotes: preset.sizingNotes,
        invalidationStyle: preset.invalidationStyle,
      },
      metrics: [],
    };

    setStrategies((previous) => [...previous, draftStrategy]);
    setSelectedStrategyId(draftStrategy.id);

    try {
      await publishStrategyVersion(draftStrategy, [], draftStrategy.structure, {
        name: draftStrategy.name,
        description: draftStrategy.description,
        learningGoal: draftStrategy.learningGoal,
        aiInstruction: draftStrategy.aiInstruction,
        status: draftStrategy.status,
      });
      setStrategyMessage(`${draftStrategy.name} created. Add metrics before using it live.`);
    } catch {
      setActionError("Blank strategy created, but the initial revision could not be published.");
    } finally {
      setStrategyBusyId(null);
    }
  }

  async function clonePreset(preset: StrategyPresetDefinition) {
    setBusyPresetKey(preset.key);
    setActionError(null);
    setStrategyMessage(null);

    const metricModels = buildMetricsFromPreset(preset).map((metric) => ({ ...metric, enabled: true }));

    const { data: strategy, error } = await supabase
      .from("user_strategies")
      .insert({
        user_id: userId,
        mode,
        name: preset.name,
        description: preset.description,
        learning_goal: preset.learningGoal,
        ai_instruction: null,
        status: "active",
        preset_key: preset.key,
        is_preset_clone: true,
        is_default: false,
      })
      .select("*")
      .single();

    if (error || !strategy) {
      setActionError("Failed to clone preset strategy.");
      setBusyPresetKey(null);
      return;
    }

    const { data: insertedRows, error: metricError } = await supabase
      .from("user_metrics")
      .insert(buildStrategyMetricSeed(userId, mode, strategy.id, metricModels))
      .select("id, strategy_id, metric_id, metric_type, name, description, category, enabled, sort_order");

    if (metricError) {
      setActionError("Preset strategy created, but its metrics could not be saved.");
      setBusyPresetKey(null);
      return;
    }

    const nextStrategy: StrategyView = {
      id: strategy.id,
      name: strategy.name,
      description: strategy.description,
      learningGoal: strategy.learning_goal ?? "",
      aiInstruction: strategy.ai_instruction ?? "",
      status: strategy.status,
      isDefault: strategy.is_default,
      isPresetClone: strategy.is_preset_clone,
      presetKey: strategy.preset_key,
      activeVersionId: null,
      versionNumber: 0,
      structure: {
        setupTypes: [...preset.setupTypes],
        conditions: [...preset.conditions],
        chartPattern: preset.chartPattern,
        sizingNotes: preset.sizingNotes,
        invalidationStyle: preset.invalidationStyle,
      },
      metrics: (insertedRows ?? []).map((row) => ({
        id: row.id,
        strategyId: strategy.id,
        metricId: row.metric_id,
        metricType: row.metric_type,
        name: row.name,
        description: row.description ?? row.name,
        category: row.category ?? "macro",
        enabled: row.enabled,
        sortOrder: row.sort_order,
      })),
    };

    setStrategies((previous) => [...previous, nextStrategy]);
    setSelectedStrategyId(nextStrategy.id);

    try {
      await publishStrategyVersion(nextStrategy, nextStrategy.metrics, nextStrategy.structure, {
        name: nextStrategy.name,
        description: nextStrategy.description,
        learningGoal: nextStrategy.learningGoal,
        aiInstruction: nextStrategy.aiInstruction,
        status: nextStrategy.status,
      });
      setStrategyMessage(`${preset.name} cloned into your strategy workspace.`);
    } catch {
      setActionError("Preset cloned, but the initial revision could not be published.");
    } finally {
      setBusyPresetKey(null);
    }
  }

  async function branchStrategy() {
    if (!selectedStrategy) return;
    setStrategyBusyId(selectedStrategy.id);
    setActionError(null);
    setStrategyMessage(null);

    const branchName = `${selectedStrategy.name} (branch)`;

    const { data: strategy, error } = await supabase
      .from("user_strategies")
      .insert({
        user_id: userId,
        mode,
        name: branchName,
        description: selectedStrategy.description,
        learning_goal: selectedStrategy.learningGoal || null,
        ai_instruction: selectedStrategy.aiInstruction || null,
        status: "draft" as const,
        preset_key: selectedStrategy.presetKey,
        is_preset_clone: selectedStrategy.isPresetClone,
        is_default: false,
      })
      .select("*")
      .single();

    if (error || !strategy) {
      setActionError("Failed to branch strategy.");
      setStrategyBusyId(null);
      return;
    }

    // Copy metrics to the new strategy
    const metricInserts = selectedStrategy.metrics.map((m) => ({
      user_id: userId,
      mode,
      strategy_id: strategy.id,
      metric_id: m.metricId,
      metric_type: m.metricType as "fundamental" | "technical",
      name: m.name,
      description: m.description,
      category: m.category,
      enabled: m.enabled,
      sort_order: m.sortOrder,
    }));

    let copiedMetrics: MetricRow[] = [];
    if (metricInserts.length > 0) {
      const { data: insertedRows, error: metricError } = await supabase
        .from("user_metrics")
        .insert(metricInserts)
        .select("id, strategy_id, metric_id, metric_type, name, description, category, enabled, sort_order");

      if (metricError) {
        setActionError("Strategy branched, but metrics could not be copied.");
        setStrategyBusyId(null);
        return;
      }

      copiedMetrics = (insertedRows ?? []).map((row) => ({
        id: row.id,
        strategyId: strategy.id,
        metricId: row.metric_id,
        metricType: row.metric_type,
        name: row.name,
        description: row.description ?? row.name,
        category: row.category ?? "macro",
        enabled: row.enabled,
        sortOrder: row.sort_order,
      }));
    }

    const branchedStrategy: StrategyView = {
      id: strategy.id,
      name: branchName,
      description: selectedStrategy.description,
      learningGoal: selectedStrategy.learningGoal,
      aiInstruction: selectedStrategy.aiInstruction,
      status: "draft",
      isDefault: false,
      isPresetClone: selectedStrategy.isPresetClone,
      presetKey: selectedStrategy.presetKey,
      activeVersionId: null,
      versionNumber: 0,
      structure: { ...selectedStrategy.structure },
      metrics: copiedMetrics,
    };

    setStrategies((prev) => [...prev, branchedStrategy]);
    setSelectedStrategyId(branchedStrategy.id);

    try {
      await publishStrategyVersion(branchedStrategy, copiedMetrics, branchedStrategy.structure, {
        name: branchName,
        description: branchedStrategy.description,
        learningGoal: branchedStrategy.learningGoal,
        aiInstruction: branchedStrategy.aiInstruction,
        status: "draft",
      });
      setStrategyMessage(`Branched from ${selectedStrategy.name}. Edit this variant independently.`);
    } catch {
      setActionError("Strategy branched, but the initial revision could not be published.");
    } finally {
      setStrategyBusyId(null);
    }
  }

  function openModal(type: MetricType) {
    setModalType(type);
    setLibraryFilter("all");
    setModalError(null);
  }

  function closeModal() {
    setModalType(null);
    setLibraryFilter("all");
    setCustomName("");
    setCustomDescription("");
    setCustomIsHard(false);
    setModalError(null);
  }

  function renderMetricSection(type: MetricType, title: string, sectionMetrics: MetricRow[]) {
    return (
      <section className="surface-panel p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-sm text-tds-text">{title}</h2>
          <span className="rounded-full bg-tds-input px-2 py-1 font-mono text-xs text-tds-dim">
            {sectionMetrics.length}
          </span>
        </div>

        {sectionMetrics.length === 0 ? <p className="text-sm text-tds-dim">No metrics added.</p> : null}

        <div className="space-y-2">
          {sectionMetrics.map((metric, index) => {
            const rowBusy = busyMetricId === metric.id || busyMetricId === metric.metricId;
            return (
              <div
                key={metric.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-tds-border bg-tds-input p-3"
              >
                <div className="flex min-w-[240px] items-center gap-3">
                  <input
                    id={`metric-toggle-${metric.id}`}
                    type="checkbox"
                    checked={metric.enabled}
                    disabled={rowBusy}
                    aria-label={`Toggle ${metric.name}`}
                    title={`Toggle ${metric.name}`}
                    onChange={() => void toggleMetric(metric)}
                    className="h-4 w-4 rounded border-tds-border bg-tds-bg text-tds-blue focus:ring-tds-focus"
                  />
                  <div>
                    <label htmlFor={`metric-toggle-${metric.id}`} className="font-mono text-sm text-tds-text">
                      {metric.name}
                    </label>
                    <p className="text-xs text-tds-dim">{metric.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-tds-muted px-2 py-1 font-mono text-[10px] text-tds-text">
                    {categoryLabel(metric.category)}
                  </span>
                  <button
                    type="button"
                    disabled={rowBusy || index === 0}
                    onClick={() => void moveMetric(metric, -1)}
                    className="rounded-md border border-tds-border px-2 py-1 text-xs text-tds-dim hover:bg-tds-hover disabled:opacity-50"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={rowBusy || index === sectionMetrics.length - 1}
                    onClick={() => void moveMetric(metric, 1)}
                    className="rounded-md border border-tds-border px-2 py-1 text-xs text-tds-dim hover:bg-tds-hover disabled:opacity-50"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={rowBusy}
                    onClick={() => void removeMetric(metric)}
                    className="rounded-md border border-tds-red/50 px-2 py-1 text-sm text-tds-red hover:bg-tds-red/10 disabled:opacity-50"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => openModal(type)}
          className="mt-3 w-full rounded-lg border border-dashed border-tds-blue/60 bg-tds-blue/10 px-3 py-2 text-sm text-tds-blue hover:bg-tds-blue/20"
        >
          + Add
        </button>
      </section>
    );
  }

  return (
    <main className="terminal-page-shell">
      <section className="dashboard-action-row">
        <div>
          <p className="meta-label">Settings</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-tds-text sm:text-[2.8rem]">Strategy Studio</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-tds-dim sm:text-base">Build, score, and publish strategy revisions with shared structure and versioned metric stacks.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={strategyBusyId === "blank"}
            onClick={() => void createBlankStrategy()}
            className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-tds-text transition hover:border-slate-300 disabled:opacity-50"
          >
            {strategyBusyId === "blank" ? "Creating..." : "+ Blank Strategy"}
          </button>
          <button
            type="button"
            disabled={ratingLoading || !selectedStrategy}
            onClick={() => void runRating()}
            className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 transition hover:border-amber-300 disabled:opacity-50"
          >
            {ratingLoading ? "Rating..." : "Rate Strategy"}
          </button>
        </div>
      </section>

      <section className="analytics-kpi-strip">
        <article className="trade-review-card trade-compact-card p-5">
          <p className="meta-label">Mode</p>
          <p className="mt-3 text-xl font-semibold tracking-[-0.03em] text-tds-text">{mode}</p>
        </article>
        <article className="trade-review-card trade-compact-card p-5">
          <p className="meta-label">Strategies</p>
          <p className="mt-3 font-mono text-3xl text-tds-text">{strategies.length}</p>
        </article>
        <article className="trade-review-card trade-compact-card p-5">
          <p className="meta-label">Enabled Checks</p>
          <p className="mt-3 font-mono text-3xl text-tds-text">{metrics.filter((metric) => metric.enabled).length}</p>
        </article>
        <article className="trade-review-card trade-compact-card p-5">
          <p className="meta-label">Shared Structure</p>
          <p className="mt-3 font-mono text-3xl text-tds-text">{structureLibrary.length}</p>
        </article>
      </section>

      <section className="surface-panel p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_auto_auto] lg:items-end">
          <div>
            <label htmlFor="strategy-select" className="font-mono text-sm text-tds-text">Saved strategies</label>
            <select
              id="strategy-select"
              value={selectedStrategyId ?? ""}
              onChange={(event) => setSelectedStrategyId(event.target.value)}
              title="Saved strategies"
              className="mt-2 h-11 w-full rounded-lg border border-tds-border bg-tds-input px-3 text-sm text-tds-text focus:border-tds-focus focus:outline-none"
            >
              {strategies.map((strategy) => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name} {strategy.isDefault ? "• default" : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={!selectedStrategy || selectedStrategy.isDefault || strategyBusyId === selectedStrategy?.id}
            onClick={() => selectedStrategy ? void setDefaultStrategy(selectedStrategy) : undefined}
            className="rounded-lg border border-tds-border bg-tds-input px-3 py-2 text-sm text-tds-text hover:bg-tds-hover disabled:opacity-50"
          >
            Set default
          </button>
          <button
            type="button"
            disabled={!selectedStrategy || strategyBusyId === selectedStrategy?.id}
            onClick={() => void branchStrategy()}
            className="rounded-lg border border-tds-border bg-tds-input px-3 py-2 text-sm text-tds-text hover:bg-tds-hover disabled:opacity-50"
          >
            Branch
          </button>
          <div className="rounded-lg bg-tds-input px-3 py-2 text-xs text-tds-dim">
            {selectedStrategy ? `Revision ${selectedStrategy.versionNumber}` : "No strategy selected"}
          </div>
        </div>

        {selectedStrategy ? (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-tds-border bg-tds-input p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-tds-dim">Status</p>
              <p className="mt-2 text-sm text-tds-text">{selectedStrategy.status}</p>
            </div>
            <div className="rounded-lg border border-tds-border bg-tds-input p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-tds-dim">Default</p>
              <p className="mt-2 text-sm text-tds-text">{selectedStrategy.isDefault ? "Yes" : "No"}</p>
            </div>
            <div className="rounded-lg border border-tds-border bg-tds-input p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-tds-dim">Origin</p>
              <p className="mt-2 text-sm text-tds-text">{selectedStrategy.isPresetClone ? "Preset clone" : "Custom"}</p>
            </div>
            <div className="rounded-lg border border-tds-border bg-tds-input p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-tds-dim">Enabled checks</p>
              <p className="mt-2 text-sm text-tds-text">{metrics.filter((metric) => metric.enabled).length}</p>
            </div>
          </div>
        ) : null}
      </section>

      {selectedStrategy ? (
        <section className="surface-panel p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-mono text-sm text-tds-text">Strategy Details</h2>
              <p className="mt-2 text-sm leading-6 text-tds-dim">
                Strategies are now first-class objects. Every published change creates a new revision so trades and workbench items can keep their original strategy meaning.
              </p>
            </div>
            <button
              type="button"
              disabled={strategyBusyId === selectedStrategy.id}
              onClick={() => void saveStrategyDetails()}
              className="rounded-lg bg-tds-blue px-4 py-2 text-sm text-tds-text hover:bg-blue-500 disabled:opacity-50"
            >
              {strategyBusyId === selectedStrategy.id ? "Publishing..." : "Save details"}
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              type="text"
              value={strategyNameInput}
              onChange={(event) => setStrategyNameInput(event.target.value)}
              placeholder="Strategy name"
              className="rounded-lg border border-tds-border bg-tds-input px-3 py-2 text-sm text-tds-text focus:border-tds-focus focus:outline-none"
            />
            <select
              value={statusInput}
              onChange={(event) => setStatusInput(event.target.value as StrategyStatus)}
              aria-label="Strategy status"
              title="Strategy status"
              className="rounded-lg border border-tds-border bg-tds-input px-3 py-2 text-sm text-tds-text focus:border-tds-focus focus:outline-none"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
            <input
              type="text"
              value={strategyDescriptionInput}
              onChange={(event) => setStrategyDescriptionInput(event.target.value)}
              placeholder="What this strategy is designed to exploit"
              className="rounded-lg border border-tds-border bg-tds-input px-3 py-2 text-sm text-tds-text focus:border-tds-focus focus:outline-none md:col-span-2"
            />
            <input
              type="text"
              value={learningGoalInput}
              onChange={(event) => setLearningGoalInput(event.target.value)}
              placeholder="What this strategy is teaching you to improve"
              className="rounded-lg border border-tds-border bg-tds-input px-3 py-2 text-sm text-tds-text focus:border-tds-focus focus:outline-none md:col-span-2"
            />
            <textarea
              value={aiInstructionInput}
              onChange={(event) => setAiInstructionInput(event.target.value)}
              placeholder="Optional AI instruction for this strategy. Example: Prioritize clean higher-timeframe structure over short-term headline noise."
              className="min-h-[110px] rounded-lg border border-tds-border bg-tds-input px-3 py-2 text-sm text-tds-text focus:border-tds-focus focus:outline-none md:col-span-2"
            />
            <input
              type="text"
              value={setupTypesInput}
              onChange={(event) => setSetupTypesInput(event.target.value)}
              placeholder="Preferred setup types, comma separated"
              className="rounded-lg border border-tds-border bg-tds-input px-3 py-2 text-sm text-tds-text focus:border-tds-focus focus:outline-none"
            />
            <input
              type="text"
              value={conditionsInput}
              onChange={(event) => setConditionsInput(event.target.value)}
              placeholder="Preferred conditions, comma separated"
              className="rounded-lg border border-tds-border bg-tds-input px-3 py-2 text-sm text-tds-text focus:border-tds-focus focus:outline-none"
            />
            <input
              type="text"
              value={chartPatternInput}
              onChange={(event) => setChartPatternInput(event.target.value)}
              placeholder="Preferred chart pattern"
              className="rounded-lg border border-tds-border bg-tds-input px-3 py-2 text-sm text-tds-text focus:border-tds-focus focus:outline-none"
            />
            <input
              type="text"
              value={invalidationStyleInput}
              onChange={(event) => setInvalidationStyleInput(event.target.value)}
              placeholder="How the strategy gets invalidated"
              className="rounded-lg border border-tds-border bg-tds-input px-3 py-2 text-sm text-tds-text focus:border-tds-focus focus:outline-none"
            />
            <textarea
              value={sizingNotesInput}
              onChange={(event) => setSizingNotesInput(event.target.value)}
              placeholder="Sizing posture, conviction rules, and escalation notes"
              className="min-h-[110px] rounded-lg border border-tds-border bg-tds-input px-3 py-2 text-sm text-tds-text focus:border-tds-focus focus:outline-none md:col-span-2"
            />
          </div>
        </section>
      ) : null}

      <section className="surface-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-mono text-sm text-tds-text">Shared Structure Library</h2>
            <p className="mt-2 text-sm leading-6 text-tds-dim">
              Add custom setup types, conditions, and chart patterns once, then reuse them across every strategy and guided thesis flow.
            </p>
          </div>
          <span className="rounded-lg bg-tds-input px-3 py-2 text-xs text-tds-dim">{structureLibrary.length} saved</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {([
            ["setup_type", "Setup Types"],
            ["condition", "Conditions"],
            ["chart_pattern", "Chart Patterns"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStructureTab(value)}
              className={`rounded-full border px-3 py-1 text-xs ${
                structureTab === value
                  ? "border-tds-blue bg-tds-blue/20 text-tds-text"
                  : "border-tds-border bg-tds-card text-tds-dim hover:bg-tds-hover"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="rounded-lg border border-tds-border bg-tds-input p-3">
            <div className="space-y-2">
              {visibleStructureItems.length === 0 ? <p className="text-sm text-tds-dim">No shared entries saved for this type yet.</p> : null}
              {visibleStructureItems.map((item) => (
                <div key={item.id} className="rounded-lg border border-tds-border bg-tds-card p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-sm text-tds-text">{item.label}</p>
                        <span className="rounded-full bg-tds-muted px-2 py-1 font-mono text-[10px] text-tds-text">{item.family}</span>
                        {item.itemType === "setup_type" && item.setupCategory ? (
                          <span className="rounded-full border border-tds-border px-2 py-1 font-mono text-[10px] uppercase text-tds-dim">
                            {item.setupCategory}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs text-tds-dim">{item.detail || "No extra guidance saved for this entry yet."}</p>
                      {item.keywords.length > 0 ? <p className="mt-2 text-xs text-tds-dim">Keywords: {item.keywords.join(", ")}</p> : null}
                    </div>

                    <button
                      type="button"
                      disabled={structureBusyKey === item.id}
                      onClick={() => void deleteStructureLibraryItem(item)}
                      className="rounded-md border border-tds-red/50 px-2 py-1 text-sm text-tds-red hover:bg-tds-red/10 disabled:opacity-50"
                    >
                      {structureBusyKey === item.id ? "..." : "×"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-tds-border bg-tds-input p-3">
            <h3 className="font-mono text-sm text-tds-text">Add Shared Entry</h3>
            <div className="mt-3 space-y-3">
              <input
                type="text"
                value={structureLabelInput}
                onChange={(event) => setStructureLabelInput(event.target.value)}
                placeholder="Label"
                className="w-full rounded-lg border border-tds-border bg-tds-card px-3 py-2 text-sm text-tds-text focus:border-tds-focus focus:outline-none"
              />
              <input
                type="text"
                value={structureFamilyInput}
                onChange={(event) => setStructureFamilyInput(event.target.value)}
                placeholder="Family / category"
                className="w-full rounded-lg border border-tds-border bg-tds-card px-3 py-2 text-sm text-tds-text focus:border-tds-focus focus:outline-none"
              />
              {structureTab === "setup_type" ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-tds-dim">Setup Classification</p>
                  <div className="flex flex-wrap gap-2">
                    {(["fundamental", "technical"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setStructureSetupCategoryInput(value)}
                        className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] ${
                          structureSetupCategoryInput === value
                            ? "border-tds-blue bg-tds-blue/20 text-tds-text"
                            : "border-tds-border bg-tds-card text-tds-dim hover:bg-tds-hover"
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs leading-5 text-tds-dim">
                    Tag setup entries explicitly so trade pickers stop guessing whether the edge is narrative-driven or purely structural.
                  </p>
                </div>
              ) : null}
              <textarea
                value={structureDetailInput}
                onChange={(event) => setStructureDetailInput(event.target.value)}
                placeholder="Short description for the picker"
                className="min-h-[96px] w-full rounded-lg border border-tds-border bg-tds-card px-3 py-2 text-sm text-tds-text focus:border-tds-focus focus:outline-none"
              />
              <input
                type="text"
                value={structureKeywordsInput}
                onChange={(event) => setStructureKeywordsInput(event.target.value)}
                placeholder="Keywords, comma separated"
                className="w-full rounded-lg border border-tds-border bg-tds-card px-3 py-2 text-sm text-tds-text focus:border-tds-focus focus:outline-none"
              />
            </div>

            <button
              type="button"
              disabled={structureBusyKey === `save:${structureTab}`}
              onClick={() => void saveStructureLibraryItem()}
              className="mt-4 rounded-lg bg-tds-blue px-4 py-2 text-sm text-tds-text hover:bg-blue-500 disabled:opacity-50"
            >
              {structureBusyKey === `save:${structureTab}` ? "Saving..." : "Save shared entry"}
            </button>
          </div>
        </div>
      </section>

      {ratingError ? (
        <section className="rounded-lg border border-tds-red/40 bg-tds-red/10 p-3 text-sm text-tds-red">{ratingError}</section>
      ) : null}

      {strategyMessage ? (
        <section className="rounded-lg border border-tds-blue/30 bg-tds-blue/10 p-3 text-sm text-tds-text">{strategyMessage}</section>
      ) : null}

      {rating ? (
        <section className="surface-panel p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-mono text-sm text-tds-text">AI Strategy Rating</h2>
            {ratingMeta ? <AIProviderBadge meta={ratingMeta} /> : null}
          </div>
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-tds-blue bg-tds-bg font-mono text-2xl text-tds-text">
              {Math.round(rating.score)}
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm text-tds-text">{rating.assessment}</p>
              <p className="text-xs text-tds-dim">Missing: {rating.missing?.trim() || "None"}</p>
              <p className="text-xs text-tds-dim">Redundant: {rating.redundant?.trim() || "None"}</p>
            </div>
          </div>
        </section>
      ) : null}

      {actionError ? (
        <section className="rounded-lg border border-tds-red/40 bg-tds-red/10 p-3 text-sm text-tds-red">{actionError}</section>
      ) : null}

      {selectedStrategy ? (
        <>
          {metrics.length === 0 ? (
            <section className="rounded-xl border border-tds-amber/30 bg-tds-amber/10 p-4 text-sm text-tds-text">
              This strategy has no metrics yet. Clone a preset below or add your own checks manually before making it the live default.
            </section>
          ) : null}
          {renderMetricSection("fundamental", "Fundamental", fundamentalMetrics)}
          {renderMetricSection("technical", "Technical", technicalMetrics)}
        </>
      ) : null}

      <section className="surface-panel p-6">
        <h2 className="font-mono text-sm text-tds-text">Portfolio Equity</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min="1"
            step="100"
            value={equityInput}
            onChange={(event) => setEquityInput(event.target.value)}
            className="w-full max-w-xs rounded-lg border border-tds-border bg-tds-input px-3 py-2 font-mono text-sm text-tds-text focus:border-tds-focus focus:outline-none"
            placeholder="Portfolio equity"
          />
          <button
            type="button"
            disabled={equitySaving}
            onClick={() => void saveEquity()}
            className="rounded-lg bg-tds-blue px-4 py-2 text-sm text-tds-text hover:bg-blue-500 disabled:opacity-50"
          >
            {equitySaving ? "Saving..." : "Save"}
          </button>
        </div>
        {equityMessage ? <p className="mt-2 text-xs text-tds-dim">{equityMessage}</p> : null}
      </section>

      <StrategyTemplate
        mode={mode}
        busyPresetKey={busyPresetKey}
        message={strategyMessage}
        onClonePreset={(preset) => {
          void clonePreset(preset);
        }}
      />

      {modalType ? (
        <div className="fixed inset-0 z-50 bg-tds-bg/95 backdrop-blur-sm">
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col p-4 md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono text-lg text-tds-text">
                ADD {modalType === "fundamental" ? "FUNDAMENTAL" : "TECHNICAL"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-tds-border px-3 py-1 text-sm text-tds-dim hover:bg-tds-hover"
              >
                Close
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {["all", "bull", "bear", ...modalCategories].map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setLibraryFilter(filter)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    libraryFilter === filter
                      ? "border-tds-blue bg-tds-blue/20 text-tds-text"
                      : "border-tds-border bg-tds-card text-tds-dim hover:bg-tds-hover"
                  }`}
                >
                  {filter === "all"
                    ? "All"
                    : filter === "bull"
                      ? "▲ Bull"
                      : filter === "bear"
                        ? "▼ Bear"
                        : categoryLabel(filter)}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto rounded-xl border border-tds-border bg-tds-card p-3">
              <div className="space-y-2">
                {modalLibrary.length === 0 ? (
                  <p className="text-sm text-tds-dim">No library metrics match this filter.</p>
                ) : null}
                {modalLibrary.map((metric) => {
                  const adding = busyMetricId === metric.id;
                  return (
                    <div
                      key={metric.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-tds-border bg-tds-input p-3"
                    >
                      <div className="min-w-[240px] flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <p className="font-mono text-sm text-tds-text">{metric.name}</p>
                          <span className="rounded-full bg-tds-muted px-2 py-1 font-mono text-[10px] text-tds-text">
                            {categoryLabel(metric.category)}
                          </span>
                        </div>
                        <p className="text-xs text-tds-dim">{metric.description}</p>
                      </div>
                      <button
                        type="button"
                        disabled={adding || !selectedStrategy}
                        onClick={() => void addLibraryMetric(modalType, metric.id)}
                        className="rounded-md bg-tds-blue px-3 py-2 text-sm text-tds-text hover:bg-blue-500 disabled:opacity-50"
                      >
                        {adding ? "Adding..." : "+ Add"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <section className="mt-4 surface-panel p-6">
              <h3 className="font-mono text-sm text-tds-text">Custom Metric</h3>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <input
                  type="text"
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                  placeholder="Metric name"
                  className="rounded-lg border border-tds-border bg-tds-input px-3 py-2 text-sm text-tds-text focus:border-tds-focus focus:outline-none"
                />
                <input
                  type="text"
                  value={customDescription}
                  onChange={(event) => setCustomDescription(event.target.value)}
                  placeholder="Metric description"
                  className="rounded-lg border border-tds-border bg-tds-input px-3 py-2 text-sm text-tds-text focus:border-tds-focus focus:outline-none"
                />
              </div>
              <div className="mt-3 flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-tds-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customIsHard}
                    onChange={(event) => setCustomIsHard(event.target.checked)}
                    className="h-4 w-4 rounded border-tds-border accent-tds-red"
                  />
                  Hard rule
                  <span className="text-xs text-tds-dim">(blocks execution when failed)</span>
                </label>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-tds-dim">Creates metric id format: custom_[uuid]</p>
                <button
                  type="button"
                  disabled={!selectedStrategy}
                  onClick={() => void addCustomMetric(modalType)}
                  className="rounded-md bg-tds-green px-3 py-2 text-sm text-tds-text hover:bg-emerald-500 disabled:opacity-50"
                >
                  + Add Custom
                </button>
              </div>
            </section>

            {modalError ? <p className="mt-2 text-sm text-tds-red">{modalError}</p> : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
