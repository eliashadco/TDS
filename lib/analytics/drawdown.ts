/** Equity curve and drawdown on cumulative outcome R (PR 8). */

export type DrawdownSummary = {
  maxDrawdownR: number;
  currentDrawdownR: number;
  /** Trades from prior equity peak through the deepest trough of that episode. */
  maxDrawdownDurationTrades: number;
  /** Net cumulative R divided by max drawdown magnitude; null if essentially no drawdown. */
  recoveryFactor: number | null;
  netCumulativeR: number;
  cumulativeCurve: Array<{ tradeIndex: number; cumulativeR: number }>;
  byStrategyVersion: Array<{ versionKey: string; maxDrawdownR: number; tradeCount: number }>;
};

export type ChronologicalOutcome = {
  outcomeR: number;
  closedAt: string | null;
  strategyVersionId: string | null;
};

function sortChronological(rows: ChronologicalOutcome[]): ChronologicalOutcome[] {
  return rows.slice().sort((a, b) => {
    const ta = a.closedAt ? new Date(a.closedAt).getTime() : 0;
    const tb = b.closedAt ? new Date(b.closedAt).getTime() : 0;
    return ta - tb;
  });
}

function maxDrawdownEpisode(cumulative: number[]): { maxDd: number; span: number } {
  if (cumulative.length === 0) return { maxDd: 0, span: 0 };
  let peak = cumulative[0]!;
  let peakIdx = 0;
  let maxDd = 0;
  let spanAtMax = 1;

  for (let i = 0; i < cumulative.length; i++) {
    const v = cumulative[i]!;
    if (v > peak) {
      peak = v;
      peakIdx = i;
    }
    const dd = peak - v;
    if (dd > maxDd + 1e-15) {
      maxDd = dd;
      spanAtMax = i - peakIdx + 1;
    }
  }

  return { maxDd, span: spanAtMax };
}

function currentDrawdown(cumulative: number[]): number {
  if (cumulative.length === 0) return 0;
  let peak = -Infinity;
  for (const v of cumulative) {
    peak = Math.max(peak, v);
  }
  const last = cumulative[cumulative.length - 1]!;
  return peak - last;
}

/** Build drawdown summary from closed-trade outcomes in chronological order. */
export function buildDrawdownSummary(rows: ChronologicalOutcome[]): DrawdownSummary {
  const sorted = sortChronological(rows);
  const rs = sorted.map((r) => r.outcomeR);
  const cumulative: number[] = [];
  let run = 0;
  for (const r of rs) {
    run += r;
    cumulative.push(run);
  }

  const curve = cumulative.map((cumulativeR, i) => ({ tradeIndex: i + 1, cumulativeR }));

  const { maxDd, span } = maxDrawdownEpisode(cumulative);
  const net = cumulative.length > 0 ? cumulative[cumulative.length - 1]! : 0;
  const recoveryFactor = maxDd > 1e-9 ? net / maxDd : null;

  const versionGroups = new Map<string, ChronologicalOutcome[]>();
  for (const row of sorted) {
    const key = row.strategyVersionId ?? "(no version)";
    if (!versionGroups.has(key)) versionGroups.set(key, []);
    versionGroups.get(key)!.push(row);
  }

  const byStrategyVersion: DrawdownSummary["byStrategyVersion"] = [];
  for (const [versionKey, group] of Array.from(versionGroups.entries())) {
    const rsV = group.map((g) => g.outcomeR);
    const cumV: number[] = [];
    let s = 0;
    for (const x of rsV) {
      s += x;
      cumV.push(s);
    }
    const dd = maxDrawdownEpisode(cumV).maxDd;
    byStrategyVersion.push({ versionKey, maxDrawdownR: dd, tradeCount: group.length });
  }
  byStrategyVersion.sort((a, b) => b.tradeCount - a.tradeCount);

  return {
    maxDrawdownR: maxDd,
    currentDrawdownR: currentDrawdown(cumulative),
    maxDrawdownDurationTrades: span,
    recoveryFactor,
    netCumulativeR: net,
    cumulativeCurve: curve.slice(-120),
    byStrategyVersion,
  };
}
