import { NextResponse } from "next/server";

/** Legacy V3 insight endpoint removed in V4. Returns 410 Gone. */
export async function POST() {
  return NextResponse.json(
    { error: { code: "GONE", message: "/api/ai/insight was removed in V4. Trade thesis context lives in draft_context on trade_drafts." } },
    { status: 410 },
  );
}
