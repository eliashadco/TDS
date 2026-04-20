import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/* ---------- POST /api/market/watchlist-action ----------
 * Actions on watchlist_items:
 *   - archive: soft-delete (removes from queue)
 * ---------------------------------------------------- */

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { itemId, action } = body as { itemId?: string; action?: string };

  if (!itemId || typeof itemId !== "string") {
    return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
  }

  if (action !== "archive") {
    return NextResponse.json({ error: "Invalid action. Supported: archive" }, { status: 400 });
  }

  // Verify ownership
  const { data: item } = await supabase
    .from("watchlist_items")
    .select("id")
    .eq("id", itemId)
    .eq("user_id", user.id)
    .single();

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  // Delete from watchlist (archive = remove)
  const { error } = await supabase
    .from("watchlist_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to archive item" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
