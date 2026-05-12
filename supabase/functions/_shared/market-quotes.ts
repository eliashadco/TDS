const POLYGON_BASE = "https://api.polygon.io";

type PolygonDay = { o?: number; h?: number; l?: number; c?: number; v?: number };
type PolygonSnap = {
  ticker?: string;
  day?: PolygonDay;
  lastTrade?: { p?: number; t?: number };
  prevDay?: { c?: number };
};

type PolygonSnapResp = { tickers?: PolygonSnap[] };

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Last trade plus session range when Polygon day OHLC is present; Yahoo fallback. */
export type LiveQuoteOHLC = {
  last: number;
  high: number;
  low: number;
  source_label: "polygon" | "yahoo";
};

export async function fetchLiveQuoteOHLC(
  ticker: string,
  polygonApiKey: string | undefined,
): Promise<LiveQuoteOHLC | null> {
  const sym = ticker.trim().toUpperCase();
  if (!sym) return null;

  if (polygonApiKey) {
    try {
      const url =
        `${POLYGON_BASE}/v2/snapshot/locale/us/markets/stocks/tickers?include_otc=false&tickers=${encodeURIComponent(sym)}&apiKey=${encodeURIComponent(polygonApiKey)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as PolygonSnapResp;
        const snap = data.tickers?.[0];
        if (snap) {
          const last = num(snap.lastTrade?.p) || num(snap.day?.c) || num(snap.prevDay?.c);
          const hi = num(snap.day?.h) || last;
          const lo = num(snap.day?.l) || last;
          if (last > 0) {
            return {
              last,
              high: Math.max(hi, last),
              low: Math.min(lo > 0 ? lo : last, last),
              source_label: "polygon",
            };
          }
        }
      }
    } catch {
      // fall through to Yahoo
    }
  }

  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=5d&interval=1d`,
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number }; indicators?: { quote?: Array<{ high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[] }> } }> };
    };
    const first = payload.chart?.result?.[0];
    const meta = first?.meta;
    const q = first?.indicators?.quote?.[0];
    const closes = q?.close ?? [];
    let last = num(meta?.regularMarketPrice);
    if (last <= 0) {
      for (let i = closes.length - 1; i >= 0; i--) {
        const c = closes[i];
        if (typeof c === "number" && Number.isFinite(c) && c > 0) {
          last = c;
          break;
        }
      }
    }
    if (last <= 0) return null;

    let high = last;
    let low = last;
    const highs = q?.high ?? [];
    const lows = q?.low ?? [];
    for (let i = 0; i < highs.length; i++) {
      const h = highs[i];
      const l = lows[i];
      if (typeof h === "number" && Number.isFinite(h)) high = Math.max(high, h);
      if (typeof l === "number" && Number.isFinite(l)) low = Math.min(low, l);
    }

    return { last, high, low, source_label: "yahoo" };
  } catch {
    return null;
  }
}
