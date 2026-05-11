/** Wilson score interval (95%) and bootstrap expectancy CI (PR 8). */

/** 95% Wilson score interval for binomial proportion (win rate). */
export function wilsonWinRateInterval(successes: number, trials: number): { low: number; high: number } | null {
  if (trials <= 0) return null;
  const z = 1.96;
  const z2 = z * z;
  const p = successes / trials;
  const denom = 2 * (trials + z2);
  const center = (2 * trials * p + z2) / denom;
  const margin = (z / denom) * Math.sqrt(4 * trials * p * (1 - p) + z2);
  return {
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
  };
}

/** Deterministic PRNG (Mulberry32) for reproducible bootstrap given a seed. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(parts: string[]): number {
  let h = 2166136261;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) {
      h ^= p.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

/**
 * Bootstrap mean (expectancy) CI with `resamples` draws.
 * Uses seeded RNG so the same inputs yield stable bounds across requests.
 */
export function bootstrapExpectancyInterval(
  rs: number[],
  resamples: number,
  seedKey: string[],
): { low: number; high: number } | null {
  if (rs.length === 0) return null;
  const rng = mulberry32(hashSeed(seedKey));
  const n = rs.length;
  const means: number[] = [];
  for (let b = 0; b < resamples; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const j = Math.floor(rng() * n);
      sum += rs[j]!;
    }
    means.push(sum / n);
  }
  means.sort((a, b) => a - b);
  const loIdx = Math.floor(0.025 * (means.length - 1));
  const hiIdx = Math.ceil(0.975 * (means.length - 1));
  return {
    low: means[loIdx]!,
    high: means[hiIdx]!,
  };
}

export function confidenceNote(sampleSize: number, minSample: number): string {
  if (sampleSize <= 0) {
    return "No outcomes — confidence intervals are undefined.";
  }
  if (sampleSize < minSample) {
    return `Sample size ${sampleSize} is below the ${minSample}-trade architecture gate; intervals are wide and descriptive only — not predictive.`;
  }
  return "95% Wilson interval for win rate; 95% bootstrap (2,000 resamples, seeded) for mean R — retrospective diagnostics only, not forecasts.";
}
