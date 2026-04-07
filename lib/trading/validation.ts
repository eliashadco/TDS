import type { ConvictionTier, TradeThesis, TradeScores, Metric } from "@/types/trade";

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
}

/**
 * Evaluate whether a trade passes the fundamental + technical gates.
 * This ENFORCES, not suggests — when gates fail the trade is blocked or
 * routed to the watchlist. The UI must not allow the user to dismiss this.
 */
export function evaluateGates(
  scores: TradeScores,
  fundamentalMetrics: Metric[],
  technicalMetrics: Metric[],
): GateResult {
  const fTotal = fundamentalMetrics.length;
  const tTotal = technicalMetrics.length;
  const fMin = Math.max(1, Math.ceil(fTotal * 0.7));
  const tMin = tTotal;

  const fScore = fundamentalMetrics.reduce((sum, m) => sum + (scores[m.id] ?? 0), 0);
  const tScore = technicalMetrics.reduce((sum, m) => sum + (scores[m.id] ?? 0), 0);

  const fPass = fScore >= fMin;
  const tPass = tScore >= tMin;

  if (fPass && tPass) {
    return { passed: true, action: "proceed", reason: null };
  }

  if (fPass && !tPass) {
    return {
      passed: false,
      action: "watchlist",
      reason: `Technical gate failed (${tScore}/${tMin} required). Trade routed to watchlist for re-evaluation.`,
    };
  }

  return {
    passed: false,
    action: "blocked",
    reason: `Fundamental gate failed (${fScore}/${fMin} required). Trade cannot proceed.`,
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
