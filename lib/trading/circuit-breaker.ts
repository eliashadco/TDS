import type { DisciplineProfile } from "@/types/trade";

/* ---------- Circuit breaker types ---------- */

export interface CircuitBreakerConfig {
  maxConsecutiveLosses: number;
  maxDrawdownPercent: number;
}

export interface CircuitBreakerStatus {
  tripped: boolean;
  reason: string | null;
  consecutiveLosses: number;
  drawdownPercent: number;
  config: CircuitBreakerConfig;
}

/* ---------- Default thresholds by discipline profile ---------- */

const PROFILE_CONFIGS: Record<DisciplineProfile, CircuitBreakerConfig> = {
  strict: { maxConsecutiveLosses: 3, maxDrawdownPercent: 5 },
  balanced: { maxConsecutiveLosses: 5, maxDrawdownPercent: 8 },
  expert: { maxConsecutiveLosses: 8, maxDrawdownPercent: 12 },
};

export function getCircuitBreakerConfig(profile: DisciplineProfile): CircuitBreakerConfig {
  return PROFILE_CONFIGS[profile];
}

/* ---------- Consecutive loss counter ---------- */

/**
 * Count trailing consecutive losses from the most recent trades.
 * A "loss" is any closed trade with exit_price worse than entry_price.
 * Trades must be sorted newest-first.
 */
export function countConsecutiveLosses(
  trades: Array<{
    entry_price: number | null;
    exit_price: number | null;
    direction: "LONG" | "SHORT";
    state: string;
  }>,
): number {
  let streak = 0;

  for (const t of trades) {
    if (t.state !== "closed") continue;
    if (t.entry_price == null || t.exit_price == null) continue;

    const pnl =
      t.direction === "LONG"
        ? t.exit_price - t.entry_price
        : t.entry_price - t.exit_price;

    if (pnl < 0) {
      streak++;
    } else {
      break; // streak broken
    }
  }

  return streak;
}

/* ---------- Drawdown computation ---------- */

/**
 * Compute drawdown percent from peak equity.
 * drawdown = (peak - current) / peak * 100
 */
export function computeDrawdownPercent(peakEquity: number, currentEquity: number): number {
  if (peakEquity <= 0) return 0;
  return Math.max(0, ((peakEquity - currentEquity) / peakEquity) * 100);
}

/* ---------- Evaluate circuit breaker ---------- */

/**
 * TRD v2 §12: Evaluate whether the circuit breaker should trip.
 */
export function evaluateCircuitBreaker(
  consecutiveLosses: number,
  drawdownPercent: number,
  config: CircuitBreakerConfig,
): CircuitBreakerStatus {
  const lossTrip = consecutiveLosses >= config.maxConsecutiveLosses;
  const drawdownTrip = drawdownPercent >= config.maxDrawdownPercent;

  let reason: string | null = null;
  if (lossTrip && drawdownTrip) {
    reason = `${consecutiveLosses} consecutive losses and ${drawdownPercent.toFixed(1)}% drawdown`;
  } else if (lossTrip) {
    reason = `${consecutiveLosses} consecutive losses (limit: ${config.maxConsecutiveLosses})`;
  } else if (drawdownTrip) {
    reason = `${drawdownPercent.toFixed(1)}% drawdown (limit: ${config.maxDrawdownPercent}%)`;
  }

  return {
    tripped: lossTrip || drawdownTrip,
    reason,
    consecutiveLosses,
    drawdownPercent: Math.round(drawdownPercent * 100) / 100,
    config,
  };
}
