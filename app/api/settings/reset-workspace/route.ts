import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ensureStrategyWorkspaceForMode } from "@/lib/trading/strategies";
import type { TradeMode } from "@/types/trade";

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isMissingRelationError(error: unknown): boolean {
  const value = asRecord(error);
  return asString(value.code) === "PGRST205";
}

async function runDelete(
  operation: PromiseLike<{ error: unknown | null }>,
  tolerateMissingRelation = false,
) {
  const { error } = await operation;
  if (error && (!tolerateMissingRelation || !isMissingRelationError(error))) {
    throw error;
  }
}

function asResetScope(value: unknown): "activity" | "full" {
  return value === "activity" ? "activity" : "full";
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("mode")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    const currentMode = (profileData?.mode ?? null) as TradeMode | null;
    const body = (await request.json().catch(() => ({}))) as { scope?: unknown };
    const scope = asResetScope(body.scope);

    await runDelete(supabase.from("trades").delete().eq("user_id", user.id));
    await runDelete(supabase.from("watchlist_items").delete().eq("user_id", user.id));

    if (scope === "activity") {
      return NextResponse.json({
        ok: true,
        scope,
        reseeded: false,
        schemaReady: true,
        mode: currentMode,
        message: "Portfolio activity reset complete. Trades and watchlists were cleared, while saved strategies, metrics, and shared structure items were kept.",
      });
    }

    await runDelete(supabase.from("user_trade_structure_items").delete().eq("user_id", user.id), true);

    const { data: strategyRows, error: strategyError } = await supabase
      .from("user_strategies")
      .select("id")
      .eq("user_id", user.id);

    if (strategyError && !isMissingRelationError(strategyError)) {
      throw strategyError;
    }

    const strategyIds = (strategyRows ?? []).map((row) => row.id);

    if (strategyIds.length > 0) {
      await runDelete(supabase.from("strategy_versions").delete().in("strategy_id", strategyIds), true);
    }

    await runDelete(supabase.from("user_metrics").delete().eq("user_id", user.id));

    if (strategyIds.length > 0) {
      await runDelete(supabase.from("user_strategies").delete().in("id", strategyIds), true);
    }

    let reseeded = false;
    let schemaReady = true;

    if (currentMode) {
      const workspace = await ensureStrategyWorkspaceForMode(supabase, user.id, currentMode);
      schemaReady = workspace.schemaReady;
      reseeded = workspace.schemaReady && workspace.strategies.length > 0;
    }

    return NextResponse.json({
      ok: true,
      scope,
      reseeded,
      schemaReady,
      mode: currentMode,
      message: reseeded
        ? "Portfolio reset complete. Trades, watchlists, strategies, and shared structure entries were cleared, then the current mode was reseeded with a starter workspace."
        : "Portfolio reset complete. Trades, watchlists, strategies, and shared structure entries were cleared.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workspace reset failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}