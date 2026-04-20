import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/export
 * Export trade journal + discipline data as JSON (TRD v2 §15).
 * Only returns data owned by the authenticated user.
 */
export async function GET() {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [tradesRes, overridesRes, disciplineRes, strategiesRes] = await Promise.all([
    supabase
      .from("trades")
      .select(
        "id, ticker, direction, mode, state, classification, thesis, entry_price, exit_price, stop_loss, shares, conviction, f_score, t_score, f_total, t_total, strategy_name, source, created_at, closed_at, closed_reason, journal_entry, journal_exit, journal_post",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("overrides")
      .select("id, trade_id, rules_broken, justification, quality_flag, timer_duration_sec, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("discipline_metrics")
      .select("id, score, period, in_policy_count, override_count, oob_count, pnl_in_policy, pnl_override, pnl_oob, created_at")
      .eq("user_id", user.id)
      .order("period", { ascending: false }),
    supabase
      .from("user_strategies")
      .select("id, name, mode, status, is_default, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    trades: tradesRes.data ?? [],
    overrides: overridesRes.data ?? [],
    disciplineMetrics: disciplineRes.data ?? [],
    strategies: strategiesRes.data ?? [],
  };

  return NextResponse.json(payload, {
    headers: {
      "Content-Disposition": `attachment; filename="tds-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
