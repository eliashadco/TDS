import { NextRequest, NextResponse } from "next/server";
import { enrichTickers, extractTickersFromInput } from "@/lib/market/movers";
import { sanitizeTicker } from "@/lib/api/security";

type EnrichBody = {
  rawInput?: string;
  tickers?: string[];
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as EnrichBody;
  const parsedTickers = Array.isArray(body.tickers) && body.tickers.length > 0
    ? Array.from(new Set(body.tickers.map((ticker) => sanitizeTicker(ticker)).filter(Boolean))).slice(0, 20)
    : extractTickersFromInput(body.rawInput ?? "");

  if (parsedTickers.length === 0) {
    return NextResponse.json({ error: "No valid ticker symbols were found." }, { status: 400 });
  }

  const movers = await enrichTickers(parsedTickers);
  const unresolvedTickers = parsedTickers.filter((ticker) => !movers.some((mover) => mover.ticker === ticker));

  return NextResponse.json({
    movers,
    parsedTickers,
    unresolvedTickers,
  });
}