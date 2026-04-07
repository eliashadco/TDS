import { NextRequest, NextResponse } from "next/server";
import { getPremarketFeed } from "@/lib/market/movers";

export async function POST(req: NextRequest) {
  void req;

  const feed = await getPremarketFeed(20);
  return NextResponse.json(feed.movers);
}