import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadCircuitBreakerStatus } from "@/lib/trading/circuit-breaker-load";

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

  try {
    const status = await loadCircuitBreakerStatus(supabase, user.id);
    return NextResponse.json(status);
  } catch (err) {
    console.error("[GET /api/circuit-breaker]", err);
    return NextResponse.json({ error: "Circuit breaker evaluation failed" }, { status: 500 });
  }
}
