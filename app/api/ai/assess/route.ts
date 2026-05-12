import { NextResponse } from "next/server";

/** Legacy V3 scoring endpoint removed in V4. Returns 410 Gone. */
export async function POST() {
  return NextResponse.json(
    { error: { code: "GONE", message: "/api/ai/assess was removed in V4. Use /api/ai/extract-params for candidate parameter extraction." } },
    { status: 410 },
  );
}
