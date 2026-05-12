import { createServerSupabase } from "@/lib/supabase/server";
import { getProtectedAppContext } from "@/lib/supabase/protected-app";
import JournalClient from "@/components/journal/JournalClient";
import { syncReviewDueWorkflowTasks } from "@/lib/trading/review";
import type { Trade } from "@/types/trade";

function isClosedTradeRow(t: { closed?: boolean; state?: string }): boolean {
  return t.closed === true || t.state === "closed";
}

export default async function JournalPage() {
  const { userId } = await getProtectedAppContext();
  const supabase = await createServerSupabase();

  const { data: trades } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .not("state", "eq", "initiated")
    .order("created_at", { ascending: false });

  const { data: overrides } = await supabase
    .from("overrides")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const { data: reviewedRows } = await supabase
    .from("trade_reviews")
    .select("trade_id")
    .eq("user_id", userId);

  await syncReviewDueWorkflowTasks(userId);

  const reviewedIds = new Set((reviewedRows ?? []).map((r) => r.trade_id));
  const tradeList = (trades ?? []) as unknown as Trade[];
  const tradesPendingReview = tradeList.filter(
    (t) => isClosedTradeRow(t) && !reviewedIds.has(t.id),
  );

  return (
    <JournalClient
      trades={tradeList}
      overrides={(overrides ?? []).map((o) => ({
        id: o.id,
        trade_id: o.trade_id,
        rules_broken: o.rules_broken ?? [],
        justification: o.justification,
        quality_flag: (o.quality_flag ?? "valid") as "valid" | "low_quality" | "high_risk",
        timer_duration_sec: o.timer_duration_sec,
        created_at: o.created_at,
      }))}
      tradesPendingReview={tradesPendingReview}
    />
  );
}
