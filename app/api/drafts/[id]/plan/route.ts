import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { freezeDraftPlan } from "@/lib/trading/drafts";

const FreezePlanSchema = z.object({
  entry: z.number().positive().nullable().optional(),
  stop: z.number().positive().nullable().optional(),
  targets: z.array(z.number().positive()).optional(),
  risk_pct: z.number().positive().max(4).nullable().optional(),
  sl_proximity: z.number().nullable().optional(),
  execution_intent: z.string().max(500).optional(),
});

/* ---------- POST /api/drafts/[id]/plan — freeze plan, return blockers ----------
 * Merges the plan onto the draft and advances state to 'planned' if plan is valid.
 * Returns the full updated draft + any plan-level blocker codes.
 * Canon §7.1.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  }

  // Ownership check
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

  const parsed = FreezePlanSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: first.message, path: first.path } },
      { status: 400 },
    );
  }

  try {
    const { draft, blockers } = await freezeDraftPlan(params.id, parsed.data);
    return NextResponse.json({ draft, blockers });
  } catch (err) {
    console.error("[POST /api/drafts/[id]/plan]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to freeze plan" } },
      { status: 500 },
    );
  }
}
