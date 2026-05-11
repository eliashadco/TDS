import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AnalyticsOverviewResponse } from "@/types/analytics";
import { STRATEGY_SAMPLE_MINIMUM } from "@/types/analytics";

/* ---------- GET /api/analytics/overview ----------
 * Per-strategy rollup from strategy_outcomes (PR 7).
 * Optional: ?mode=swing|investment|daytrade|scalp limits to workspace lane.
 */
export async function GET(req: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  }

  const url = new URL(req.url);
  const modeFilter = url.searchParams.get("mode");
  const allowedModes = new Set(["investment", "swing", "daytrade", "scalp"]);
  const mode = modeFilter && allowedModes.has(modeFilter) ? modeFilter : null;

  try {
    let stratQuery = supabase.from("user_strategies").select("id, name, mode").eq("user_id", user.id);
    if (mode) {
      stratQuery = stratQuery.eq("mode", mode);
    }

    const { data: strategies, error: stratErr } = await stratQuery;
    if (stratErr) {
      console.error("[GET /api/analytics/overview] strategies", stratErr);
      return NextResponse.json(
        { error: { code: "QUERY_FAILED", message: stratErr.message } },
        { status: 500 },
      );
    }

    const { data: outcomes, error: outErr } = await supabase
      .from("strategy_outcomes")
      .select("strategy_id, outcome_r")
      .eq("user_id", user.id);

    if (outErr) {
      console.error("[GET /api/analytics/overview] outcomes", outErr);
      return NextResponse.json(
        { error: { code: "QUERY_FAILED", message: outErr.message } },
        { status: 500 },
      );
    }

    const byStrategy = new Map<string, number[]>();
    for (const row of outcomes ?? []) {
      if (!byStrategy.has(row.strategy_id)) byStrategy.set(row.strategy_id, []);
      byStrategy.get(row.strategy_id)!.push(row.outcome_r);
    }

    const listed = strategies ?? [];
    const payload: AnalyticsOverviewResponse = {
      totalOutcomes: outcomes?.length ?? 0,
      strategies: listed.map((s) => {
        const rs = byStrategy.get(s.id) ?? [];
        const n = rs.length;
        const expectancyR = n > 0 ? rs.reduce((a, b) => a + b, 0) / n : null;
        const winRate = n > 0 ? rs.filter((r) => r > 0).length / n : null;
        return {
          strategyId: s.id,
          strategyName: s.name,
          mode: s.mode,
          sampleSize: n,
          expectancyR,
          winRate,
          statisticallySignificant: n >= STRATEGY_SAMPLE_MINIMUM,
        };
      }),
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("[GET /api/analytics/overview]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to build analytics overview" } },
      { status: 500 },
    );
  }
}
