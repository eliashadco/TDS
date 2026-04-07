export type QuoteDataStatus = "live" | "delayed" | "cached" | "fallback";

export type QuoteProvider = "polygon" | "yahoo" | "cache" | "none";

export interface Quote {
  price: number;
  change: number;
  changePct: number;
  volume: number;
  timestamp: number;
  dataStatus?: QuoteDataStatus;
  provider?: QuoteProvider;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type CandleTimeframe = "hour" | "day" | "week";

export interface Mover {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: string;
  volumeValue: number;
  reason: string;
  sourceLabel?: string;
  activityScore?: number;
}