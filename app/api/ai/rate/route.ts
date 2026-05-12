import { NextResponse } from "next/server";

/** Legacy V3 rating endpoint removed in V4. Returns 410 Gone. */
export async function POST() {
  return NextResponse.json(
    { error: { code: "GONE", message: "/api/ai/rate was removed in V4. Strategy outcomes are recorded via POST /api/trades/[id]/review." } },
    { status: 410 },
  );
}
