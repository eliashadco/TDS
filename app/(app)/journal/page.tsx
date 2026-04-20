import { createServerSupabase } from "@/lib/supabase/server";
import { getProtectedAppContext } from "@/lib/supabase/protected-app";
import JournalClient from "@/components/journal/JournalClient";
import type { Trade } from "@/types/trade";

export default async function JournalPage() {
  const { userId } = await getProtectedAppContext();
  const supabase = await createServerSupabase();

  // Fetch all non-initiated trades, newest first
  const { data: trades } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .not("state", "eq", "initiated")
    .order("created_at", { ascending: false });

  // Fetch all overrides for this user
  const { data: overrides } = await supabase
    .from("overrides")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return (
    <JournalClient
      trades={(trades ?? []) as unknown as Trade[]}
      overrides={(overrides ?? []).map((o) => ({
        id: o.id,
        trade_id: o.trade_id,
        rules_broken: o.rules_broken ?? [],
        justification: o.justification,
        quality_flag: (o.quality_flag ?? "valid") as "valid" | "low_quality" | "high_risk",
        timer_duration_sec: o.timer_duration_sec,
        created_at: o.created_at,
      }))}
    />
  );
}
