import "server-only";

import { createServiceSupabase } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import type { Trade } from "@/types/trade";
import { emitTradeEvent } from "./events";

export class TradeReviewError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TradeReviewError";
  }
}

/** Canonical POST body for structured post-trade review (PR 5). */
export interface StructuredReviewInput {
  executionAdherence: "clean" | "minor_deviation" | "major_deviation";
  deviationTag?: string;
  overridePresent: boolean;
  /** Ignored when rule-based exit can be derived from frozen prices + estimate. */
  overrideRCost?: number;
  ruleBasedExitEstimate?: Record<string, unknown>;
  lesson?: string;
  outcomeR: number;
  holdingMinutes?: number;
  maeR?: number;
  mfeR?: number;
  touched1r?: boolean;
  touched2r?: boolean;
  touched3r?: boolean;
}

function asFiniteNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Pull numeric exit price from rule_based_exit_estimate JSON. */
export function parseRuleBasedExitPrice(ruleBasedExitEstimate: unknown): number | null {
  if (!ruleBasedExitEstimate || typeof ruleBasedExitEstimate !== "object") return null;
  const o = ruleBasedExitEstimate as Record<string, unknown>;
  const candidates = [o.exit_price, o.exitPrice, o.priceAtRuleExit];
  for (const c of candidates) {
    const n = asFiniteNumber(c);
    if (n != null) return n;
  }
  return null;
}

function realizedRMultiple(params: {
  entry: number;
  stop: number;
  exit: number;
  direction: "LONG" | "SHORT";
  shares: number;
}): number | null {
  const { entry, stop, exit, direction, shares } = params;
  if (shares <= 0) return null;
  const riskPerShare = Math.abs(entry - stop);
  if (!(riskPerShare > 0)) return null;
  const pnl = direction === "LONG"
    ? (exit - entry) * shares
    : (entry - exit) * shares;
  return pnl / (riskPerShare * shares);
}

async function loadFrozenPlanPrices(
  supabase: ReturnType<typeof createServiceSupabase>,
  tradeId: string,
  fallback: Pick<Trade, "entry_price" | "stop_loss">,
): Promise<{ entry: number | null; stop: number | null }> {
  let entry = asFiniteNumber(fallback.entry_price);
  let stop = asFiniteNumber(fallback.stop_loss);

  const { data: rows } = await supabase
    .from("trade_parameter_values")
    .select("value, parameter_definition_id")
    .eq("trade_id", tradeId);

  const defIds = Array.from(
    new Set((rows ?? []).map((r) => r.parameter_definition_id).filter(Boolean) as string[]),
  );
  const idToName = new Map<string, string>();
  if (defIds.length > 0) {
    const { data: defs } = await supabase
      .from("strategy_parameter_definitions")
      .select("id, name")
      .in("id", defIds);
    for (const d of defs ?? []) {
      idToName.set(d.id, d.name);
    }
  }

  for (const row of rows ?? []) {
    const name = idToName.get(row.parameter_definition_id) ?? "";
    if (!name) continue;
    const v = row.value as Json;
    let num: number | null = null;
    if (typeof v === "number") num = v;
    else if (v && typeof v === "object" && !Array.isArray(v)) {
      num = asFiniteNumber((v as Record<string, unknown>).value)
        ?? asFiniteNumber((v as Record<string, unknown>).price)
        ?? asFiniteNumber(v);
    }
    if (num == null) continue;
    const lower = name.toLowerCase();
    if (lower.includes("entry")) entry = num;
    if (lower.includes("stop")) stop = num;
  }

  return { entry, stop };
}

function deriveOverrideLedger(input: StructuredReviewInput, params: {
  entry: number | null;
  stop: number | null;
  outcomeR: number;
  direction: "LONG" | "SHORT";
  shares: number;
}): { overrideRCost: number | null; estimatedRWithoutOverride: number | null } {
  if (!input.overridePresent) {
    return { overrideRCost: null, estimatedRWithoutOverride: null };
  }

  const exitPx = parseRuleBasedExitPrice(input.ruleBasedExitEstimate);
  const { entry, stop, outcomeR, direction, shares } = params;

  if (exitPx != null && entry != null && stop != null) {
    const est = realizedRMultiple({ entry, stop, exit: exitPx, direction, shares });
    if (est != null) {
      const delta = outcomeR - est;
      return { overrideRCost: delta, estimatedRWithoutOverride: est };
    }
  }

  if (input.overrideRCost != null && Number.isFinite(input.overrideRCost)) {
    const est = outcomeR - input.overrideRCost;
    return { overrideRCost: input.overrideRCost, estimatedRWithoutOverride: est };
  }

  return { overrideRCost: null, estimatedRWithoutOverride: null };
}

/** Ensure each closed, unreviewed trade has an open workflow task (canon §7.1). Idempotent. */
export async function syncReviewDueWorkflowTasks(userId: string): Promise<void> {
  const supabase = createServiceSupabase();

  const { data: closedTrades } = await supabase
    .from("trades")
    .select("id")
    .eq("user_id", userId)
    .eq("closed", true);

  const { data: reviews } = await supabase
    .from("trade_reviews")
    .select("trade_id")
    .eq("user_id", userId);

  const reviewed = new Set((reviews ?? []).map((r) => r.trade_id));

  for (const row of closedTrades ?? []) {
    if (reviewed.has(row.id)) continue;

    const { data: existing } = await supabase
      .from("workflow_tasks")
      .select("id")
      .eq("user_id", userId)
      .eq("task_type", "review_due")
      .eq("entity_type", "trade")
      .eq("entity_id", row.id)
      .is("completed_at", null)
      .maybeSingle();

    if (existing) continue;

    await supabase.from("workflow_tasks").insert({
      user_id: userId,
      task_type: "review_due",
      entity_type: "trade",
      entity_id: row.id,
      due_at: new Date().toISOString(),
      payload: { review_due: 1 },
    });
  }
}

async function completeReviewWorkflowTasks(
  supabase: ReturnType<typeof createServiceSupabase>,
  userId: string,
  tradeId: string,
): Promise<void> {
  await supabase
    .from("workflow_tasks")
    .update({ completed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("task_type", "review_due")
    .eq("entity_type", "trade")
    .eq("entity_id", tradeId)
    .is("completed_at", null);
}

/**
 * Persist structured review + strategy_outcomes (migration 016).
 * Server derives override ledger from frozen parameter values when possible.
 */
export async function submitStructuredReview(
  tradeId: string,
  actingUserId: string,
  input: StructuredReviewInput,
): Promise<{ outcomeId: string }> {
  const supabase = createServiceSupabase();

  const { data: trade, error: tradeErr } = await supabase
    .from("trades")
    .select(
      "user_id, strategy_id, strategy_version_id, closed, entry_price, stop_loss, direction, shares",
    )
    .eq("id", tradeId)
    .single();

  if (tradeErr || !trade) {
    throw new TradeReviewError("NOT_FOUND", `Trade not found [${tradeId}]`);
  }

  if (trade.user_id !== actingUserId) {
    throw new TradeReviewError("FORBIDDEN", "Trade does not belong to this user");
  }

  if (!trade.closed) {
    throw new TradeReviewError("TRADE_OPEN", "Review is only allowed for closed trades");
  }

  if (!trade.strategy_id) {
    throw new TradeReviewError("NO_STRATEGY", "Trade has no strategy_id; cannot write strategy_outcomes");
  }

  const frozen = await loadFrozenPlanPrices(supabase, tradeId, {
    entry_price: trade.entry_price,
    stop_loss: trade.stop_loss,
  });

  const sharesResolved = typeof trade.shares === "number" && trade.shares > 0 ? trade.shares : 1;
  if (!(typeof trade.shares === "number" && trade.shares > 0)) {
    console.warn(`[review] trade ${tradeId} has no shares value; override R cost computed at shares=1 (precision degraded)`);
  }

  const ledger = deriveOverrideLedger(input, {
    entry: frozen.entry,
    stop: frozen.stop,
    outcomeR: input.outcomeR,
    direction: trade.direction as "LONG" | "SHORT",
    shares: sharesResolved,
  });

  const overrideRCostStored = ledger.overrideRCost ?? (input.overrideRCost ?? null);
  const estimatedWithoutOverride =
    ledger.estimatedRWithoutOverride
    ?? (overrideRCostStored != null ? input.outcomeR - overrideRCostStored : null);

  const { error: reviewErr } = await supabase.from("trade_reviews").upsert(
    {
      user_id: trade.user_id,
      trade_id: tradeId,
      execution_adherence: input.executionAdherence,
      deviation_tag: input.deviationTag ?? null,
      override_present: input.overridePresent,
      override_r_cost: overrideRCostStored,
      rule_based_exit_estimate: (input.ruleBasedExitEstimate ?? null) as Json | null,
      lesson: input.lesson ?? null,
    },
    { onConflict: "trade_id" },
  );

  if (reviewErr) {
    throw new TradeReviewError("REVIEW_UPSERT_FAILED", reviewErr.message);
  }

  const { data: outcome, error: outcomeErr } = await supabase
    .from("strategy_outcomes")
    .upsert(
      {
        user_id: trade.user_id,
        trade_id: tradeId,
        strategy_id: trade.strategy_id,
        strategy_version_id: trade.strategy_version_id ?? null,
        outcome_r: input.outcomeR,
        mae_r: input.maeR ?? null,
        mfe_r: input.mfeR ?? null,
        touched_1r: input.touched1r ?? false,
        touched_2r: input.touched2r ?? false,
        touched_3r: input.touched3r ?? false,
        holding_minutes: input.holdingMinutes ?? null,
        first_parameter_failure_at: null,
        had_override: input.overridePresent,
        override_r_cost: overrideRCostStored,
        estimated_r_without_override: estimatedWithoutOverride,
        execution_classification: input.executionAdherence,
      },
      { onConflict: "trade_id" },
    )
    .select("id")
    .single();

  if (outcomeErr || !outcome) {
    throw new TradeReviewError("OUTCOME_UPSERT_FAILED", outcomeErr?.message ?? "unknown");
  }

  await completeReviewWorkflowTasks(supabase, trade.user_id, tradeId);

  await emitTradeEvent({
    userId: trade.user_id,
    entityType: "trade",
    entityId: tradeId,
    eventType: "trade.reviewed",
    payload: {
      outcomeId: outcome.id,
      outcomeR: input.outcomeR,
      executionAdherence: input.executionAdherence,
      hadOverride: input.overridePresent,
    },
  });

  return { outcomeId: outcome.id };
}
