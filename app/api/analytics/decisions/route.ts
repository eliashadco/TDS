import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  buildDecisionQualityReport,
} from "@/lib/analytics/reports";
import type { DecisionQualityResponse } from "@/types/analytics";

/* ---------- GET /api/analytics/decisions ----------
 * Cross-strategy decision quality from strategy_outcomes (PR 7).
 */
export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  }

  try {
    const { data: outcomes, error: outErr } = await supabase
      .from("strategy_outcomes")
      .select("strategy_id, outcome_r, had_override, override_r_cost, execution_classification")
      .eq("user_id", user.id);

    if (outErr) {
      console.error("[GET /api/analytics/decisions] outcomes", outErr);
      return NextResponse.json(
        { error: { code: "QUERY_FAILED", message: outErr.message } },
        { status: 500 },
      );
    }

    const rows = outcomes ?? [];
    if (rows.length === 0) {
      const empty: DecisionQualityResponse = {
        totals: { outcomes: 0, strategiesRepresented: 0 },
        byExecution: [],
        byStrategy: [],
      };
      return NextResponse.json(empty, { status: 200 });
    }

    const strategyIds = Array.from(new Set(rows.map((r) => r.strategy_id)));
    const { data: strategies, error: stratErr } = await supabase
      .from("user_strategies")
      .select("id, name")
      .eq("user_id", user.id)
      .in("id", strategyIds);

    if (stratErr) {
      console.error("[GET /api/analytics/decisions] strategies", stratErr);
      return NextResponse.json(
        { error: { code: "QUERY_FAILED", message: stratErr.message } },
        { status: 500 },
      );
    }

    const nameById = new Map((strategies ?? []).map((s) => [s.id, s.name]));

    const report = buildDecisionQualityReport(
      rows.map((r) => ({
        strategy_id: r.strategy_id,
        strategy_name: nameById.get(r.strategy_id) ?? "Unknown strategy",
        outcome_r: r.outcome_r,
        had_override: r.had_override,
        override_r_cost: r.override_r_cost,
        execution_classification: r.execution_classification,
      })),
    );

    return NextResponse.json(report, { status: 200 });
  } catch (err) {
    console.error("[GET /api/analytics/decisions]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to build decision quality report" } },
      { status: 500 },
    );
  }
}
