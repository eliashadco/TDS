/** Distribution helpers for outcome R and excursion series (PR 8). */

export type PercentileBands = {
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
};

export type DistributionSlice = {
  count: number;
  medianR: number | null;
  stdDevR: number | null;
  bands: PercentileBands;
};

function sortNums(values: number[]): number[] {
  return values.slice().sort((a, b) => a - b);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = sortNums(values);
  const m = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[m]!;
  return (s[m - 1]! + s[m]!) / 2;
}

/** Linear interpolation percentile on sorted array, p in [0,100]. */
export function percentileSorted(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0]!;
  const clamped = Math.min(100, Math.max(0, p));
  const idx = (clamped / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  return percentileSorted(sortNums(values), p);
}

export function standardDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

export function percentileBands(values: number[]): PercentileBands {
  if (values.length === 0) {
    return { p10: null, p25: null, p50: null, p75: null, p90: null };
  }
  const s = sortNums(values);
  return {
    p10: percentileSorted(s, 10),
    p25: percentileSorted(s, 25),
    p50: percentileSorted(s, 50),
    p75: percentileSorted(s, 75),
    p90: percentileSorted(s, 90),
  };
}

export function buildDistributionSlice(rs: number[]): DistributionSlice {
  if (rs.length === 0) {
    return { count: 0, medianR: null, stdDevR: null, bands: percentileBands(rs) };
  }
  return {
    count: rs.length,
    medianR: median(rs),
    stdDevR: standardDeviation(rs),
    bands: percentileBands(rs),
  };
}
