import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "@/lib/market/polygon";
import { getCached, getStaleCached, setCache } from "@/lib/market/cache";
import { sanitizeTicker } from "@/lib/api/security";
import type { Quote } from "@/types/market";

export async function GET(req: NextRequest) {
  const ticker = sanitizeTicker(req.nextUrl.searchParams.get("ticker"));
  if (!ticker) {
    return NextResponse.json({ error: "ticker required" }, { status: 400 });
  }

  const symbol = ticker;
  const cacheKey = `quote:${symbol}`;

  const cached = getCached<Quote>(cacheKey, true);
  if (cached) {
    return NextResponse.json({
      ...cached,
      dataStatus: "cached",
      provider: "cache",
    });
  }

  const quote = await getQuote(symbol);
  if (quote) {
    setCache(cacheKey, quote, 60_000);
    return NextResponse.json(quote);
  }

  const staleCached = getStaleCached<Quote>(cacheKey, 6 * 60 * 60 * 1000);
  if (staleCached) {
    return NextResponse.json({
      ...staleCached,
      dataStatus: "cached",
      provider: "cache",
    });
  }

  return NextResponse.json({ error: "unavailable" }, { status: 503 });
}