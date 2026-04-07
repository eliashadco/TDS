import { NextRequest, NextResponse } from "next/server";
import { getPremarketFeed } from "@/lib/market/movers";

export async function GET(req: NextRequest) {
  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? 16);
  const feed = await getPremarketFeed(Number.isFinite(limitParam) ? limitParam : 16);

  return NextResponse.json({
    ...feed,
    asOf: Date.now(),
  });
}