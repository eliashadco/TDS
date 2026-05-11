import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { buildAdvancedStatisticsPack } from "@/lib/analytics/statistics-pack";
import { buildStrategyProofReport, parameterFailureLatencyP50Minutes, type OutcomeRowForProof } from "@/lib/analytics/reports";
import type { StrategyAnalyticsResponse, StrategyStatisticsCacheRow } from "@/types/analytics";
import { STRATEGY_SAMPLE_MINIMUM } from "@/types/analytics";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* ---------- GET /api/analytics/strategy/[id] ----------
 * Recomputes strategy_statistics cache from strategy_outcomes (PR 7).
 */
export async function GET(_req: Request, context: { params: { id: string } }) {
  const { id: strategyId } = context.params;

  if (!UUID_RE.test(strategyId)) {
    return NextResponse.json({ error: { code: "INVALID_ID", message: "Strategy id must be a UUID" } }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  }

  try {
    const { data: owned, error: ownErr } = await supabase
      .from("user_strategies")
      .select("id")
      .eq("id", strategyId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (ownErr || !owned) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Strategy not found" } }, { status: 404 });
    }

    const { data: outcomeRows, error: outErr } = await supabase
      .from("strategy_outcomes")
      .select(
        "trade_id, strategy_version_id, outcome_r, had_override, override_r_cost, estimated_r_without_override, execution_classification, mae_r, mfe_r, touched_1r, touched_2r, touched_3r, holding_minutes, first_parameter_failure_at, created_at",
      )
      .eq("user_id", user.id)
      .eq("strategy_id", strategyId)
      .order("created_at", { ascending: true });

    if (outErr) {
      console.error("[GET /api/analytics/strategy/[id]] outcomes", outErr);
      return NextResponse.json(
        { error: { code: "QUERY_FAILED", message: outErr.message } },
        { status: 500 },
      );
    }

    const outcomes = outcomeRows ?? [];

    if (outcomes.length === 0) {
      return NextResponse.json({ empty: true }, { status: 200 });
    }

    const tradeIds = outcomes.map((o) => o.trade_id);
    const tradeMap = new Map<
      string,
      {
        setup_types: string[] | null;
        direction: string | null;
        closed_at: string | null;
        created_at: string | null;
      }
    >();

    if (tradeIds.length > 0) {
      const { data: trades, error: tradeErr } = await supabase
        .from("trades")
        .select("id, setup_types, direction, closed_at, created_at")
        .eq("user_id", user.id)
        .in("id", tradeIds);

      if (tradeErr) {
        console.error("[GET /api/analytics/strategy/[id]] trades", tradeErr);
        return NextResponse.json(
          { error: { code: "QUERY_FAILED", message: tradeErr.message } },
          { status: 500 },
        );
      }

      for (const t of trades ?? []) {
        tradeMap.set(t.id, {
          setup_types: t.setup_types,
          direction: t.direction,
          closed_at: t.closed_at,
          created_at: t.created_at,
        });
      }
    }

    const merged: OutcomeRowForProof[] = outcomes.map((o) => {
      const t = tradeMap.get(o.trade_id);
      const dir = t?.direction === "SHORT" || t?.direction === "LONG" ? t.direction : "LONG";
      const setups = Array.isArray(t?.setup_types)
        ? t!.setup_types!.filter((x): x is string => typeof x === "string")
        : [];
      return {
        outcome_r: o.outcome_r,
        had_override: o.had_override,
        override_r_cost: o.override_r_cost,
        estimated_r_without_override: o.estimated_r_without_override,
        execution_classification: o.execution_classification,
        mae_r: o.mae_r,
        mfe_r: o.mfe_r,
        touched_1r: o.touched_1r,
        touched_2r: o.touched_2r,
        touched_3r: o.touched_3r,
        holding_minutes: o.holding_minutes,
        first_parameter_failure_at: o.first_parameter_failure_at,
        setup_types: setups,
        direction: dir,
        closed_at: t?.closed_at ?? null,
        trade_created_at: t?.created_at ?? null,
        strategy_version_id: o.strategy_version_id,
      };
    });

    const proof = buildStrategyProofReport(merged);
    const advanced = buildAdvancedStatisticsPack(merged, strategyId);
    const latencyP50 = parameterFailureLatencyP50Minutes(merged);

    const statsInsert = {
      strategy_id: strategyId,
      sample_size: proof.sampleSize,
      win_rate: proof.winRateAll,
      expectancy_r: proof.expectancyAll,
      avg_mae_r: proof.avgMaeR,
      avg_mfe_r: proof.avgMfeR,
      override_rate: proof.overrideRate,
      override_cost_total_r: proof.overrideCostTotalR,
      parameter_failure_latency_p50: latencyP50 != null ? Math.round(latencyP50) : null,
      target_capture_efficiency: proof.targetCaptureEfficiency,
      last_computed_at: new Date().toISOString(),
    };

    const { data: cached, error: cacheErr } = await supabase
      .from("strategy_statistics")
      .upsert(statsInsert, { onConflict: "strategy_id" })
      .select(
        "strategy_id, sample_size, win_rate, expectancy_r, avg_mae_r, avg_mfe_r, override_rate, override_cost_total_r, parameter_failure_latency_p50, target_capture_efficiency, last_computed_at",
      )
      .maybeSingle();

    if (cacheErr) {
      console.error("[GET /api/analytics/strategy/[id]] cache upsert", cacheErr);
    }

    const statistics: StrategyStatisticsCacheRow | null = cached
      ? {
          strategy_id: cached.strategy_id,
          sample_size: cached.sample_size,
          win_rate: cached.win_rate,
          expectancy_r: cached.expectancy_r,
          avg_mae_r: cached.avg_mae_r,
          avg_mfe_r: cached.avg_mfe_r,
          override_rate: cached.override_rate,
          override_cost_total_r: cached.override_cost_total_r,
          parameter_failure_latency_p50: cached.parameter_failure_latency_p50,
          target_capture_efficiency: cached.target_capture_efficiency,
          last_computed_at: cached.last_computed_at,
        }
      : null;

    const body: StrategyAnalyticsResponse = {
      strategyId,
      sampleWarning: proof.sampleSize > 0 && proof.sampleSize < STRATEGY_SAMPLE_MINIMUM,
      proof,
      statistics,
      advanced,
    };

    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    console.error("[GET /api/analytics/strategy/[id]]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to build strategy analytics" } },
      { status: 500 },
    );
  }
}
