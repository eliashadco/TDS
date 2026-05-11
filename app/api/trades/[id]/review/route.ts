import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { submitStructuredReview, TradeReviewError } from "@/lib/trading/review";

const ReviewBodySchema = z.object({
  executionAdherence: z.enum(["clean", "minor_deviation", "major_deviation"]),
  deviationTag: z.string().max(2000).optional(),
  overridePresent: z.boolean(),
  overrideRCost: z.number().finite().optional(),
  ruleBasedExitEstimate: z.record(z.string(), z.unknown()).optional(),
  lesson: z.string().max(8000).optional(),
  outcomeR: z.number().finite(),
  holdingMinutes: z.number().int().nonnegative(),
  maeR: z.number().finite(),
  mfeR: z.number().finite(),
  touched1r: z.boolean().optional(),
  touched2r: z.boolean().optional(),
  touched3r: z.boolean().optional(),
});

/* ---------- POST /api/trades/[id]/review — structured post-trade review + outcome row (PR 5). ---------- */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const tradeId = params.id;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tradeId)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Invalid trade id" } }, { status: 404 });
  }

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body", path: [] } },
      { status: 400 },
    );
  }

  const parsed = ReviewBodySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: first.message, path: first.path } },
      { status: 400 },
    );
  }

  if (
    parsed.data.overridePresent
    && parsed.data.ruleBasedExitEstimate == null
    && parsed.data.overrideRCost == null
  ) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Overrides require ruleBasedExitEstimate (e.g. exit_price) or overrideRCost",
          path: [],
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await submitStructuredReview(tradeId, user.id, parsed.data);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err) {
    if (err instanceof TradeReviewError) {
      const status =
        err.code === "NOT_FOUND" ? 404
        : err.code === "FORBIDDEN" ? 403
        : err.code === "TRADE_OPEN" ? 409
        : err.code === "NO_STRATEGY" ? 422
        : 400;
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status });
    }
    console.error("[POST /api/trades/[id]/review]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Review submission failed" } },
      { status: 500 },
    );
  }
}
