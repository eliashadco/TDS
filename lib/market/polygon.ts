import type { Candle, CandleTimeframe, Quote } from "@/types/market";
import { getYahooCandles, getYahooQuotes } from "@/lib/market/yahoo";

const POLYGON_BASE = "https://api.polygon.io";
const API_KEY = process.env.POLYGON_API_KEY;

type PolygonSnapshot = {
  ticker?: string;
  updated?: number;
  lastTrade?: {
    p?: number;
    t?: number;
  };
  day?: {
    c?: number;
    v?: number;
  };
  prevDay?: {
    c?: number;
    o?: number;
    v?: number;
  };
};

type PolygonSnapshotResponse = {
  tickers?: PolygonSnapshot[];
};

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function quoteFromSnapshot(snapshot: PolygonSnapshot): Quote | null {
  const price = toNumber(snapshot.lastTrade?.p) || toNumber(snapshot.day?.c) || toNumber(snapshot.prevDay?.c);
  const previousClose = toNumber(snapshot.prevDay?.c);
  const previousOpen = toNumber(snapshot.prevDay?.o);
  const comparisonBase = previousClose || previousOpen;
  const change = price > 0 && comparisonBase > 0 ? price - comparisonBase : 0;
  const changePct = price > 0 && comparisonBase > 0 ? (change / comparisonBase) * 100 : 0;
  const volume = toNumber(snapshot.day?.v) || toNumber(snapshot.prevDay?.v);
  const timestamp = toNumber(snapshot.lastTrade?.t) || toNumber(snapshot.updated) || Date.now();

  if (price <= 0) {
    return null;
  }

  return {
    price,
    change,
    changePct,
    volume,
    timestamp,
    dataStatus: "live",
    provider: "polygon",
  };
}

async function getPreviousDayQuote(ticker: string): Promise<Quote | null> {
  const response = await fetch(
    `${POLYGON_BASE}/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${API_KEY}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    results?: Array<{ c: number; o: number; v: number; t: number }>;
  };

  if (!data.results?.[0]) {
    return null;
  }

  const result = data.results[0];
  return {
    price: result.c,
    change: result.c - result.o,
    changePct: ((result.c - result.o) / result.o) * 100,
    volume: result.v,
    timestamp: result.t,
    dataStatus: "fallback",
    provider: "polygon",
  };
}

export async function getQuote(ticker: string): Promise<Quote | null> {
  try {
    const quotes = await getQuotes([ticker]);
    return quotes[ticker.trim().toUpperCase()] ?? null;
  } catch {
    return null;
  }
}

export async function getQuotes(tickers: string[]): Promise<Record<string, Quote>> {
  try {
    const normalized = Array.from(new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean)));
    if (normalized.length === 0) {
      return {};
    }

    const result: Record<string, Quote> = {};

    if (API_KEY) {
      const response = await fetch(
        `${POLYGON_BASE}/v2/snapshot/locale/us/markets/stocks/tickers?include_otc=false&tickers=${normalized.join(",")}&apiKey=${API_KEY}`,
        { cache: "no-store" },
      );

      if (response.ok) {
        const data = (await response.json()) as PolygonSnapshotResponse;
        for (const snapshot of data.tickers ?? []) {
          const symbol = typeof snapshot.ticker === "string" ? snapshot.ticker.toUpperCase() : "";
          if (!symbol) {
            continue;
          }

          const quote = quoteFromSnapshot(snapshot);
          if (quote) {
            result[symbol] = quote;
          }
        }
      }
    }

    const unresolved = normalized.filter((ticker) => !result[ticker]);

    if (unresolved.length > 0 && API_KEY) {
      const previousDayFallbacks = await Promise.all(
        unresolved.map(async (ticker) => ({
          ticker,
          quote: await getPreviousDayQuote(ticker),
        })),
      );

      for (const fallback of previousDayFallbacks) {
        if (fallback.quote) {
          result[fallback.ticker] = fallback.quote;
        }
      }
    }

    const stillMissing = normalized.filter((ticker) => !result[ticker]);
    if (stillMissing.length > 0) {
      const yahooQuotes = await getYahooQuotes(stillMissing);
      for (const ticker of stillMissing) {
        const yahooQuote = yahooQuotes[ticker];
        if (yahooQuote) {
          result[ticker] = yahooQuote;
        }
      }
    }

    return result;
  } catch {
    return {};
  }
}

export async function getCandles(
  ticker: string,
  from: string,
  to: string,
  timeframe: CandleTimeframe = "day",
): Promise<Candle[]> {
  try {
    if (API_KEY) {
      const multiplier = 1;
      const span = timeframe === "week" ? "week" : timeframe === "hour" ? "hour" : "day";

      const response = await fetch(
        `${POLYGON_BASE}/v2/aggs/ticker/${ticker}/range/${multiplier}/${span}/${from}/${to}?adjusted=true&sort=asc&apiKey=${API_KEY}`,
        { cache: "no-store" },
      );

      if (response.ok) {
        const data = (await response.json()) as {
          results?: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>;
        };

        const candles = (data.results || []).map((result) => ({
          time: Math.floor(result.t / 1000),
          open: result.o,
          high: result.h,
          low: result.l,
          close: result.c,
          volume: result.v,
        }));

        if (candles.length > 0) {
          return candles;
        }
      }
    }

    return getYahooCandles(ticker, from, to, timeframe);
  } catch {
    return getYahooCandles(ticker, from, to, timeframe);
  }
}