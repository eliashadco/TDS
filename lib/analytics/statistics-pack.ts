import type { OutcomeRowForProof } from "@/lib/analytics/reports";
import { bootstrapExpectancyInterval, confidenceNote, wilsonWinRateInterval } from "@/lib/analytics/confidence";
import { buildDistributionSlice, median } from "@/lib/analytics/distribution";
import { buildDrawdownSummary, type ChronologicalOutcome } from "@/lib/analytics/drawdown";
import type {
  AdvancedStatisticsPack,
  DistributionSliceJson,
  EfficiencyBucketRow,
  ExcursionBucketRow,
} from "@/types/analytics";
import { STRATEGY_SAMPLE_MINIMUM } from "@/types/analytics";

const BOOTSTRAP_RESAMPLES = 2000;
const MS_DAY = 86400000;

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sliceJson(slice: ReturnType<typeof buildDistributionSlice>): DistributionSliceJson {
  return {
    count: slice.count,
    medianR: slice.medianR,
    stdDevR: slice.stdDevR,
    bands: slice.bands,
  };
}

function execLabel(row: OutcomeRowForProof): string {
  return row.execution_classification?.trim() || "(not classified)";
}

function setupTags(row: OutcomeRowForProof): string[] {
  if (row.setup_types.length === 0) return ["(no setup tagged)"];
  return row.setup_types.map((s) => String(s).trim()).filter(Boolean);
}

function collectExcursionBuckets(
  rows: OutcomeRowForProof[],
  keyFn: (row: OutcomeRowForProof) => string | string[],
): ExcursionBucketRow[] {
  const map = new Map<string, OutcomeRowForProof[]>();
  for (const row of rows) {
    const keys = keyFn(row);
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) {
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
  }

  return Array.from(map.entries())
    .map(([key, bucket]) => {
      const maes = bucket.map((r) => r.mae_r).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      const mfes = bucket.map((r) => r.mfe_r).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      return {
        key,
        count: bucket.length,
        avgMaeR: mean(maes),
        medianMaeR: median(maes),
        avgMfeR: mean(mfes),
        medianMfeR: median(mfes),
      };
    })
    .sort((a, b) => b.count - a.count);
}

function efficiencyRatios(rows: OutcomeRowForProof[]): number[] {
  const xs: number[] = [];
  for (const row of rows) {
    if (row.mfe_r != null && row.mfe_r > 1e-9 && Number.isFinite(row.outcome_r)) {
      xs.push(row.outcome_r / row.mfe_r);
    }
  }
  return xs;
}

function collectEfficiencyBuckets(
  rows: OutcomeRowForProof[],
  keyFn: (row: OutcomeRowForProof) => string | string[],
): EfficiencyBucketRow[] {
  const map = new Map<string, OutcomeRowForProof[]>();
  for (const row of rows) {
    const keys = keyFn(row);
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) {
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
  }

  return Array.from(map.entries())
    .map(([key, bucket]) => ({
      key,
      count: bucket.length,
      avgOutcomePerMfe: mean(efficiencyRatios(bucket)),
    }))
    .sort((a, b) => b.count - a.count);
}

function latencyDaysForRow(row: OutcomeRowForProof): number | null {
  if (!row.first_parameter_failure_at || !row.trade_created_at) return null;
  const t0 = new Date(row.trade_created_at).getTime();
  const t1 = new Date(row.first_parameter_failure_at).getTime();
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 < t0) return null;
  return (t1 - t0) / MS_DAY;
}

function latencyBySetup(rows: OutcomeRowForProof[]): Array<{ key: string; count: number; medianDaysToFailure: number | null }> {
  const map = new Map<string, number[]>();
  for (const row of rows) {
    const d = latencyDaysForRow(row);
    if (d == null) continue;
    const tags = setupTags(row);
    for (const tag of tags) {
      if (!map.has(tag)) map.set(tag, []);
      map.get(tag)!.push(d);
    }
  }
  return Array.from(map.entries())
    .map(([key, days]) => ({
      key,
      count: days.length,
      medianDaysToFailure: median(days),
    }))
    .sort((a, b) => b.count - a.count);
}

function failureLatencyDays(rows: OutcomeRowForProof[]): number[] {
  const out: number[] = [];
  for (const row of rows) {
    const d = latencyDaysForRow(row);
    if (d != null) out.push(d);
  }
  return out;
}

function latencyBuckets(rows: OutcomeRowForProof[]): Array<{ label: string; count: number }> {
  let sameDay = 0;
  let d1to3 = 0;
  let d4to10 = 0;
  let d10 = 0;
  let noFailureTs = 0;
  let missingEntry = 0;

  for (const row of rows) {
    if (!row.first_parameter_failure_at) {
      noFailureTs += 1;
      continue;
    }
    if (!row.trade_created_at) {
      missingEntry += 1;
      continue;
    }
    const t0 = new Date(row.trade_created_at).getTime();
    const t1 = new Date(row.first_parameter_failure_at).getTime();
    if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 < t0) {
      missingEntry += 1;
      continue;
    }
    const d = (t1 - t0) / MS_DAY;
    if (d < 1) sameDay += 1;
    else if (d <= 3) d1to3 += 1;
    else if (d <= 10) d4to10 += 1;
    else d10 += 1;
  }

  return [
    { label: "Same day (<1d)", count: sameDay },
    { label: "1–3d", count: d1to3 },
    { label: "4–10d", count: d4to10 },
    { label: ">10d", count: d10 },
    { label: "No failure timestamp", count: noFailureTs },
    { label: "Missing entry / invalid order", count: missingEntry },
  ];
}

export function buildAdvancedStatisticsPack(rows: OutcomeRowForProof[], strategyId: string): AdvancedStatisticsPack {
  const n = rows.length;
  const rs = rows.map((r) => r.outcome_r);
  const wins = rs.filter((r) => r > 0).length;

  const maes = rows.map((r) => r.mae_r).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const mfes = rows.map((r) => r.mfe_r).filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const cleanRs = rows.filter((r) => !r.had_override).map((r) => r.outcome_r);
  const overrideRs = rows.filter((r) => r.had_override).map((r) => r.outcome_r);

  const chronological: ChronologicalOutcome[] = rows.map((r) => ({
    outcomeR: r.outcome_r,
    closedAt: r.closed_at,
    strategyVersionId: r.strategy_version_id,
  }));

  const dd = buildDrawdownSummary(chronological);

  const winRate95 = n > 0 ? wilsonWinRateInterval(wins, n) : null;
  const expectancy95 =
    n > 0 ? bootstrapExpectancyInterval(rs, BOOTSTRAP_RESAMPLES, [strategyId, "expectancy-ci-v1"]) : null;

  const holdDays = rows
    .map((r) => r.holding_minutes)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0)
    .map((m) => m / (60 * 24));

  const holdAmong1r = rows
    .filter((r) => r.touched_1r)
    .map((r) => r.holding_minutes)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0)
    .map((m) => m / (60 * 24));

  const earlyExitRate = n > 0 ? rows.filter((r) => !r.touched_1r).length / n : null;

  const latDays = failureLatencyDays(rows);

  const allRatios = efficiencyRatios(rows);

  return {
    disclaimer:
      "Advanced statistics describe past closed trades only. They are not forecasts, signals, or guarantees of future performance.",
    retrospectiveNote:
      "All metrics below are computed from review-attributed strategy_outcomes joined to trade context.",
    maeMfe: {
      avgMaeR: mean(maes),
      medianMaeR: median(maes),
      avgMfeR: mean(mfes),
      medianMfeR: median(mfes),
      bySetup: collectExcursionBuckets(rows, (row) => setupTags(row)),
      byExecution: collectExcursionBuckets(rows, (row) => execLabel(row)),
    },
    distribution: {
      all: sliceJson(buildDistributionSlice(rs)),
      clean: sliceJson(buildDistributionSlice(cleanRs)),
      override: sliceJson(buildDistributionSlice(overrideRs)),
    },
    drawdown: {
      maxDrawdownR: dd.maxDrawdownR,
      currentDrawdownR: dd.currentDrawdownR,
      maxDrawdownDurationTrades: dd.maxDrawdownDurationTrades,
      recoveryFactor: dd.recoveryFactor,
      netCumulativeR: dd.netCumulativeR,
      cumulativeCurve: dd.cumulativeCurve,
      byStrategyVersion: dd.byStrategyVersion,
    },
    confidence: {
      winRate95,
      expectancy95,
      note: confidenceNote(n, STRATEGY_SAMPLE_MINIMUM),
    },
    holding: {
      avgHoldDays: mean(holdDays),
      medianHoldDays: median(holdDays),
      earlyExitRate,
      medianHoldDaysAmongTouched1R: median(holdAmong1r),
      proxyNote:
        "Granular time-to-target timestamps are not persisted; median hold among 1R-touched trades proxies timing behavior alongside early-exit rate (no 1R touch tagged).",
    },
    parameterLatency: {
      avgDaysToFailure: mean(latDays),
      medianDaysToFailure: median(latDays),
      buckets: latencyBuckets(rows),
      bySetup: latencyBySetup(rows),
      note: "Latency is measured from trade entry (created_at) to first_parameter_failure_at when both exist.",
    },
    targetCapture: {
      touchRate1R: n > 0 ? rows.filter((r) => r.touched_1r).length / n : null,
      touchRate2R: n > 0 ? rows.filter((r) => r.touched_2r).length / n : null,
      touchRate3R: n > 0 ? rows.filter((r) => r.touched_3r).length / n : null,
      avgRealizedPerMfe: mean(allRatios),
      byExecution: collectEfficiencyBuckets(rows, (row) => execLabel(row)),
      bySetup: collectEfficiencyBuckets(rows, (row) => setupTags(row)),
    },
  };
}
