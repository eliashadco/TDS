/** Client-safe shapes returned by PR 7 analytics routes (strategy proof). */

export const STRATEGY_SAMPLE_MINIMUM = 30;
/** Separate n<20 gate for advanced statistics (PR 8). Below this, drawdown shape and bootstrap intervals are exploratory only. */
export const ADVANCED_SAMPLE_MINIMUM = 20;

export type StrategyProofBreakdownRow = {
  key: string;
  count: number;
  avgR: number | null;
  winRate: number | null;
};

export type StrategyProofReport = {
  sampleSize: number;
  statisticallySignificant: boolean;
  winRateAll: number | null;
  winRateClean: number | null;
  winRateOverride: number | null;
  expectancyAll: number | null;
  expectancyClean: number | null;
  expectancyOverride: number | null;
  profitFactor: number | null;
  overrideRate: number | null;
  overrideCostTotalR: number;
  overrideCostAvgR: number | null;
  /** Mean(outcome_r − estimated_r_without_override) where estimate exists — execution vs rule path. */
  ruleFollowingDeltaAvgR: number | null;
  setupPerformance: StrategyProofBreakdownRow[];
  executionPerformance: StrategyProofBreakdownRow[];
  directionPerformance: StrategyProofBreakdownRow[];
  maxConsecutiveLosses: number;
  currentLossStreak: number;
  avgMaeR: number | null;
  avgMfeR: number | null;
  targetCaptureEfficiency: number | null;
};

export type StrategyStatisticsCacheRow = {
  strategy_id: string;
  sample_size: number;
  win_rate: number | null;
  expectancy_r: number | null;
  avg_mae_r: number | null;
  avg_mfe_r: number | null;
  override_rate: number | null;
  override_cost_total_r: number | null;
  parameter_failure_latency_p50: number | null;
  target_capture_efficiency: number | null;
  last_computed_at: string;
};

/** PR 8 — Advanced statistics pack (descriptive only). */
export type ExcursionBucketRow = {
  key: string;
  count: number;
  avgMaeR: number | null;
  medianMaeR: number | null;
  avgMfeR: number | null;
  medianMfeR: number | null;
};

export type EfficiencyBucketRow = {
  key: string;
  count: number;
  avgOutcomePerMfe: number | null;
};

export type DistributionSliceJson = {
  count: number;
  medianR: number | null;
  stdDevR: number | null;
  bands: {
    p10: number | null;
    p25: number | null;
    p50: number | null;
    p75: number | null;
    p90: number | null;
  };
};

export type AdvancedStatisticsPack = {
  disclaimer: string;
  retrospectiveNote: string;
  maeMfe: {
    avgMaeR: number | null;
    medianMaeR: number | null;
    avgMfeR: number | null;
    medianMfeR: number | null;
    bySetup: ExcursionBucketRow[];
    byExecution: ExcursionBucketRow[];
  };
  distribution: {
    all: DistributionSliceJson;
    clean: DistributionSliceJson;
    override: DistributionSliceJson;
  };
  drawdown: {
    maxDrawdownR: number;
    currentDrawdownR: number;
    maxDrawdownDurationTrades: number;
    recoveryFactor: number | null;
    netCumulativeR: number;
    cumulativeCurve: Array<{ tradeIndex: number; cumulativeR: number }>;
    byStrategyVersion: Array<{ versionKey: string; maxDrawdownR: number; tradeCount: number }>;
  };
  confidence: {
    winRate95: { low: number; high: number } | null;
    expectancy95: { low: number; high: number } | null;
    note: string;
  };
  holding: {
    avgHoldDays: number | null;
    medianHoldDays: number | null;
    earlyExitRate: number | null;
    medianHoldDaysAmongTouched1R: number | null;
    proxyNote: string;
  };
  parameterLatency: {
    avgDaysToFailure: number | null;
    medianDaysToFailure: number | null;
    buckets: Array<{ label: string; count: number }>;
    bySetup: Array<{ key: string; count: number; medianDaysToFailure: number | null }>;
    note: string;
  };
  targetCapture: {
    touchRate1R: number | null;
    touchRate2R: number | null;
    touchRate3R: number | null;
    avgRealizedPerMfe: number | null;
    byExecution: EfficiencyBucketRow[];
    bySetup: EfficiencyBucketRow[];
  };
};

export type StrategyAnalyticsResponse =
  | { empty: true }
  | {
      empty?: false;
      strategyId: string;
      sampleWarning: boolean;
      proof: StrategyProofReport;
      statistics: StrategyStatisticsCacheRow | null;
      advanced: AdvancedStatisticsPack;
    };

export type DecisionQualityBreakdown = {
  key: string;
  count: number;
  avgR: number | null;
  winRate: number | null;
};

export type DecisionQualityStrategyRow = {
  strategyId: string;
  strategyName: string;
  sampleSize: number;
  expectancyR: number | null;
  winRate: number | null;
  overrideRate: number | null;
  overrideCostTotalR: number;
};

export type DecisionQualityResponse = {
  totals: {
    outcomes: number;
    strategiesRepresented: number;
  };
  byExecution: DecisionQualityBreakdown[];
  byStrategy: DecisionQualityStrategyRow[];
};

export type AnalyticsOverviewStrategyRow = {
  strategyId: string;
  strategyName: string;
  mode: string | null;
  sampleSize: number;
  expectancyR: number | null;
  winRate: number | null;
  statisticallySignificant: boolean;
};

export type AnalyticsOverviewResponse = {
  strategies: AnalyticsOverviewStrategyRow[];
  totalOutcomes: number;
};
