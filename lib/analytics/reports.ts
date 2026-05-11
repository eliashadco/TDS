import type {
  DecisionQualityBreakdown,
  DecisionQualityResponse,
  DecisionQualityStrategyRow,
  StrategyProofBreakdownRow,
  StrategyProofReport,
} from "@/types/analytics";
import { STRATEGY_SAMPLE_MINIMUM as SAMPLE_MIN } from "@/types/analytics";

export type OutcomeRowForProof = {
  outcome_r: number;
  had_override: boolean;
  override_r_cost: number | null;
  estimated_r_without_override: number | null;
  execution_classification: string | null;
  mae_r: number | null;
  mfe_r: number | null;
  touched_1r: boolean;
  touched_2r: boolean;
  touched_3r: boolean;
  holding_minutes: number | null;
  first_parameter_failure_at: string | null;
  setup_types: string[];
  direction: "LONG" | "SHORT";
  closed_at: string | null;
  trade_created_at: string | null;
  strategy_version_id: string | null;
};

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function winRateFromRs(rs: number[]): number | null {
  if (rs.length === 0) return null;
  return rs.filter((r) => r > 0).length / rs.length;
}

function expectancy(rs: number[]): number | null {
  return avg(rs);
}

function profitFactor(rs: number[]): number | null {
  if (rs.length === 0) return null;
  const grossWin = rs.filter((r) => r > 0).reduce((a, b) => a + b, 0);
  const lossesAbs = Math.abs(rs.filter((r) => r < 0).reduce((a, b) => a + b, 0));
  if (lossesAbs === 0) return null;
  return grossWin / lossesAbs;
}

function sortedByClose(rows: OutcomeRowForProof[]): OutcomeRowForProof[] {
  return [...rows].sort((a, b) => {
    const ta = a.closed_at ? new Date(a.closed_at).getTime() : 0;
    const tb = b.closed_at ? new Date(b.closed_at).getTime() : 0;
    return ta - tb;
  });
}

function lossStreaks(sortedRs: number[]): { maxConsecutiveLosses: number; currentLossStreak: number } {
  let maxLoss = 0;
  let cur = 0;
  for (const r of sortedRs) {
    if (r < 0) {
      cur += 1;
      maxLoss = Math.max(maxLoss, cur);
    } else {
      cur = 0;
    }
  }
  let currentLossStreak = 0;
  for (let i = sortedRs.length - 1; i >= 0; i--) {
    if (sortedRs[i] < 0) currentLossStreak += 1;
    else break;
  }
  return { maxConsecutiveLosses: maxLoss, currentLossStreak };
}

function bucketBreakdown(
  rows: OutcomeRowForProof[],
  keyFn: (row: OutcomeRowForProof) => string,
): StrategyProofBreakdownRow[] {
  const map = new Map<string, number[]>();
  for (const row of rows) {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row.outcome_r);
  }
  return Array.from(map.entries())
    .map(([key, rs]) => ({
      key,
      count: rs.length,
      avgR: expectancy(rs),
      winRate: winRateFromRs(rs),
    }))
    .sort((a, b) => b.count - a.count);
}

function explodeSetupPerformance(rows: OutcomeRowForProof[]): StrategyProofBreakdownRow[] {
  const map = new Map<string, number[]>();
  for (const row of rows) {
    const tags =
      row.setup_types.length > 0
        ? row.setup_types.map((s) => String(s).trim()).filter(Boolean)
        : ["(no setup tagged)"];
    for (const tag of tags) {
      if (!map.has(tag)) map.set(tag, []);
      map.get(tag)!.push(row.outcome_r);
    }
  }
  return Array.from(map.entries())
    .map(([key, rs]) => ({
      key,
      count: rs.length,
      avgR: expectancy(rs),
      winRate: winRateFromRs(rs),
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Build PR 7 strategy proof metrics from attributed outcomes (+ trade context).
 */
export function buildStrategyProofReport(rows: OutcomeRowForProof[]): StrategyProofReport {
  const allR = rows.map((r) => r.outcome_r);
  const cleanRows = rows.filter((r) => !r.had_override);
  const overrideRows = rows.filter((r) => r.had_override);

  const sorted = sortedByClose(rows);
  const streaks = lossStreaks(sorted.map((r) => r.outcome_r));

  const overrideCostParts = rows
    .map((r) => r.override_r_cost)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const overrideCostTotalR = overrideCostParts.reduce((a, b) => a + b, 0);

  const deltaParts: number[] = [];
  for (const row of rows) {
    if (
      row.estimated_r_without_override != null
      && Number.isFinite(row.estimated_r_without_override)
      && Number.isFinite(row.outcome_r)
    ) {
      deltaParts.push(row.outcome_r - row.estimated_r_without_override);
    }
  }

  const maeVals = rows.map((r) => r.mae_r).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const mfeVals = rows.map((r) => r.mfe_r).filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const touched2 = rows.filter((r) => r.touched_2r).length;
  const targetCaptureEfficiency = rows.length > 0 ? touched2 / rows.length : null;

  const execKey = (row: OutcomeRowForProof) =>
    row.execution_classification?.trim() || "(not classified)";

  return {
    sampleSize: rows.length,
    statisticallySignificant: rows.length >= SAMPLE_MIN,
    winRateAll: winRateFromRs(allR),
    winRateClean: winRateFromRs(cleanRows.map((r) => r.outcome_r)),
    winRateOverride: winRateFromRs(overrideRows.map((r) => r.outcome_r)),
    expectancyAll: expectancy(allR),
    expectancyClean: expectancy(cleanRows.map((r) => r.outcome_r)),
    expectancyOverride: expectancy(overrideRows.map((r) => r.outcome_r)),
    profitFactor: profitFactor(allR),
    overrideRate: rows.length > 0 ? overrideRows.length / rows.length : null,
    overrideCostTotalR,
    overrideCostAvgR: overrideCostParts.length > 0 ? overrideCostTotalR / overrideCostParts.length : null,
    ruleFollowingDeltaAvgR: avg(deltaParts),
    setupPerformance: explodeSetupPerformance(rows),
    executionPerformance: bucketBreakdown(rows, execKey),
    directionPerformance: bucketBreakdown(rows, (r) => r.direction),
    maxConsecutiveLosses: streaks.maxConsecutiveLosses,
    currentLossStreak: streaks.currentLossStreak,
    avgMaeR: avg(maeVals),
    avgMfeR: avg(mfeVals),
    targetCaptureEfficiency,
  };
}

function breakdownFromRs(label: string, rs: number[]): DecisionQualityBreakdown {
  return {
    key: label,
    count: rs.length,
    avgR: expectancy(rs),
    winRate: winRateFromRs(rs),
  };
}

/** Cross-strategy execution / discipline rollup for GET /api/analytics/decisions. */
export function buildDecisionQualityReport(
  rows: Array<{
    strategy_id: string;
    strategy_name: string;
    outcome_r: number;
    had_override: boolean;
    override_r_cost: number | null;
    execution_classification: string | null;
  }>,
): DecisionQualityResponse {
  const byExecMap = new Map<string, number[]>();
  for (const row of rows) {
    const k = row.execution_classification?.trim() || "(not classified)";
    if (!byExecMap.has(k)) byExecMap.set(k, []);
    byExecMap.get(k)!.push(row.outcome_r);
  }
  const byExecution: DecisionQualityBreakdown[] = Array.from(byExecMap.entries())
    .map(([key, rs]) => breakdownFromRs(key, rs))
    .sort((a, b) => b.count - a.count);

  const stratMap = new Map<
    string,
    {
      name: string;
      rs: number[];
      overrides: number;
      overrideCostSum: number;
    }
  >();

  for (const row of rows) {
    if (!stratMap.has(row.strategy_id)) {
      stratMap.set(row.strategy_id, { name: row.strategy_name, rs: [], overrides: 0, overrideCostSum: 0 });
    }
    const bucket = stratMap.get(row.strategy_id)!;
    bucket.rs.push(row.outcome_r);
    if (row.had_override) bucket.overrides += 1;
    if (typeof row.override_r_cost === "number" && Number.isFinite(row.override_r_cost)) {
      bucket.overrideCostSum += row.override_r_cost;
    }
  }

  const byStrategy: DecisionQualityStrategyRow[] = Array.from(stratMap.entries()).map(([strategyId, v]) => ({
    strategyId,
    strategyName: v.name,
    sampleSize: v.rs.length,
    expectancyR: expectancy(v.rs),
    winRate: winRateFromRs(v.rs),
    overrideRate: v.rs.length > 0 ? v.overrides / v.rs.length : null,
    overrideCostTotalR: v.overrideCostSum,
  }));

  byStrategy.sort((a, b) => b.sampleSize - a.sampleSize);

  return {
    totals: {
      outcomes: rows.length,
      strategiesRepresented: stratMap.size,
    },
    byExecution,
    byStrategy,
  };
}

/** Median minutes from first_parameter_failure_at to trade close (PR 8 cache field; populated when data exists). */
export function parameterFailureLatencyP50Minutes(rows: OutcomeRowForProof[]): number | null {
  const minutes: number[] = [];
  for (const row of rows) {
    if (!row.first_parameter_failure_at || !row.closed_at) continue;
    const start = new Date(row.first_parameter_failure_at).getTime();
    const end = new Date(row.closed_at).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    minutes.push((end - start) / 60000);
  }
  if (minutes.length === 0) return null;
  const s = [...minutes].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return Math.round(s[mid]!);
  return Math.round(((s[mid - 1]! + s[mid]!) / 2) * 10) / 10;
}
