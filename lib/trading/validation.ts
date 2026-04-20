import type { ConvictionTier, DisciplineProfile, TradeThesis, TradeScores, Metric, TradeState } from "@/types/trade";

/* ---------- Gate state types ---------- */

export type GateState = "locked" | "active" | "complete";

export interface GatePermissions {
  identification: GateState;
  assessment: GateState;
  sizing: GateState;
  deployment: GateState;
}

/* ---------- Contradiction detection ---------- */

function hasValue(list: string[], value: string): boolean {
  return list.some((item) => item.toLowerCase() === value.toLowerCase());
}

export function detectContradictions(thesis: TradeThesis): string[] {
  const warnings: string[] = [];
  const setups = thesis.setupTypes ?? [];
  const conditions = thesis.conditions ?? [];
  const direction = thesis.direction;

  if (hasValue(setups, "Continuation") && hasValue(conditions, "At Resistance") && direction === "LONG") {
    warnings.push("Continuation + At Resistance conflicts with a LONG continuation thesis.");
  }

  if (hasValue(setups, "Reversal") && hasValue(conditions, "Overbought") && direction === "LONG") {
    warnings.push("Reversal + Overbought usually aligns with SHORT, not LONG.");
  }

  if (hasValue(setups, "Mean Reversion") && hasValue(conditions, "Squeeze")) {
    warnings.push("Mean Reversion + Squeeze can conflict because squeeze conditions often precede expansion.");
  }

  if (hasValue(setups, "Breakout") && hasValue(conditions, "Oversold") && direction === "SHORT") {
    warnings.push("Breakout + Oversold conflicts with a SHORT thesis.");
  }

  if (hasValue(setups, "Breakout") && hasValue(conditions, "At Resistance") && direction === "LONG") {
    warnings.push("Long Breakout thesis while Price is 'At Resistance' requires confirmed reclaim/expansion.");
  }

  if (hasValue(setups, "Mean Reversion") && hasValue(conditions, "Extended") && direction === "LONG") {
    warnings.push("Long Mean Reversion while 'Extended' (to the upside) is contradictory; usually targets the mean from above.");
  }

  if (hasValue(setups, "Breakdown") && hasValue(conditions, "Overbought") && direction === "LONG") {
    warnings.push("Breakdown + Overbought conflicts with a LONG thesis.");
  }

  return warnings;
}

/* ---------- Gate enforcement ---------- */

export interface GateResult {
  passed: boolean;
  /** "proceed" = deploy, "watchlist" = F pass / T fail, "blocked" = hard block */
  action: "proceed" | "watchlist" | "blocked";
  reason: string | null;
  /** Metrics that failed and are marked as hard rules */
  hardFailures: string[];
}

/**
 * Determine if a metric is a hard rule.
 * Explicit isHard flag takes priority; otherwise technical metrics default hard,
 * fundamental metrics default soft.
 */
function isHardRule(m: Metric): boolean {
  if (m.isHard !== undefined) return m.isHard;
  return m.type === "technical";
}

/**
 * Evaluate whether a trade passes the fundamental + technical gates.
 * Profile-aware behavior per TRD v2 §4.1:
 *   - Strict:   hard rule failure → blocked
 *   - Balanced: hard rule failure → watchlist (degraded warning)
 *   - Expert:   all failures → proceed (logged only)
 * Soft rules only affect score, never block regardless of profile.
 */
export function evaluateGates(
  scores: TradeScores,
  fundamentalMetrics: Metric[],
  technicalMetrics: Metric[],
  profile: DisciplineProfile = "balanced",
): GateResult {
  const allMetrics = [...fundamentalMetrics, ...technicalMetrics];
  const fTotal = fundamentalMetrics.length;
  const tTotal = technicalMetrics.length;
  const fMin = Math.max(1, Math.ceil(fTotal * 0.7));
  const tMin = tTotal;

  const fScore = fundamentalMetrics.reduce((sum, m) => sum + (scores[m.id] ?? 0), 0);
  const tScore = technicalMetrics.reduce((sum, m) => sum + (scores[m.id] ?? 0), 0);

  const fPass = fScore >= fMin;
  const tPass = tScore >= tMin;

  // Identify hard rule failures
  const hardFailures = allMetrics
    .filter((m) => isHardRule(m) && (scores[m.id] ?? 0) === 0)
    .map((m) => m.name);

  // All gates pass — no profile adjustment needed
  if (fPass && tPass && hardFailures.length === 0) {
    return { passed: true, action: "proceed", reason: null, hardFailures: [] };
  }

  // Expert mode: always proceed, failures are logged only
  if (profile === "expert") {
    const reasons: string[] = [];
    if (!fPass) reasons.push(`Fundamental ${fScore}/${fMin}`);
    if (!tPass) reasons.push(`Technical ${tScore}/${tMin}`);
    if (hardFailures.length > 0) reasons.push(`Hard rules: ${hardFailures.join(", ")}`);
    return {
      passed: true,
      action: "proceed",
      reason: reasons.length > 0 ? `Expert mode — logged: ${reasons.join("; ")}` : null,
      hardFailures,
    };
  }

  // Has hard rule failures — behavior depends on profile
  if (hardFailures.length > 0) {
    const reason = `Hard rule${hardFailures.length > 1 ? "s" : ""} failed: ${hardFailures.join(", ")}`;

    if (profile === "strict") {
      return {
        passed: false,
        action: "blocked",
        reason: `${reason}. Trade blocked in strict mode.`,
        hardFailures,
      };
    }

    // Balanced: hard failures degrade to watchlist (warning, not blocking)
    return {
      passed: false,
      action: "watchlist",
      reason: `${reason}. Degraded to warning in balanced mode.`,
      hardFailures,
    };
  }

  // No hard failures — use aggregate gate logic
  if (fPass && !tPass) {
    return {
      passed: false,
      action: "watchlist",
      reason: `Technical gate failed (${tScore}/${tMin} required). Trade routed to watchlist for re-evaluation.`,
      hardFailures: [],
    };
  }

  // Fundamental gate failed with no hard rule failures — profile determines action
  if (profile === "strict") {
    return {
      passed: false,
      action: "blocked",
      reason: `Fundamental gate failed (${fScore}/${fMin} required). Trade blocked in strict mode.`,
      hardFailures: [],
    };
  }

  return {
    passed: false,
    action: "watchlist",
    reason: `Fundamental gate failed (${fScore}/${fMin} required). Degraded to warning in balanced mode.`,
    hardFailures: [],
  };
}

/* ---------- Portfolio heat gate ---------- */

const MAX_PORTFOLIO_HEAT = 12; // 12% max exposure per mechanical system rules

export function validatePortfolioHeat(
  currentHeatPct: number,
  newTradeRiskPct: number,
): { allowed: boolean; reason: string | null } {
  const projectedHeat = currentHeatPct + newTradeRiskPct * 100;

  if (projectedHeat > MAX_PORTFOLIO_HEAT) {
    return {
      allowed: false,
      reason: `Portfolio heat would reach ${projectedHeat.toFixed(1)}% (max ${MAX_PORTFOLIO_HEAT}%). New trades blocked until existing risk is reduced.`,
    };
  }

  return { allowed: true, reason: null };
}

/* ---------- Conviction-sizing lock ---------- */

/**
 * Prevents manual reduction of position size below the conviction-computed tier.
 * Per non-negotiable rule #2: "the UI must not allow manual size reduction below the computed tier."
 */
export function validatePositionSize(
  requestedShares: number,
  computedShares: number,
  conviction: ConvictionTier,
): { valid: boolean; reason: string | null } {
  if (requestedShares < computedShares) {
    return {
      valid: false,
      reason: `${conviction.tier} conviction requires at least ${computedShares} shares. Cannot reduce below mechanical sizing.`,
    };
  }

  return { valid: true, reason: null };
}

/* ---------- Progressive gate permissions ---------- */

/**
 * Gate 1 — Identification (thesis definition).
 * Complete when: ticker, direction, at least 1 setup type, thesis text (>10 chars),
 * and invalidation are all provided.
 */
export function isIdentificationComplete(thesis: TradeThesis): boolean {
  return !!(
    thesis.ticker &&
    thesis.ticker.trim().length > 0 &&
    thesis.direction &&
    thesis.setupTypes &&
    thesis.setupTypes.length > 0 &&
    thesis.thesis &&
    thesis.thesis.trim().length > 10 &&
    thesis.invalidation &&
    thesis.invalidation.trim().length > 0
  );
}

/**
 * Gate 2 — Assessment (metric scoring).
 * Complete when: all enabled metrics have a score (0 or 1) recorded.
 */
export function isAssessmentComplete(
  scores: TradeScores,
  enabledMetrics: Metric[],
): boolean {
  if (enabledMetrics.length === 0) return false;
  return enabledMetrics.every((m) => scores[m.id] === 0 || scores[m.id] === 1);
}

/**
 * Gate 3 — Sizing (position calculation).
 * Complete when: entry price > 0, stop loss > 0, and they differ.
 */
export function isSizingComplete(
  entryPrice: number | null | undefined,
  stopLoss: number | null | undefined,
  direction: "LONG" | "SHORT" | null | undefined,
): boolean {
  if (!entryPrice || !stopLoss || !direction) return false;
  if (entryPrice <= 0 || stopLoss <= 0) return false;
  if (entryPrice === stopLoss) return false;
  if (direction === "LONG" && stopLoss >= entryPrice) return false;
  if (direction === "SHORT" && stopLoss <= entryPrice) return false;
  return true;
}

/**
 * Compute the full gate permission map for the trade wizard.
 * Each gate is: "locked" (previous incomplete), "active" (current),
 * or "complete" (requirements met, downstream unlocked).
 */
export function computeGatePermissions(
  thesis: TradeThesis,
  scores: TradeScores,
  enabledMetrics: Metric[],
  gateResult: GateResult | null,
  entryPrice: number | null | undefined,
  stopLoss: number | null | undefined,
): GatePermissions {
  const g1 = isIdentificationComplete(thesis);
  const g2 = isAssessmentComplete(scores, enabledMetrics);
  const g3 = isSizingComplete(entryPrice, stopLoss, thesis.direction);
  const gatesPassed = gateResult?.passed ?? false;

  return {
    identification: g1 ? "complete" : "active",
    assessment: !g1 ? "locked" : g2 ? "complete" : "active",
    sizing: !g1 || !g2 || !gatesPassed ? "locked" : g3 ? "complete" : "active",
    deployment: !g1 || !g2 || !gatesPassed || !g3 ? "locked" : "active",
  };
}

/* ---------- Trade state machine (TRD v2 §22.1) ---------- */

const VALID_TRANSITIONS: Record<TradeState, TradeState[]> = {
  initiated: ["evaluated"],
  evaluated: ["deployed", "blocked"],
  blocked: ["overridden"],
  deployed: ["closed"],
  overridden: ["closed"],
  closed: [],
};

export function canTransition(from: TradeState, to: TradeState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: TradeState, to: TradeState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid trade state transition: ${from} → ${to}`);
  }
}
