import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { runDraftChallenge } from "@/lib/trading/drafts";

/* ---------- POST /api/drafts/[id]/challenge ----------
 * V4 replacement for the legacy /api/drafts/[id]/score route.
 * Runs field-level challenge verification and returns DraftChallengeResponse.
 * Canon §7.1 / types/draft.ts DraftChallengeResponse.
 *
 * No request body required — the challenge reads state from the persisted draft.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  }

  // Ownership check — 404 on miss to avoid leaking draft existence
  const { data: existing } = await supabase
    .from("trade_drafts")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Draft not found" } }, { status: 404 });
  }

  try {
    const result = await runDraftChallenge(params.id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/drafts/[id]/challenge]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Challenge run failed" } },
      { status: 500 },
    );
  }
}
