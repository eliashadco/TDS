import type { Metric, TradeMode } from "@/types/trade";

export type StrategyStatus = "draft" | "active" | "archived";

export type StrategyMetricSnapshot = Pick<Metric, "id" | "name" | "description" | "category" | "type"> & {
  enabled: boolean;
  isHard?: boolean;
};

export type StrategyStructureSnapshot = {
  setupTypes: string[];
  conditions: string[];
  chartPattern: string;
  sizingNotes: string;
  invalidationStyle: string;
};

export type StrategySnapshot = {
  strategyId: string | null;
  strategyVersionId: string | null;
  name: string;
  description: string;
  learningGoal: string | null;
  aiInstruction: string | null;
  mode: TradeMode;
  metrics: StrategyMetricSnapshot[];
  structure: StrategyStructureSnapshot;
  source: "custom" | "preset" | "legacy";
  versionNumber: number | null;
  createdAt: string | null;
};

export type SavedStrategy = {
  id: string;
  userId: string;
  mode: TradeMode;
  name: string;
  description: string;
  learningGoal: string | null;
  aiInstruction: string | null;
  status: StrategyStatus;
  isDefault: boolean;
  isPresetClone: boolean;
  presetKey: string | null;
  activeVersionId: string | null;
  versionNumber: number;
  metrics: Metric[];
  structure: StrategyStructureSnapshot;
  snapshot: StrategySnapshot;
};

export type StrategyPresetDefinition = {
  key: string;
  mode: TradeMode;
  name: string;
  description: string;
  learningGoal: string;
  whenNotToUse: string;
  sizingNotes: string;
  walkthrough: string;
  invalidationStyle: string;
  setupTypes: string[];
  conditions: string[];
  chartPattern: string;
  metricIds: string[];
};