import type { Candle } from "@/types/market";

export type SmartStopInput = {
  direction: "LONG" | "SHORT";
  entryPrice?: number | null;
  quotePrice?: number | null;
  candles?: Candle[];
  atrMultiplier?: number;
};

export type SmartStopResult = {
  suggestedStop: number | null;
  atr: number | null;
  referencePrice: number | null;
  rationale: string;
};

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeAtr(candles: Candle[], period = 14): number | null {
  if (!Array.isArray(candles) || candles.length < 2) {
    return null;
  }

  const rows = candles
    .filter((candle) => Number.isFinite(candle.high) && Number.isFinite(candle.low) && Number.isFinite(candle.close))
    .slice(-Math.max(period + 1, 20));

  if (rows.length < 2) {
    return null;
  }

  const trueRanges: number[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const current = rows[i];
    const prev = rows[i - 1];
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close),
    );
    if (Number.isFinite(tr) && tr > 0) {
      trueRanges.push(tr);
    }
  }

  if (trueRanges.length === 0) {
    return null;
  }

  const tail = trueRanges.slice(-Math.min(period, trueRanges.length));
  const atr = tail.reduce((sum, value) => sum + value, 0) / tail.length;
  return Number.isFinite(atr) && atr > 0 ? atr : null;
}

export function computeSmartStop(input: SmartStopInput): SmartStopResult {
  const referencePrice =
    typeof input.entryPrice === "number" && Number.isFinite(input.entryPrice) && input.entryPrice > 0
      ? input.entryPrice
      : typeof input.quotePrice === "number" && Number.isFinite(input.quotePrice) && input.quotePrice > 0
        ? input.quotePrice
        : null;

  if (!referencePrice) {
    return {
      suggestedStop: null,
      atr: null,
      referencePrice: null,
      rationale: "No valid reference price available for stop computation.",
    };
  }

  const atr = computeAtr(input.candles ?? []);
  const multiplier = typeof input.atrMultiplier === "number" && input.atrMultiplier > 0 ? input.atrMultiplier : 1.2;

  // Fallback to 2.5% of price when ATR cannot be computed from candles.
  const stopDistance = atr ? atr * multiplier : referencePrice * 0.025;
  if (!Number.isFinite(stopDistance) || stopDistance <= 0) {
    return {
      suggestedStop: null,
      atr,
      referencePrice,
      rationale: "Unable to compute a stable stop distance.",
    };
  }

  const rawStop =
    input.direction === "LONG" ? referencePrice - stopDistance : referencePrice + stopDistance;

  let suggestedStop = roundPrice(rawStop);

  // Preserve directional validity in edge rounding cases.
  if (input.direction === "LONG" && suggestedStop >= referencePrice) {
    suggestedStop = roundPrice(referencePrice - Math.max(stopDistance * 0.8, 0.01));
  }
  if (input.direction === "SHORT" && suggestedStop <= referencePrice) {
    suggestedStop = roundPrice(referencePrice + Math.max(stopDistance * 0.8, 0.01));
  }

  if (suggestedStop <= 0) {
    return {
      suggestedStop: null,
      atr,
      referencePrice,
      rationale: "Computed stop was non-positive and rejected.",
    };
  }

  const rationale = atr
    ? `ATR-informed stop at ${multiplier.toFixed(1)}x ATR (${atr.toFixed(2)}) from reference price ${referencePrice.toFixed(2)}.`
    : `Fallback volatility stop at 2.5% from reference price ${referencePrice.toFixed(2)} (ATR unavailable).`;

  return {
    suggestedStop,
    atr,
    referencePrice,
    rationale,
  };
}
