export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function calculateATR(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) return 0;

  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  // Simple Moving Average of True Ranges
  const lastTRs = trueRanges.slice(-period);
  return lastTRs.reduce((sum, tr) => sum + tr, 0) / period;
}

export function calculateChandelierExit(
  high: number,
  low: number,
  atr: number,
  direction: 'LONG' | 'SHORT',
  multiplier: number = 3
): number {
  if (direction === 'LONG') {
    return high - (atr * multiplier);
  } else {
    return low + (atr * multiplier);
  }
}
