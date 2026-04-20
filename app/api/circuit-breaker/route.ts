import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  countConsecutiveLosses,
  computeDrawdownPercent,
  evaluateCircuitBreaker,
  getCircuitBreakerConfig,
} from "@/lib/trading/circuit-breaker";
import type { DisciplineProfile } from "@/types/trade";

type CircuitBreakerProfileRow = {
  discipline_profile?: string | null;
  equity: number | null;
  peak_equity: number | null;
};

function isMissingDisciplineProfileColumn(error: { code?: string; message?: string } | null) {
  return error?.code === "42703" && (error.message ?? "").includes("discipline_profile");
}

/* ---------- GET /api/circuit-breaker ----------
 * TRD v2 §12 — Circuit Breaker System
 * Returns whether the circuit breaker is currently tripped.
 *
 * DESIGN NOTE: Drawdown is calculated on CLOSED TRADE EQUITY only.
 * Using floating/live equity would require real-time tick processing,
 * which contradicts §20 computational limits. The peak_equity column
 * on profiles tracks the highest closed-trade equity watermark.
 * ----------------------------------------- */

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get discipline profile, current equity, and peak equity for drawdown
  let { data: profile, error: profileError } = (await supabase
    .from("profiles")
    .select("discipline_profile, equity, peak_equity")
    .eq("id", user.id)
    .maybeSingle()) as { data: CircuitBreakerProfileRow | null; error: { code?: string; message?: string } | null };

  if (isMissingDisciplineProfileColumn(profileError)) {
    const fallbackProfile = (await supabase
      .from("profiles")
      .select("equity, peak_equity")
      .eq("id", user.id)
      .maybeSingle()) as { data: CircuitBreakerProfileRow | null; error: { code?: string; message?: string } | null };

    profile = fallbackProfile.data;
    profileError = fallbackProfile.error;
  }

  const disciplineProfile = ((profile?.discipline_profile as string) ?? "balanced") as DisciplineProfile;
  const currentEquity = (profile?.equity as number) ?? 0;
  const peakEquity = Math.max((profile?.peak_equity as number) ?? 0, currentEquity);
  const config = getCircuitBreakerConfig(disciplineProfile);

  // Fetch recent closed trades (newest first) for consecutive loss check
  // NOTE: Only closed trades are used — no floating/live positions (§20)
  const { data: recentTrades } = await supabase
    .from("trades")
    .select("entry_price, exit_price, direction, state")
    .eq("user_id", user.id)
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
  const status = evaluateCircuitBreaker(consecutiveLosses, drawdownPercent, config);

  return NextResponse.json(status);
}
