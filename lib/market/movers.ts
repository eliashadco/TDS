import { getCached, setCache } from "@/lib/market/cache";
import { getQuote } from "@/lib/market/polygon";
import { sanitizeText, sanitizeTicker } from "@/lib/api/security";
import type { Mover } from "@/types/market";

const POLYGON_BASE = "https://api.polygon.io";
const API_KEY = process.env.POLYGON_API_KEY;

const PREMARKET_CACHE_MS = 2 * 60 * 1000;
const IMPORT_CACHE_MS = 60 * 1000;
const TICKER_NAME_CACHE_MS = 24 * 60 * 60 * 1000;
const MAX_IMPORT_TICKERS = 20;

const CURATED_FALLBACK_TICKERS = [
  "SPY",
  "QQQ",
  "IWM",
  "DIA",
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "META",
  "GOOGL",
  "TSLA",
  "AMD",
  "AVGO",
  "NFLX",
  "MU",
  "PLTR",
  "SOFI",
  "COIN",
  "MSTR",
  "SMCI",
  "JPM",
  "BAC",
  "XOM",
  "CVX",
  "INTC",
  "TQQQ",
  "SQQQ",
  "SHOP",
  "SNOW",
  "RIVN",
] as const;

const LOCAL_FALLBACK_UNIVERSE: readonly LocalFallbackSeed[] = [
  {
    ticker: "NVDA",
    name: "NVIDIA Corporation",
    summary: "AI leadership name with strong relative-strength follow-through. Use this as a starter idea until a live quote feed is connected.",
  },
  {
    ticker: "MSFT",
    name: "Microsoft Corporation",
    summary: "Large-cap quality trend candidate with cleaner downside support and a steadier volatility profile.",
  },
  {
    ticker: "META",
    name: "Meta Platforms, Inc.",
    summary: "Momentum-heavy platform name that often belongs in the first scan when communication services leadership is expanding.",
  },
  {
    ticker: "AMZN",
    name: "Amazon.com, Inc.",
    summary: "High-liquidity discretionary bellwether suited for low-friction earnings and retail catalyst review.",
  },
  {
    ticker: "AAPL",
    name: "Apple Inc.",
    summary: "Mega-cap quality proxy for market tone, useful when the goal is to compare leadership against a calmer benchmark name.",
  },
  {
    ticker: "AMD",
    name: "Advanced Micro Devices, Inc.",
    summary: "Semiconductor beta candidate for continuation and sympathy-flow setups.",
  },
  {
    ticker: "AVGO",
    name: "Broadcom Inc.",
    summary: "AI infrastructure leader that helps confirm whether semiconductor strength is broadening or narrowing.",
  },
  {
    ticker: "TSLA",
    name: "Tesla, Inc.",
    summary: "High-velocity discretionary name best treated as a catalyst-driven idea rather than a passive hold candidate.",
  },
  {
    ticker: "PLTR",
    name: "Palantir Technologies Inc.",
    summary: "Narrative-heavy momentum name that frequently enters high-conviction watchlists when software leadership improves.",
  },
  {
    ticker: "NFLX",
    name: "Netflix, Inc.",
    summary: "Communication-services momentum name that helps diversify the tape beyond semis and hyperscalers.",
  },
  {
    ticker: "SMCI",
    name: "Super Micro Computer, Inc.",
    summary: "Higher-volatility infrastructure proxy that belongs in a staged watchlist until volatility and entry quality are cleaner.",
  },
  {
    ticker: "COIN",
    name: "Coinbase Global, Inc.",
    summary: "Crypto-beta instrument that is best handled through explicit catalyst and risk filters before deployment.",
  },
  {
    ticker: "MSTR",
    name: "MicroStrategy Incorporated",
    summary: "High-beta treasury proxy with asymmetric upside and elevated execution risk. Keep it separated from lower-drag setups.",
  },
  {
    ticker: "QQQ",
    name: "Invesco QQQ Trust",
    summary: "Liquid tech index proxy used to anchor whether single-name leadership matches the broader growth tape.",
  },
  {
    ticker: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    summary: "Broad-market baseline that helps confirm whether individual setups are aligned with index context.",
  },
  {
    ticker: "IWM",
    name: "iShares Russell 2000 ETF",
    summary: "Small-cap participation gauge to compare risk appetite across the tape.",
  },
  {
    ticker: "SOFI",
    name: "SoFi Technologies, Inc.",
    summary: "Retail-heavy financials momentum candidate suitable for the custom watchlist when rate-sensitive leadership improves.",
  },
  {
    ticker: "SNOW",
    name: "Snowflake Inc.",
    summary: "Enterprise software name that benefits from a quality-growth tape and cleaner volume confirmation.",
  },
  {
    ticker: "SHOP",
    name: "Shopify Inc.",
    summary: "E-commerce momentum name best staged for review while trigger quality is still being validated.",
  },
  {
    ticker: "RIVN",
    name: "Rivian Automotive, Inc.",
    summary: "Event-driven EV name with wider outcome dispersion. Keep it in a watch lane until risk-reward is obvious.",
  },
] as const;

const IGNORED_IMPORT_TOKENS = new Set([
  "CHG",
  "HIGH",
  "LAST",
  "LOW",
  "NAME",
  "NASDAQ",
  "NYSE",
  "OPEN",
  "PCT",
  "PRICE",
  "SYM",
  "SYMBOL",
  "TIME",
  "VOL",
]);

type PolygonTopMoversResponse = {
  tickers?: PolygonSnapshot[];
};

export type PremarketFeedStatus = "live" | "fallback" | "empty";

export type PremarketFeedResult = {
  movers: Mover[];
  source: "polygon-top-movers" | "curated-fallback" | "local-fallback";
  status: PremarketFeedStatus;
  message: string;
};

type LocalFallbackSeed = {
  ticker: string;
  name: string;
  summary: string;
};

type PolygonFullSnapshotResponse = {
  tickers?: PolygonSnapshot[];
};

type PolygonTickerOverviewResponse = {
  results?: {
    name?: string;
  };
};

type PolygonSnapshot = {
  ticker?: string;
  todaysChangePerc?: number;
  updated?: number;
  lastTrade?: {
    p?: number;
  };
  day?: {
    c?: number;
    v?: number;
  };
  min?: {
    c?: number;
    av?: number;
    v?: number;
  };
  prevDay?: {
    c?: number;
    v?: number;
  };
};

function hasPolygonKey(): boolean {
  return Boolean(API_KEY);
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatVolume(volume: number): string {
  if (!Number.isFinite(volume) || volume <= 0) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(volume);
}

async function fetchPolygonJson<T>(path: string): Promise<T | null> {
  if (!API_KEY) {
    return null;
  }

  try {
    const response = await fetch(`${POLYGON_BASE}${path}${path.includes("?") ? "&" : "?"}apiKey=${API_KEY}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function derivePrice(snapshot: PolygonSnapshot): number {
  return asNumber(snapshot.lastTrade?.p) || asNumber(snapshot.day?.c) || asNumber(snapshot.min?.c) || asNumber(snapshot.prevDay?.c);
}

function deriveChange(snapshot: PolygonSnapshot): number {
  const price = derivePrice(snapshot);
  const previousClose = asNumber(snapshot.prevDay?.c);
  if (price > 0 && previousClose > 0) {
    return price - previousClose;
  }

  return 0;
}

function deriveChangePct(snapshot: PolygonSnapshot): number {
  if (typeof snapshot.todaysChangePerc === "number" && Number.isFinite(snapshot.todaysChangePerc)) {
    return snapshot.todaysChangePerc;
  }

  const price = derivePrice(snapshot);
  const previousClose = asNumber(snapshot.prevDay?.c);
  if (price > 0 && previousClose > 0) {
    return ((price - previousClose) / previousClose) * 100;
  }

  return 0;
}

function deriveVolume(snapshot: PolygonSnapshot): number {
  return asNumber(snapshot.day?.v) || asNumber(snapshot.min?.av) || asNumber(snapshot.min?.v) || asNumber(snapshot.prevDay?.v);
}

function calculateActivityScore(price: number, changePct: number, volumeValue: number): number {
  const dollarFlowScore = Math.log10(Math.max(price * volumeValue, 1));
  const volumeScore = Math.log10(Math.max(volumeValue, 1));
  const moveScore = Math.min(Math.abs(changePct), 20);
  const liquidityPenalty = price < 1 ? 0.58 : price < 5 ? 0.82 : 1;

  return Number((((dollarFlowScore * 1.35) + volumeScore + (moveScore * 0.7)) * liquidityPenalty).toFixed(3));
}

function rankMovers(movers: Mover[]): Mover[] {
  return [...movers].sort(
    (left, right) =>
      (right.activityScore ?? 0) - (left.activityScore ?? 0) ||
      right.volumeValue - left.volumeValue ||
      Math.abs(right.changePct) - Math.abs(left.changePct),
  );
}

async function getTickerName(ticker: string): Promise<string> {
  const cacheKey = `ticker-name:${ticker}`;
  const cached = getCached<string>(cacheKey);
  if (cached) {
    return cached;
  }

  const data = await fetchPolygonJson<PolygonTickerOverviewResponse>(`/v3/reference/tickers/${ticker}`);
  const name = sanitizeText(data?.results?.name ?? ticker, 120) || ticker;
  setCache(cacheKey, name, TICKER_NAME_CACHE_MS);
  return name;
}

async function mapSnapshotsToMovers(
  snapshots: PolygonSnapshot[],
  sourceLabel: string,
  buildReason: (snapshot: PolygonSnapshot, ticker: string, changePct: number, volume: number) => string,
): Promise<Mover[]> {
  const uniqueSnapshots = snapshots.filter((snapshot) => sanitizeTicker(snapshot.ticker));
  const names = await Promise.all(uniqueSnapshots.map((snapshot) => getTickerName(sanitizeTicker(snapshot.ticker))));

  return uniqueSnapshots.map((snapshot, index) => {
    const ticker = sanitizeTicker(snapshot.ticker);
    const price = derivePrice(snapshot);
    const change = deriveChange(snapshot);
    const changePct = deriveChangePct(snapshot);
    const volumeValue = deriveVolume(snapshot);

    return {
      ticker,
      name: names[index] ?? ticker,
      price,
      change,
      changePct,
      volume: formatVolume(volumeValue),
      volumeValue,
      reason: sanitizeText(buildReason(snapshot, ticker, changePct, volumeValue), 240),
      sourceLabel,
      activityScore: calculateActivityScore(price, changePct, volumeValue),
    } satisfies Mover;
  }).filter((mover) => mover.ticker && mover.price > 0);
}

function uniqueTickers(tickers: string[]): string[] {
  return Array.from(new Set(tickers.map((ticker) => sanitizeTicker(ticker)).filter(Boolean))).slice(0, MAX_IMPORT_TICKERS);
}

function getLocalFallbackSeed(ticker: string): LocalFallbackSeed | null {
  return LOCAL_FALLBACK_UNIVERSE.find((seed) => seed.ticker === ticker) ?? null;
}

function buildLocalFallbackMover(seed: LocalFallbackSeed, rank: number, sourceLabel: string, context: string): Mover {
  return {
    ticker: seed.ticker,
    name: seed.name,
    price: 0,
    change: 0,
    changePct: 0,
    volume: "-",
    volumeValue: 0,
    reason: sanitizeText(`${seed.summary} ${context}`, 240),
    sourceLabel,
    activityScore: LOCAL_FALLBACK_UNIVERSE.length - rank,
  } satisfies Mover;
}

function getLocalFallbackMovers(limit: number, sourceLabel: string, context: string, tickers?: readonly string[]): Mover[] {
  const requested = tickers ? uniqueTickers([...tickers]) : LOCAL_FALLBACK_UNIVERSE.map((seed) => seed.ticker);

  return requested
    .map((ticker, index) => {
      const seed = getLocalFallbackSeed(ticker);
      if (!seed) {
        return null;
      }

      return buildLocalFallbackMover(seed, index, sourceLabel, context);
    })
    .filter((mover): mover is Mover => Boolean(mover))
    .slice(0, limit);
}

export function extractTickersFromInput(rawInput: string): string[] {
  if (!rawInput.trim()) {
    return [];
  }

  const matches = rawInput.toUpperCase().match(/\b[A-Z]{1,5}(?:\.[A-Z])?\b/g) ?? [];
  return uniqueTickers(matches.filter((token) => !IGNORED_IMPORT_TOKENS.has(token)));
}

async function getCuratedFallbackMovers(limit: number): Promise<Mover[]> {
  const cacheKey = `premarket-fallback:${limit}`;
  const cached = getCached<Mover[]>(cacheKey);
  if (cached) {
    return cached;
  }

  if (!hasPolygonKey()) {
    const localFallback = getLocalFallbackMovers(
      limit,
      "Starter Universe",
      "Live movers are not configured in this environment, so MarketWatch is showing a built-in starter universe. Quote preview can still fall back to secondary data, but live ranked movers and richer watchlist enrichment still depend on Polygon.",
    );
    setCache(cacheKey, localFallback, PREMARKET_CACHE_MS);
    return localFallback;
  }

  const enriched = await enrichTickers(CURATED_FALLBACK_TICKERS.slice(0, Math.max(limit * 2, 12)));

  const ranked = enriched
    .map((mover) => ({
      ...mover,
      reason: sanitizeText(
        `${mover.ticker} is coming from the curated liquid-ticker fallback because the provider top movers feed is currently empty. Treat this as a ranked active watch universe, then verify the specific catalyst before scoring.`,
        240,
      ),
      sourceLabel: "Fallback Universe",
    }))
    .sort((left, right) => (right.activityScore ?? 0) - (left.activityScore ?? 0))
    .slice(0, limit);

  setCache(cacheKey, ranked, PREMARKET_CACHE_MS);
  return ranked;
}

export async function getPremarketFeed(limit = 16): Promise<PremarketFeedResult> {
  const normalizedLimit = Math.min(Math.max(limit, 4), 40);
  const cacheKey = `premarket-feed:${normalizedLimit}`;
  const cached = getCached<PremarketFeedResult>(cacheKey);
  if (cached) {
    return cached;
  }

  const liveMovers = await getPremarketMovers(normalizedLimit);
  if (liveMovers.length > 0) {
    const result: PremarketFeedResult = {
      movers: liveMovers,
      source: "polygon-top-movers",
      status: "live",
      message: "Using the provider-backed top movers snapshot.",
    };
    setCache(cacheKey, result, PREMARKET_CACHE_MS);
    return result;
  }

  const fallbackMovers = await getCuratedFallbackMovers(normalizedLimit);
  if (fallbackMovers.length > 0) {
    const result: PremarketFeedResult = {
      movers: fallbackMovers,
      source: hasPolygonKey() ? "curated-fallback" : "local-fallback",
      status: "fallback",
      message: hasPolygonKey()
        ? "The provider top movers feed is empty right now, so MarketWatch is showing a curated liquid-ticker fallback ranked by liquidity and active change."
        : "Polygon is not configured locally, so MarketWatch is showing a built-in starter universe instead of a blank table. Preview quotes can still fall back to the secondary quote provider.",
    };
    setCache(cacheKey, result, PREMARKET_CACHE_MS);
    return result;
  }

  const result: PremarketFeedResult = {
    movers: [],
    source: "polygon-top-movers",
    status: "empty",
    message: "No automatic movers are available from the provider or the fallback universe right now.",
  };
  setCache(cacheKey, result, PREMARKET_CACHE_MS);
  return result;
}

export async function getPremarketMovers(limit = 16): Promise<Mover[]> {
  const normalizedLimit = Math.min(Math.max(limit, 4), 40);
  const cacheKey = `premarket-movers:${normalizedLimit}`;
  const cached = getCached<Mover[]>(cacheKey);
  if (cached) {
    return cached;
  }

  if (!hasPolygonKey()) {
    return [];
  }

  const perSide = Math.max(2, Math.ceil(normalizedLimit / 2));
  const [gainersResponse, losersResponse] = await Promise.all([
    fetchPolygonJson<PolygonTopMoversResponse>("/v2/snapshot/locale/us/markets/stocks/gainers?include_otc=false"),
    fetchPolygonJson<PolygonTopMoversResponse>("/v2/snapshot/locale/us/markets/stocks/losers?include_otc=false"),
  ]);

  const [gainers, losers] = await Promise.all([
    mapSnapshotsToMovers(
      (gainersResponse?.tickers ?? []).slice(0, perSide),
      "Premarket Gainer",
      (_snapshot, ticker, changePct, volume) =>
        `${ticker} is coming from the API movers feed and is up ${Math.abs(changePct).toFixed(2)}% versus the previous close on ${formatVolume(volume)} of reported volume. Verify the catalyst before scoring.`,
    ),
    mapSnapshotsToMovers(
      (losersResponse?.tickers ?? []).slice(0, perSide),
      "Premarket Loser",
      (_snapshot, ticker, changePct, volume) =>
        `${ticker} is coming from the API movers feed and is down ${Math.abs(changePct).toFixed(2)}% versus the previous close on ${formatVolume(volume)} of reported volume. Verify the catalyst before scoring.`,
    ),
  ]);

  const merged = [...gainers, ...losers]
    .sort((left, right) => (right.activityScore ?? 0) - (left.activityScore ?? 0))
    .slice(0, normalizedLimit);

  setCache(cacheKey, merged, PREMARKET_CACHE_MS);
  return merged;
}

export async function enrichTickers(tickers: string[]): Promise<Mover[]> {
  const normalized = uniqueTickers(tickers);
  if (normalized.length === 0) {
    return [];
  }

  const cacheKey = `manual-enrich:${normalized.join(",")}`;
  const cached = getCached<Mover[]>(cacheKey);
  if (cached) {
    return cached;
  }

  if (!hasPolygonKey()) {
    const localFallback = rankMovers(
      getLocalFallbackMovers(
        normalized.length,
        "Imported List",
        "This symbol was resolved from the built-in starter universe because live movers are not configured locally. Quote preview and sizing can still fall back to the secondary quote provider.",
        normalized,
      ),
    );
    setCache(cacheKey, localFallback, IMPORT_CACHE_MS);
    return localFallback;
  }

  const snapshotResponse = await fetchPolygonJson<PolygonFullSnapshotResponse>(
    `/v2/snapshot/locale/us/markets/stocks/tickers?include_otc=false&tickers=${normalized.join(",")}`,
  );

  const snapshotsByTicker = new Map(
    (snapshotResponse?.tickers ?? [])
      .map((snapshot) => [sanitizeTicker(snapshot.ticker), snapshot] as const)
      .filter(([ticker]) => Boolean(ticker)),
  );

  const names = await Promise.all(normalized.map((ticker) => getTickerName(ticker)));
  const movers = await Promise.all(
    normalized.map(async (ticker, index) => {
      const snapshot = snapshotsByTicker.get(ticker);
      if (snapshot) {
        const volume = deriveVolume(snapshot);
        return {
          ticker,
          name: names[index] ?? ticker,
          price: derivePrice(snapshot),
          change: deriveChange(snapshot),
          changePct: deriveChangePct(snapshot),
          volume: formatVolume(volume),
          volumeValue: volume,
          reason: sanitizeText(
            `${ticker} was imported from a pasted ticker list. Price and change were enriched from the market data API. Verify the original MarketWatch catalyst and any news context before scoring.`,
            240,
          ),
          sourceLabel: "Imported List",
          activityScore: calculateActivityScore(derivePrice(snapshot), deriveChangePct(snapshot), volume),
        } satisfies Mover;
      }

      const quote = await getQuote(ticker);
      if (!quote) {
        return null;
      }

      return {
        ticker,
        name: names[index] ?? ticker,
        price: quote.price,
        change: quote.change,
        changePct: quote.changePct,
        volume: formatVolume(quote.volume),
        volumeValue: quote.volume,
        reason: sanitizeText(
          `${ticker} was imported from a pasted ticker list. This fallback quote came from the market data API. Verify the original MarketWatch catalyst and any news context before scoring.`,
          240,
        ),
        sourceLabel: "Imported List",
        activityScore: calculateActivityScore(quote.price, quote.changePct, quote.volume),
      } satisfies Mover;
    }),
  );

  const resolved = rankMovers(
    movers.filter((mover): mover is NonNullable<(typeof movers)[number]> => Boolean(mover && mover.ticker && mover.price > 0)),
  );
  setCache(cacheKey, resolved, IMPORT_CACHE_MS);
  return resolved;
}

export function polygonConfigured(): boolean {
  return hasPolygonKey();
}