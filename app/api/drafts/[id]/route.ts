import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { patchDraftMetadata, type PartialDraftMetadata } from "@/lib/trading/drafts";
import type { DraftIntakeField } from "@/types/draft";

const PatchDraftSchema = z.object({
  ticker: z.string().trim().toUpperCase().min(1).max(12).optional(),
  direction: z.enum(["LONG", "SHORT"]).nullable().optional(),
  mode: z.string().nullable().optional(),
  strategy_id: z.string().uuid().nullable().optional(),
  draft_context: z.record(z.string(), z.unknown()).optional(),
  intake_fields: z.array(z.unknown()).optional(),
});

/* ---------- GET /api/drafts/[id] — hydrate a draft ----------
 * Returns 404 (not 403) for another user's draft — do not leak existence (AC6).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  }

  // .eq("user_id", user.id) ensures another user's draft returns empty → 404
  const { data: draft, error } = await supabase
    .from("trade_drafts")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (error || !draft) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Draft not found" } }, { status: 404 });
  }

  return NextResponse.json({ draft });
}

/* ---------- PATCH /api/drafts/[id] — shallow metadata merge ----------
 * Keys present in the body overwrite; keys omitted are preserved (canon §7.1).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  }

  // Ownership check via anon client (RLS enforced) before delegating to service write
  const { data: existing } = await supabase
    .from("trade_drafts")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Draft not found" } }, { status: 404 });
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

  const parsed = PatchDraftSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: first.message, path: first.path } },
      { status: 400 },
    );
  }

  try {
    const patch: PartialDraftMetadata = {
      ...parsed.data,
      intake_fields: parsed.data.intake_fields as DraftIntakeField[] | undefined,
    };
    const draft = await patchDraftMetadata(params.id, patch);
    return NextResponse.json({ draft });
  } catch (err) {
    console.error("[PATCH /api/drafts/[id]]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to patch draft" } },
      { status: 500 },
    );
  }
}
