import type { SupabaseClient } from "@supabase/supabase-js";
import { buildStarterMetricSeed, mapPersistedMetricRowToMetric, type PersistedMetricRow } from "@/lib/trading/user-metrics";
import { buildMetricsForMode } from "@/lib/trading/presets";
import { buildMetricsFromPreset, buildStarterStrategyBlueprint, buildStarterStructure, getStarterStrategyPreset } from "@/lib/trading/strategy-presets";
import type { Database, Json } from "@/types/database";
import type { Metric, TradeMode } from "@/types/trade";
import type {
  SavedStrategy,
  StrategyMetricSnapshot,
  StrategyPresetDefinition,
  StrategySnapshot,
  StrategyStructureSnapshot,
  StrategyStatus,
} from "@/types/strategy";

const ALL_TRADE_MODES: TradeMode[] = ["investment", "swing", "daytrade", "scalp"];

type StrategyRow = Database["public"]["Tables"]["user_strategies"]["Row"];
type StrategyVersionRow = Database["public"]["Tables"]["strategy_versions"]["Row"];
type StrategyMetricRow = PersistedMetricRow & {
  strategy_id: string | null;
};

type StrategyWorkspaceResult = {
  strategies: SavedStrategy[];
  defaultStrategyId: string | null;
  schemaReady: boolean;
};

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function asTradeMode(value: unknown, fallback: TradeMode): TradeMode {
  return value === "investment" || value === "swing" || value === "daytrade" || value === "scalp" ? value : fallback;
}

function asStrategyStatus(value: unknown): StrategyStatus {
  return value === "draft" || value === "active" || value === "archived" ? value : "active";
}

function asMetricType(value: unknown): Metric["type"] {
  return value === "fundamental" ? "fundamental" : "technical";
}

function asMetricCategory(value: unknown): Metric["category"] {
  return value === "val" || value === "quality" || value === "mom" || value === "risk" || value === "macro" || value === "trend" || value === "vol" || value === "intra" || value === "struct"
    ? value
    : "trend";
}

function formatModeLabel(mode: TradeMode): string {
  if (mode === "daytrade") {
    return "Day Trade";
  }

  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function isMissingStrategySchemaError(error: unknown): boolean {
  const value = asRecord(error);
  const code = asString(value.code);
  const message = asString(value.message);

  if (code !== "PGRST205") {
    return false;
  }

  return message.includes("public.user_strategies") || message.includes("public.strategy_versions");
}

export function metricToSnapshot(metric: Metric): StrategyMetricSnapshot {
  return {
    id: metric.id,
    name: metric.name,
    description: metric.description,
    category: metric.category,
    type: metric.type,
    enabled: metric.enabled,
  };
}

export function normalizeStrategyStructure(
  input: unknown,
  fallback: StrategyStructureSnapshot,
): StrategyStructureSnapshot {
  const value = asRecord(input);

  return {
    setupTypes: asStringArray(value.setupTypes).length > 0 ? asStringArray(value.setupTypes) : [...fallback.setupTypes],
    conditions: asStringArray(value.conditions).length > 0 ? asStringArray(value.conditions) : [...fallback.conditions],
    chartPattern: asString(value.chartPattern, fallback.chartPattern || "None") || "None",
    sizingNotes: asString(value.sizingNotes, fallback.sizingNotes),
    invalidationStyle: asString(value.invalidationStyle, fallback.invalidationStyle),
  };
}

export function parseStrategySnapshot(raw: Json | null | undefined, fallbackMode: TradeMode): StrategySnapshot | null {
  const value = asRecord(raw);
  if (!value.name) {
    return null;
  }

  const metrics = Array.isArray(value.metrics)
    ? value.metrics
        .map((entry) => {
          const metric = asRecord(entry);
          const id = asString(metric.id);
          if (!id) {
            return null;
          }

          return {
            id,
            name: asString(metric.name, id),
            description: asString(metric.description, asString(metric.name, id)),
            category: asMetricCategory(metric.category),
            type: asMetricType(metric.type),
            enabled: metric.enabled !== false,
          } satisfies StrategyMetricSnapshot;
        })
        .filter((metric): metric is StrategyMetricSnapshot => Boolean(metric))
    : [];

  const mode = asTradeMode(value.mode, fallbackMode);
  const fallbackStructure = buildStarterStructure(mode);

  return {
    strategyId: typeof value.strategyId === "string" ? value.strategyId : null,
    strategyVersionId: typeof value.strategyVersionId === "string" ? value.strategyVersionId : null,
    name: asString(value.name),
    description: asString(value.description),
    learningGoal: typeof value.learningGoal === "string" ? value.learningGoal : null,
    aiInstruction: typeof value.aiInstruction === "string" ? value.aiInstruction : null,
    mode,
    metrics,
    structure: normalizeStrategyStructure(value.structure, fallbackStructure),
    source: value.source === "preset" || value.source === "legacy" ? value.source : "custom",
    versionNumber: typeof value.versionNumber === "number" ? value.versionNumber : null,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
  };
}

export function buildStrategySnapshot(input: {
  strategyId: string | null;
  strategyVersionId: string | null;
  name: string;
  description: string;
  learningGoal: string | null;
  aiInstruction: string | null;
  mode: TradeMode;
  metrics: Metric[];
  structure: StrategyStructureSnapshot;
  source: StrategySnapshot["source"];
  versionNumber: number | null;
  createdAt?: string | null;
}): StrategySnapshot {
  return {
    strategyId: input.strategyId,
    strategyVersionId: input.strategyVersionId,
    name: input.name,
    description: input.description,
    learningGoal: input.learningGoal,
    aiInstruction: input.aiInstruction,
    mode: input.mode,
    metrics: input.metrics.map(metricToSnapshot),
    structure: {
      setupTypes: [...input.structure.setupTypes],
      conditions: [...input.structure.conditions],
      chartPattern: input.structure.chartPattern,
      sizingNotes: input.structure.sizingNotes,
      invalidationStyle: input.structure.invalidationStyle,
    },
    source: input.source,
    versionNumber: input.versionNumber,
    createdAt: input.createdAt ?? null,
  };
}

export function updateStrategySnapshotStructure(
  snapshot: StrategySnapshot,
  patch: Partial<StrategyStructureSnapshot>,
): StrategySnapshot {
  return {
    ...snapshot,
    structure: {
      ...snapshot.structure,
      ...patch,
      setupTypes: patch.setupTypes ? [...patch.setupTypes] : [...snapshot.structure.setupTypes],
      conditions: patch.conditions ? [...patch.conditions] : [...snapshot.structure.conditions],
      chartPattern: patch.chartPattern ?? snapshot.structure.chartPattern,
      sizingNotes: patch.sizingNotes ?? snapshot.structure.sizingNotes,
      invalidationStyle: patch.invalidationStyle ?? snapshot.structure.invalidationStyle,
    },
  };
}

export function metricsFromStrategySnapshot(snapshot: StrategySnapshot | null): Metric[] {
  if (!snapshot) {
    return [];
  }

  return snapshot.metrics.map((metric) => ({
    id: metric.id,
    name: metric.name,
    description: metric.description,
    category: metric.category,
    type: metric.type,
    enabled: metric.enabled,
  }));
}

export function buildStrategyMetricSeed(
  userId: string,
  mode: TradeMode,
  strategyId: string,
  metrics: Metric[],
): Database["public"]["Tables"]["user_metrics"]["Insert"][] {
  return metrics.map((metric, index) => ({
    user_id: userId,
    mode,
    strategy_id: strategyId,
    metric_id: metric.id,
    metric_type: metric.type,
    name: metric.name,
    description: metric.description,
    category: metric.category,
    enabled: metric.enabled,
    sort_order: index,
  }));
}

export function buildBlankStrategyPreset(mode: TradeMode): StrategyPresetDefinition {
  const starter = getStarterStrategyPreset(mode);

  return {
    key: `blank-${mode}`,
    mode,
    name: `${formatModeLabel(mode)} Blank Strategy`,
    description: `A blank ${formatModeLabel(mode).toLowerCase()} workspace for building your own named edge from scratch.`,
    learningGoal: starter.learningGoal,
    whenNotToUse: "Avoid leaving it blank for live trading. Add and define the metrics before deploying real trades.",
    sizingNotes: starter.sizingNotes,
    walkthrough: starter.walkthrough,
    invalidationStyle: starter.invalidationStyle,
    setupTypes: starter.setupTypes,
    conditions: starter.conditions,
    chartPattern: starter.chartPattern,
    metricIds: [],
  };
}

async function createStrategyVersion(
  supabase: SupabaseClient<Database>,
  strategy: StrategyRow,
  metrics: Metric[],
  structure: StrategyStructureSnapshot,
  source: StrategySnapshot["source"],
  versionNumber: number,
) {
  const snapshot = buildStrategySnapshot({
    strategyId: strategy.id,
    strategyVersionId: null,
    name: strategy.name,
    description: strategy.description,
    learningGoal: strategy.learning_goal,
    aiInstruction: strategy.ai_instruction,
    mode: strategy.mode as TradeMode,
    metrics,
    structure,
    source,
    versionNumber,
  });

  const { data: version, error: versionError } = await supabase
    .from("strategy_versions")
    .insert({
      strategy_id: strategy.id,
      version_number: versionNumber,
      snapshot: snapshot as unknown as Json,
    })
    .select("*")
    .single();

  if (versionError || !version) {
    throw versionError ?? new Error("strategy_version_insert_failed");
  }

  const finalizedSnapshot = buildStrategySnapshot({
    ...snapshot,
    strategyVersionId: version.id,
    createdAt: version.created_at,
  });

  const { error: updateError } = await supabase
    .from("strategy_versions")
    .update({ snapshot: finalizedSnapshot as unknown as Json })
    .eq("id", version.id);

  if (updateError) {
    throw updateError;
  }

  const { error: strategyUpdateError } = await supabase
    .from("user_strategies")
    .update({ active_version_id: version.id, updated_at: new Date().toISOString() })
    .eq("id", strategy.id);

  if (strategyUpdateError) {
    throw strategyUpdateError;
  }

  return {
    ...version,
    snapshot: finalizedSnapshot as unknown as Json,
  } satisfies StrategyVersionRow;
}

async function bootstrapStrategyWorkspace(
  supabase: SupabaseClient<Database>,
  userId: string,
  mode: TradeMode,
): Promise<void> {
  const { data: legacyMetricRows } = await supabase
    .from("user_metrics")
    .select("id, strategy_id, metric_id, metric_type, name, description, category, enabled, sort_order")
    .eq("user_id", userId)
    .eq("mode", mode)
    .is("strategy_id", null)
    .order("sort_order", { ascending: true });

  const starterBlueprint = buildStarterStrategyBlueprint(mode);
  const legacyMetrics = (legacyMetricRows ?? []).map(mapPersistedMetricRowToMetric);
  const metrics = legacyMetrics.length > 0
    ? legacyMetrics.map((metric) => ({ ...metric, enabled: metric.enabled }))
    : starterBlueprint.metrics;

  const { data: strategy, error: strategyError } = await supabase
    .from("user_strategies")
    .insert({
      user_id: userId,
      mode,
      name: starterBlueprint.name,
      description: starterBlueprint.description,
      learning_goal: starterBlueprint.learningGoal,
      ai_instruction: null,
      status: "active",
      preset_key: starterBlueprint.presetKey,
      is_preset_clone: false,
      is_default: true,
    })
    .select("*")
    .single();

  if (strategyError || !strategy) {
    throw strategyError ?? new Error("strategy_insert_failed");
  }

  if ((legacyMetricRows ?? []).length > 0) {
    const legacyIds = legacyMetricRows?.map((row) => row.id) ?? [];
    const { error: adoptError } = await supabase
      .from("user_metrics")
      .update({ strategy_id: strategy.id })
      .in("id", legacyIds);

    if (adoptError) {
      throw adoptError;
    }
  } else {
    const { error: metricError } = await supabase
      .from("user_metrics")
      .insert(buildStarterMetricSeed(userId, mode, strategy.id));

    if (metricError) {
      throw metricError;
    }
  }

  await createStrategyVersion(
    supabase,
    strategy,
    metrics.length > 0 ? metrics : buildMetricsForMode(mode).map((metric) => ({ ...metric, enabled: true })),
    starterBlueprint.structure,
    legacyMetrics.length > 0 ? "legacy" : "preset",
    1,
  );
}

export async function ensureStrategyWorkspaceForMode(
  supabase: SupabaseClient<Database>,
  userId: string,
  mode: TradeMode,
): Promise<StrategyWorkspaceResult> {
  try {
    let { data: strategies, error: strategiesError } = await supabase
      .from("user_strategies")
      .select("*")
      .eq("user_id", userId)
      .eq("mode", mode)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (strategiesError) {
      throw strategiesError;
    }

    if (!strategies || strategies.length === 0) {
      await bootstrapStrategyWorkspace(supabase, userId, mode);
      ({ data: strategies, error: strategiesError } = await supabase
        .from("user_strategies")
        .select("*")
        .eq("user_id", userId)
        .eq("mode", mode)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true }));

      if (strategiesError) {
        throw strategiesError;
      }
    }

    const activeStrategies = (strategies ?? []).filter((strategy) => strategy.status !== "archived");
    const strategyIds = activeStrategies.map((strategy) => strategy.id);
    if (strategyIds.length === 0) {
      return { strategies: [], defaultStrategyId: null, schemaReady: true };
    }

    const [{ data: metricRows, error: metricRowsError }, { data: versionRows, error: versionRowsError }] = await Promise.all([
      supabase
        .from("user_metrics")
        .select("id, strategy_id, metric_id, metric_type, name, description, category, enabled, sort_order")
        .eq("user_id", userId)
        .eq("mode", mode)
        .in("strategy_id", strategyIds)
        .order("sort_order", { ascending: true }),
      supabase
        .from("strategy_versions")
        .select("*")
        .in("strategy_id", strategyIds)
        .order("version_number", { ascending: false }),
    ]);

    if (metricRowsError) {
      throw metricRowsError;
    }

    if (versionRowsError) {
      throw versionRowsError;
    }

    const metricRowsByStrategy = (metricRows ?? []).reduce<Record<string, StrategyMetricRow[]>>((acc, row) => {
      if (!row.strategy_id) {
        return acc;
      }
      acc[row.strategy_id] = [...(acc[row.strategy_id] ?? []), row];
      return acc;
    }, {});

    const versionsById = new Map((versionRows ?? []).map((version) => [version.id, version]));
    const latestVersionByStrategy = new Map<string, StrategyVersionRow>();
    (versionRows ?? []).forEach((version) => {
      if (!latestVersionByStrategy.has(version.strategy_id)) {
        latestVersionByStrategy.set(version.strategy_id, version);
      }
    });

    const hydratedStrategies: SavedStrategy[] = [];

    for (const strategy of activeStrategies) {
      let rows = metricRowsByStrategy[strategy.id] ?? [];
      const fallbackStructure = buildStarterStructure(mode);
      let activeVersion = strategy.active_version_id ? versionsById.get(strategy.active_version_id) ?? null : latestVersionByStrategy.get(strategy.id) ?? null;
      let parsedSnapshot = parseStrategySnapshot(activeVersion?.snapshot ?? null, mode);

      if (rows.length === 0 && parsedSnapshot && parsedSnapshot.metrics.length > 0) {
        const metricSeed = buildStrategyMetricSeed(userId, mode, strategy.id, metricsFromStrategySnapshot(parsedSnapshot));
        const { data: insertedRows, error: insertedRowsError } = await supabase
          .from("user_metrics")
          .insert(metricSeed)
          .select("id, strategy_id, metric_id, metric_type, name, description, category, enabled, sort_order");

        if (insertedRowsError) {
          throw insertedRowsError;
        }

        rows = (insertedRows ?? []) as StrategyMetricRow[];
      }

      const metrics = rows.length > 0
        ? rows.map(mapPersistedMetricRowToMetric)
        : parsedSnapshot
          ? metricsFromStrategySnapshot(parsedSnapshot)
          : buildMetricsFromPreset(getStarterStrategyPreset(mode));

      if (!activeVersion) {
        const versionNumber = 1;
        activeVersion = await createStrategyVersion(
          supabase,
          strategy,
          metrics,
          parsedSnapshot?.structure ?? fallbackStructure,
          strategy.is_preset_clone ? "preset" : strategy.preset_key ? "preset" : "custom",
          versionNumber,
        );
        parsedSnapshot = parseStrategySnapshot(activeVersion.snapshot, mode);
      }

      const snapshot = parsedSnapshot ?? buildStrategySnapshot({
        strategyId: strategy.id,
        strategyVersionId: activeVersion.id,
        name: strategy.name,
        description: strategy.description,
        learningGoal: strategy.learning_goal,
        aiInstruction: strategy.ai_instruction,
        mode,
        metrics,
        structure: fallbackStructure,
        source: strategy.is_preset_clone ? "preset" : strategy.preset_key ? "preset" : "custom",
        versionNumber: activeVersion.version_number,
        createdAt: activeVersion.created_at,
      });

      hydratedStrategies.push({
        id: strategy.id,
        userId: strategy.user_id,
        mode: strategy.mode as TradeMode,
        name: strategy.name,
        description: strategy.description,
        learningGoal: strategy.learning_goal,
        aiInstruction: strategy.ai_instruction,
        status: asStrategyStatus(strategy.status),
        isDefault: strategy.is_default,
        isPresetClone: strategy.is_preset_clone,
        presetKey: strategy.preset_key,
        activeVersionId: activeVersion.id,
        versionNumber: activeVersion.version_number,
        metrics,
        structure: snapshot.structure,
        snapshot,
      });
    }

    const defaultStrategy = hydratedStrategies.find((strategy) => strategy.isDefault) ?? hydratedStrategies[0] ?? null;
    if (defaultStrategy && !hydratedStrategies.some((strategy) => strategy.isDefault)) {
      const { error: defaultStrategyError } = await supabase
        .from("user_strategies")
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq("id", defaultStrategy.id);

      if (defaultStrategyError) {
        throw defaultStrategyError;
      }

      defaultStrategy.isDefault = true;
    }

    return {
      strategies: hydratedStrategies,
      defaultStrategyId: defaultStrategy?.id ?? null,
      schemaReady: true,
    };
  } catch (error) {
    if (isMissingStrategySchemaError(error)) {
      return {
        strategies: [],
        defaultStrategyId: null,
        schemaReady: false,
      };
    }

    throw error;
  }
}

export async function ensureStrategyWorkspaceForAllModes(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ strategies: SavedStrategy[]; schemaReady: boolean }> {
  const results = await Promise.all(ALL_TRADE_MODES.map((mode) => ensureStrategyWorkspaceForMode(supabase, userId, mode)));

  if (results.some((result) => !result.schemaReady)) {
    return {
      strategies: [],
      schemaReady: false,
    };
  }

  return {
    strategies: results.flatMap((result) => result.strategies),
    schemaReady: true,
  };
}