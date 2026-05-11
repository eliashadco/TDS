import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { deployDraft, DeployBlockedError } from "@/lib/trading/commands";

const DeploySchema = z.object({
  draftId: z.string().uuid(),
});

/* ---------- POST /api/trades/deploy — deploy a ready draft to a live trade ----------
 * Calls deployDraft() which runs all nine guardrails before writing.
 * Returns 409 with blockers array when any guardrail fires (AC5).
 * Canon §7.1.
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

  const parsed = DeploySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: first.message, path: first.path } },
      { status: 400 },
    );
  }

  // Verify the draft belongs to this user before delegating to service-role command
  const { data: draft } = await supabase
    .from("trade_drafts")
    .select("id")
    .eq("id", parsed.data.draftId)
    .eq("user_id", user.id)
    .single();

  if (!draft) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Draft not found" } }, { status: 404 });
  }

  try {
    const { tradeId } = await deployDraft(parsed.data.draftId, user.id);
    return NextResponse.json({ tradeId }, { status: 201 });
  } catch (err) {
    if (err instanceof DeployBlockedError) {
      return NextResponse.json(
        { error: { code: "DEPLOY_BLOCKED", message: err.message, blockers: err.blockers } },
        { status: 409 },
      );
    }
    console.error("[POST /api/trades/deploy]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Deploy failed" } },
      { status: 500 },
    );
  }
}
