import type { ConvictionTier, Position, Trade } from "@/types/trade";

export function getConviction(
  fScore: number,
  fTotal: number,
  tScore: number,
  tTotal: number,
): ConvictionTier | null {
  if (fTotal < 0 || tTotal < 0) {
    return null;
  }

  const fMin = Math.max(1, Math.ceil(fTotal * 0.7));
  const tMin = tTotal;

  if (fScore < fMin || tScore < tMin) {
    return null;
  }

  const total = fTotal + tTotal;
  if (total <= 0) {
    return null;
  }

  const pct = (fScore + tScore) / total;

  if (pct >= 0.9) {
    return { tier: "MAX", risk: 0.04, color: "#dc2626" };
  }
  if (pct >= 0.75) {
    return { tier: "HIGH", risk: 0.03, color: "#d97706" };
  }
  return { tier: "STD", risk: 0.02, color: "#059669" };
}

export function calculatePosition(
  equity: number,
  conviction: ConvictionTier,
  entryPrice: number,
  stopLoss: number,
  direction: "LONG" | "SHORT",
): Position | null {
  const rPerShare = Math.abs(entryPrice - stopLoss);
  if (!Number.isFinite(equity) || !Number.isFinite(entryPrice) || !Number.isFinite(stopLoss) || rPerShare <= 0) {
    return null;
  }

  const risk = equity * conviction.risk;
  if (risk <= 0) {
    return null;
  }

  const shares = Math.floor(risk / rPerShare);
  if (shares <= 0) {
    return null;
  }

  const tranche1 = Math.round(shares * 0.6);
  const tranche2 = Math.round(shares * 0.4);
  const sign = direction === "LONG" ? 1 : -1;

  return {
    shares,
    value: shares * entryPrice,
    risk,
    rPerShare,
    tranche1,
    tranche2,
    r2Target: entryPrice + sign * (2 * rPerShare),
    r4Target: entryPrice + sign * (4 * rPerShare),
  };
}

export function getPortfolioHeat(trades: Trade[]): number {
  const totalRiskPct = trades
    .filter((trade) => Boolean(trade.confirmed) && !Boolean(trade.closed))
    .reduce((sum, trade) => sum + (trade.risk_pct ?? 0), 0);

  return totalRiskPct * 100;
}