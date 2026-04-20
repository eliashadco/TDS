import { ConvictionTier, TradeAssessment } from './types';
import { CONVICTION_TIERS, MAX_PORTFOLIO_HEAT } from './constants';

export function getConviction(fundamentalScore: number, technicalScore: number): ConvictionTier {
  if (technicalScore < 3) return 'NONE';
  if (fundamentalScore === 5) return 'MAXIMUM';
  if (fundamentalScore === 4) return 'HIGH';
  if (fundamentalScore === 3) return 'STANDARD';
  return 'NONE';
}

export function calculatePosition(
  equity: number,
  baseRisk: number, // e.g. 0.02 for 2%
  conviction: ConvictionTier,
  entryPrice: number,
  stopLoss: number
) {
  const multipliers: Record<ConvictionTier, number> = {
    MAXIMUM: 2.0,  // 4% total
    HIGH: 1.5,     // 3% total
    STANDARD: 1.0, // 2% total
    NONE: 0,
  };

  const multiplier = multipliers[conviction] || 0;
  if (multiplier === 0) return 0;

  const riskAmount = equity * baseRisk * multiplier;
  const riskPerShare = Math.abs(entryPrice - stopLoss);

  if (riskPerShare === 0) return 0;

  return Math.floor(riskAmount / riskPerShare);
}

export function calculateTargets(entry: number, stop: number, direction: 'LONG' | 'SHORT') {
  const risk = Math.abs(entry - stop);
  if (direction === 'LONG') {
    return {
      t1: entry + risk * 2,
      t2: entry + risk * 4,
      t3: 'TRAILING'
    };
  } else {
    return {
      t1: entry - risk * 2,
      t2: entry - risk * 4,
      t3: 'TRAILING'
    };
  }
}

export function getPortfolioHeat(activeTrades: { riskAmount: number }[], equity: number) {
  const totalRisk = activeTrades.reduce((sum, t) => sum + t.riskAmount, 0);
  return totalRisk / equity;
}
