import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { buildDashboardSummary } from "@/lib/dashboard/summary";

/* ---------- GET /api/dashboard/summary ----------
 * Canon §7.1 server-owned read model (PR 6).
 */
export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  }

  try {
    const summary = await buildDashboardSummary(supabase, user.id);
    return NextResponse.json(summary, { status: 200 });
  } catch (err) {
    console.error("[GET /api/dashboard/summary]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to build dashboard summary" } },
      { status: 500 },
    );
  }
}
