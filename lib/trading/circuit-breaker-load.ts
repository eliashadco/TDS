import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { DisciplineProfile } from "@/types/trade";
import {
  countConsecutiveLosses,
  computeDrawdownPercent,
  evaluateCircuitBreaker,
  getCircuitBreakerConfig,
  type CircuitBreakerStatus,
} from "@/lib/trading/circuit-breaker";

type CBProfileRow = {
  discipline_profile?: string | null;
  equity: number | null;
  peak_equity: number | null;
};

function isMissingDisciplineProfileColumn(error: { code?: string; message?: string } | null) {
  return error?.code === "42703" && (error.message ?? "").includes("discipline_profile");
}

/** Shared loader for circuit breaker evaluation (used by dashboard summary + /api/circuit-breaker). */
export async function loadCircuitBreakerStatus(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<CircuitBreakerStatus> {
  let { data: profile, error: profileError } = (await supabase
    .from("profiles")
    .select("discipline_profile, equity, peak_equity")
    .eq("id", userId)
    .maybeSingle()) as { data: CBProfileRow | null; error: { code?: string; message?: string } | null };

  if (isMissingDisciplineProfileColumn(profileError)) {
    const fb = (await supabase
      .from("profiles")
      .select("equity, peak_equity")
      .eq("id", userId)
      .maybeSingle()) as { data: CBProfileRow | null; error: { code?: string; message?: string } | null };
    profile = fb.data;
    profileError = fb.error;
  }

  const disciplineProfile = ((profile?.discipline_profile as string) ?? "balanced") as DisciplineProfile;
  const currentEquity = (profile?.equity as number) ?? 0;
  const peakEquity = Math.max((profile?.peak_equity as number) ?? 0, currentEquity);
  const config = getCircuitBreakerConfig(disciplineProfile);

  const { data: recentTrades } = await supabase
    .from("trades")
    .select("entry_price, exit_price, direction, state")
    .eq("user_id", userId)
    .eq("state", "closed")
    .order("closed_at", { ascending: false })
    .limit(config.maxConsecutiveLosses + 5);

  const safeTrades = (recentTrades ?? []).map((t) => ({
    entry_price: t.entry_price as number | null,
    exit_price: t.exit_price as number | null,
    direction: (t.direction ?? "LONG") as "LONG" | "SHORT",
    state: (t.state ?? "closed") as string,
  }));

  const consecutiveLosses = countConsecutiveLosses(safeTrades);
  const drawdownPercent = computeDrawdownPercent(peakEquity, currentEquity);
  return evaluateCircuitBreaker(consecutiveLosses, drawdownPercent, config);
}
