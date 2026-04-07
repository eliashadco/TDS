import type { CandleTimeframe } from "@/types/market";
import type { TradeMode } from "@/types/trade";

export function getDefaultCandleTimeframe(mode: TradeMode): CandleTimeframe {
  if (mode === "investment") {
    return "week";
  }
  if (mode === "swing") {
    return "day";
  }
  return "hour";
}

export function getCandleRange(mode: TradeMode, timeframe: CandleTimeframe): { from: string; to: string; timeframe: CandleTimeframe } {
  const now = new Date();
  const from = new Date(now);

  if (timeframe === "hour") {
    if (mode === "investment") {
      from.setMonth(now.getMonth() - 6);
    } else if (mode === "swing") {
      from.setMonth(now.getMonth() - 3);
    } else if (mode === "daytrade") {
      from.setDate(now.getDate() - 30);
    } else {
      from.setDate(now.getDate() - 14);
    }
  } else if (timeframe === "day") {
    if (mode === "investment") {
      from.setFullYear(now.getFullYear() - 5);
    } else if (mode === "swing") {
      from.setMonth(now.getMonth() - 18);
    } else if (mode === "daytrade") {
      from.setMonth(now.getMonth() - 4);
    } else {
      from.setDate(now.getDate() - 45);
    }
  } else {
    if (mode === "investment") {
      from.setFullYear(now.getFullYear() - 10);
    } else if (mode === "swing") {
      from.setFullYear(now.getFullYear() - 5);
    } else if (mode === "daytrade") {
      from.setFullYear(now.getFullYear() - 1);
    } else {
      from.setMonth(now.getMonth() - 6);
    }
  }

  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
    timeframe,
  };
}