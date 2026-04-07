import type { Candle, CandleTimeframe, Quote } from "@/types/market";

type YahooQuoteRow = {
  symbol?: string;
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  regularMarketOpen?: number;
  regularMarketVolume?: number;
  regularMarketTime?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  exchangeDataDelayedBy?: number;
};

type YahooQuoteResponse = {
  quoteResponse?: {
    result?: YahooQuoteRow[];
  };
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketTime?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function quoteFromYahooRow(row: YahooQuoteRow): Quote | null {
  const marketPrice = toNumber(row.regularMarketPrice);
  const previousClose = toNumber(row.regularMarketPreviousClose) || toNumber(row.regularMarketOpen);
  const hasLiveLikePrice = marketPrice > 0;
  const basePrice = hasLiveLikePrice ? marketPrice : previousClose;

  if (basePrice <= 0) {
    return null;
  }

  const change = hasLiveLikePrice
    ? (toNumber(row.regularMarketChange) || (previousClose > 0 ? marketPrice - previousClose : 0))
    : 0;
  const changePct = hasLiveLikePrice
    ? (toNumber(row.regularMarketChangePercent) || (previousClose > 0 ? ((marketPrice - previousClose) / previousClose) * 100 : 0))
    : 0;

  const delayedBy = toNumber(row.exchangeDataDelayedBy);

  return {
    price: basePrice,
    change,
    changePct,
    volume: toNumber(row.regularMarketVolume),
    timestamp: toNumber(row.regularMarketTime) > 0 ? toNumber(row.regularMarketTime) * 1000 : Date.now(),
    dataStatus: !hasLiveLikePrice ? "fallback" : delayedBy > 0 ? "delayed" : "live",
    provider: "yahoo",
  };
}

function getLastFinite(values: Array<number | null> | undefined): number {
  if (!values || values.length === 0) {
    return 0;
  }

  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
}

async function getYahooQuoteFromChart(ticker: string): Promise<Quote | null> {
  try {
    const normalized = ticker.trim().toUpperCase();
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalized)}?range=5d&interval=1d`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as YahooChartResponse;
    const first = payload.chart?.result?.[0];
    const meta = first?.meta;
    const quote = first?.indicators?.quote?.[0];

    const closes = quote?.close;
    const volumes = quote?.volume;
    const timestamps = first?.timestamp;

    const price = toNumber(meta?.regularMarketPrice) || getLastFinite(closes);
    const previousClose = toNumber(meta?.chartPreviousClose) || toNumber(meta?.previousClose);
    const change = price > 0 && previousClose > 0 ? price - previousClose : 0;
    const changePct = price > 0 && previousClose > 0 ? (change / previousClose) * 100 : 0;
    const volume = getLastFinite(volumes);
    const timestamp = toNumber(meta?.regularMarketTime) > 0
      ? toNumber(meta?.regularMarketTime) * 1000
      : Array.isArray(timestamps) && timestamps.length > 0
        ? toNumber(timestamps[timestamps.length - 1]) * 1000
        : Date.now();

    if (price <= 0) {
      return null;
    }

    return {
      price,
      change,
      changePct,
      volume,
      timestamp,
      dataStatus: "fallback",
      provider: "yahoo",
    };
  } catch {
    return null;
  }
}

export async function getYahooQuotes(tickers: string[]): Promise<Record<string, Quote>> {
  try {
    const normalized = Array.from(new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean)));
    if (normalized.length === 0) {
      return {};
    }

    const result: Record<string, Quote> = {};

    try {
      const response = await fetch(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(normalized.join(","))}`,
        { cache: "no-store" },
      );

      if (response.ok) {
        const payload = (await response.json()) as YahooQuoteResponse;
        const rows = payload.quoteResponse?.result ?? [];

        for (const row of rows) {
          const symbol = typeof row.symbol === "string" ? row.symbol.toUpperCase() : "";
          if (!symbol) {
            continue;
          }

          const quote = quoteFromYahooRow(row);
          if (quote) {
            result[symbol] = quote;
          }
        }
      }
    } catch {
      // Fall back to chart-derived snapshots below.
    }

    const unresolved = normalized.filter((ticker) => !result[ticker]);
    if (unresolved.length > 0) {
      const chartQuotes = await Promise.all(
        unresolved.map(async (ticker) => ({
          ticker,
          quote: await getYahooQuoteFromChart(ticker),
        })),
      );

      for (const row of chartQuotes) {
        if (row.quote) {
          result[row.ticker] = row.quote;
        }
      }
    }

    return result;
  } catch {
    return {};
  }
}

export async function getYahooQuote(ticker: string): Promise<Quote | null> {
  const quotes = await getYahooQuotes([ticker]);
  const normalized = ticker.trim().toUpperCase();
  return quotes[normalized] ?? null;
}

export async function getYahooCandles(
  ticker: string,
  from: string,
  to: string,
  timeframe: CandleTimeframe = "day",
): Promise<Candle[]> {
  try {
    const periodStart = Math.floor(new Date(`${from}T00:00:00Z`).getTime() / 1000);
    const periodEnd = Math.floor(new Date(`${to}T23:59:59Z`).getTime() / 1000);

    if (!Number.isFinite(periodStart) || !Number.isFinite(periodEnd) || periodStart <= 0 || periodEnd <= 0) {
      return [];
    }

    const interval = timeframe === "week" ? "1wk" : timeframe === "hour" ? "1h" : "1d";

    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        ticker.trim().toUpperCase(),
      )}?period1=${periodStart}&period2=${periodEnd}&interval=${interval}&events=history&includeAdjustedClose=true`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as YahooChartResponse;
    const first = payload.chart?.result?.[0];
    const quote = first?.indicators?.quote?.[0];
    const timestamps = first?.timestamp ?? [];

    if (!quote || timestamps.length === 0) {
      return [];
    }

    const opens = quote.open ?? [];
    const highs = quote.high ?? [];
    const lows = quote.low ?? [];
    const closes = quote.close ?? [];
    const volumes = quote.volume ?? [];

    const candles: Candle[] = [];

    for (let index = 0; index < timestamps.length; index += 1) {
      const time = timestamps[index];
      const open = opens[index];
      const high = highs[index];
      const low = lows[index];
      const close = closes[index];
      const volume = volumes[index];

      if (
        typeof time !== "number" ||
        !Number.isFinite(time) ||
        typeof open !== "number" ||
        typeof high !== "number" ||
        typeof low !== "number" ||
        typeof close !== "number"
      ) {
        continue;
      }

      candles.push({
        time,
        open,
        high,
        low,
        close,
        volume: typeof volume === "number" && Number.isFinite(volume) ? volume : 0,
      });
    }

    return candles;
  } catch {
    return [];
  }
}
