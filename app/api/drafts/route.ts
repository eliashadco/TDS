import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { createDraft } from "@/lib/trading/drafts";

const CreateDraftSchema = z.object({
  ticker: z.string().trim().toUpperCase().min(1).max(12),
  direction: z.enum(["LONG", "SHORT"]).optional(),
  mode: z.string().optional(),
  strategyId: z.string().uuid().optional(),
  draftContext: z.record(z.string(), z.unknown()).optional(),
});

/* ---------- POST /api/drafts — create a new draft ----------
 * Returns the persisted draftId before MarketWatch can navigate (Hard Rule 8).
 * Canon §7.1 — response: { draftId, draft }
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
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

  const parsed = CreateDraftSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: first.message, path: first.path } },
      { status: 400 },
    );
  }

  try {
    const { draftId, draft } = await createDraft({
      userId: user.id,
      ticker: parsed.data.ticker,
      direction: parsed.data.direction,
      mode: parsed.data.mode,
      strategyId: parsed.data.strategyId,
      draftContext: parsed.data.draftContext,
    });
    return NextResponse.json({ draftId, draft }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/drafts]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create draft" } },
      { status: 500 },
    );
  }
}
