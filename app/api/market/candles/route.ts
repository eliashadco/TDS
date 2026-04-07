import { NextRequest, NextResponse } from "next/server";
import { getCandles } from "@/lib/market/polygon";
import { getCached, setCache } from "@/lib/market/cache";
import { sanitizeTicker } from "@/lib/api/security";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const ticker = sanitizeTicker(req.nextUrl.searchParams.get("ticker"));
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const timeframeParam = req.nextUrl.searchParams.get("timeframe");
  const timeframe = timeframeParam === "week" ? "week" : timeframeParam === "hour" ? "hour" : "day";

  if (!ticker || !from || !to) {
    return NextResponse.json({ error: "ticker, from, and to are required" }, { status: 400 });
  }

  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
    return NextResponse.json({ error: "from and to must use YYYY-MM-DD format" }, { status: 400 });
  }

  if (new Date(from) >= new Date(to)) {
    return NextResponse.json({ error: "from must be earlier than to" }, { status: 400 });
  }

  const symbol = ticker;
  const cacheKey = `candles:${symbol}:${from}:${to}:${timeframe}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const candles = await getCandles(symbol, from, to, timeframe);
  if (candles.length > 0) {
    setCache(cacheKey, candles, 5 * 60 * 1000);
  }

  return NextResponse.json(candles);
}