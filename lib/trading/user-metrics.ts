import { getDirectionDescription, type Direction } from "@/lib/ai/direction";
import { buildMetricsForMode, getMetricDefinition } from "@/lib/trading/presets";
import type { Database } from "@/types/database";
import type { Metric, TradeMode } from "@/types/trade";

export const METRIC_CATEGORIES = ["val", "quality", "mom", "risk", "macro", "trend", "vol", "intra", "struct"] as const;

export type PersistedMetricRow = Pick<
  Database["public"]["Tables"]["user_metrics"]["Row"],
  "id" | "strategy_id" | "metric_id" | "metric_type" | "name" | "description" | "category" | "enabled" | "sort_order"
>;

export function asMetricCategory(value: string | null): Metric["category"] {
  const found = METRIC_CATEGORIES.find((category) => category === value);
  return found ?? "trend";
}

export function mapPersistedMetricRowToMetric(row: PersistedMetricRow): Metric {
  return {
    id: row.metric_id,
    name: row.name,
    description: row.description ?? row.name,
    category: asMetricCategory(row.category),
    type: row.metric_type,
    enabled: Boolean(row.enabled),
  };
}

export function buildStarterMetricSeed(
  userId: string,
  mode: TradeMode,
  strategyId?: string,
): Database["public"]["Tables"]["user_metrics"]["Insert"][] {
  return buildMetricsForMode(mode).map((metric, index) => ({
    user_id: userId,
    mode,
    strategy_id: strategyId ?? null,
    metric_id: metric.id,
    metric_type: metric.type,
    name: metric.name,
    description: metric.description,
    category: metric.category,
    enabled: true,
    sort_order: index,
  }));
}

export function resolveMetricAssessmentDescription(
  metric: Pick<Metric, "id" | "description">,
  direction: Direction,
): string {
  const persistedDescription = metric.description.trim();
  const libraryMetric = getMetricDefinition(metric.id);

  if (!libraryMetric) {
    return persistedDescription || getDirectionDescription(metric.id, direction);
  }

  if (metric.id.startsWith("custom_")) {
    return persistedDescription || getDirectionDescription(metric.id, direction);
  }

  const libraryDescription = libraryMetric.description.trim();
  if (persistedDescription && persistedDescription !== libraryDescription) {
    return persistedDescription;
  }

  return getDirectionDescription(metric.id, direction);
}