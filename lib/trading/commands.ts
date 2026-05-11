import "server-only";
import { createServiceSupabase } from "@/lib/supabase/server";
import { emitTradeEvent } from "./events";
import { evaluateDeployGuardrails } from "./guards";
import type { BlockerCode, DraftIntakeField, DraftChallengeResponse } from "@/types/draft";
import type { Database } from "@/types/database";
import type { MonitorCheckResult } from "./monitor";

export type { MonitorCheckResult } from "./monitor";

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class DeployBlockedError extends Error {
  constructor(public readonly blockers: BlockerCode[]) {
    super(`Deploy blocked: ${blockers.join(", ")}`);
    this.name = "DeployBlockedError";
  }
}

// ---------------------------------------------------------------------------
// deployDraft — the canonical trade creation command (canon §13 / Hard Rule 4)
//
// All writes are sequential server-side operations using the service role.
// A future refactor should wrap these in a Postgres transaction via RPC
// to guarantee atomicity; the current implementation is safe under normal
// conditions because the draft state is only set to 'deployed' as the
// final step.
// ---------------------------------------------------------------------------

export async function deployDraft(
  draftId: string,
  userId: string,
): Promise<{ tradeId: string }> {
  const supabase = createServiceSupabase();

  // 1. Load draft, intake fields, and strategy context
  const { data: draft, error: draftErr } = await supabase
    .from("trade_drafts")
    .select("*")
    .eq("id", draftId)
    .eq("user_id", userId)
    .single();

  if (draftErr || !draft) {
    throw new Error(`deployDraft: draft not found [${draftId}]`);
  }

  if (draft.state === "deployed") {
    throw new Error(`deployDraft: draft already deployed [${draftId}]`);
  }

  const intakeFields = (draft.intake_fields ?? []) as unknown as DraftIntakeField[];
  const plan = (draft.plan ?? {}) as {
    entry?: number | null;
    stop?: number | null;
    targets?: number[];
    risk_pct?: number | null;
    sl_proximity?: number | null;
    execution_intent?: string;
  };
  const challengeResult = draft.challenge_result as DraftChallengeResponse | null;

  // 2. Get current portfolio heat from open trades
  const { data: openTrades } = await supabase
    .from("trades")
    .select("risk_pct")
    .eq("user_id", userId)
    .eq("closed", false);

  // V3 trades store risk_pct as a fraction (e.g., 0.02 = 2%).
  // validatePortfolioHeat expects currentHeatPct in percentage (e.g., 2 = 2%).
  const currentHeatPct = (openTrades ?? []).reduce(
    (sum, t) => sum + (typeof t.risk_pct === "number" ? t.risk_pct * 100 : 0),
    0,
  );

  // 3. Evaluate guardrails — throws DeployBlockedError if blocked
  const { ready, blockers } = evaluateDeployGuardrails(
    {
      strategy_id: draft.strategy_id,
      intake_fields: intakeFields,
      plan,
      challenge_result: challengeResult,
    },
    { currentPortfolioHeatPct: currentHeatPct },
  );

  if (!ready) {
    throw new DeployBlockedError(blockers);
  }

  // 4. Extract confirmed field values for trade insert
  const invalidationField = intakeFields.find((f) => f.name === "invalidation_rule");
  const thesisField = intakeFields.find((f) => f.name === "thesis");
  const invalidationText =
    typeof invalidationField?.value === "string"
      ? invalidationField.value
      : "See intake fields";
  const thesisText =
    typeof thesisField?.value === "string"
      ? thesisField.value
      : (draft.draft_context as Record<string, unknown>)?.thesis as string ?? "";

  const validModes = ["investment", "swing", "daytrade", "scalp"] as const;
  type TradeMode = typeof validModes[number];
  const draftMode = draft.mode as string | null;
  const tradeMode: TradeMode =
    draftMode && (validModes as readonly string[]).includes(draftMode)
      ? (draftMode as TradeMode)
      : "swing";

  // 5. Insert the live trade row
  const { data: newTrade, error: tradeInsertErr } = await supabase
    .from("trades")
    .insert({
      user_id: userId,
      ticker: draft.ticker,
      direction: (draft.direction as "LONG" | "SHORT") ?? "LONG",
      mode: tradeMode,
      strategy_id: draft.strategy_id ?? null,
      thesis: thesisText,
      invalidation: invalidationText,
      entry_price: plan.entry ?? null,
      stop_loss: plan.stop ?? null,
      risk_pct: plan.risk_pct ?? null,
      state: "deployed",
      confirmed: true,
      closed: false,
      source: "thesis",
      classification: "in_policy",
      lineage_draft_id: draftId,
      // V3 legacy aggregates — zero until PR 9 removes them
      f_score: 0,
      t_score: 0,
      f_total: 0,
      t_total: 0,
      scores: {},
      notes: {},
      setup_types: [],
      conditions: [],
      chart_pattern: "",
      journal_entry: "",
      journal_exit: "",
      journal_post: "",
    })
    .select("id")
    .single();

  if (tradeInsertErr || !newTrade) {
    throw new Error(`deployDraft: trade insert failed: ${tradeInsertErr?.message}`);
  }

  const tradeId = newTrade.id;
  const now = new Date().toISOString();

  // 6. Lock required_for_deploy parameter values
  const requiredFields = intakeFields.filter(
    (f) => f.operationalClass === "required_for_deploy",
  );

  if (requiredFields.length > 0) {
    const paramValueRows = requiredFields
      .filter((f) => f.parameterDefinitionId)
      .map((f) => ({
        trade_id: tradeId,
        draft_id: draftId,
        parameter_definition_id: f.parameterDefinitionId as string,
        value: f.value as Database["public"]["Tables"]["trade_parameter_values"]["Insert"]["value"],
        provenance: f.provenance as Database["public"]["Tables"]["trade_parameter_values"]["Insert"]["provenance"],
        locked_at: now,
      }));

    if (paramValueRows.length > 0) {
      const { error: pvErr } = await supabase
        .from("trade_parameter_values")
        .insert(paramValueRows);
      if (pvErr) throw new Error(`deployDraft: param values insert failed: ${pvErr.message}`);
    }
  }

  // 7. Insert monitoring rules with default cadence (24h)
  const nextCheckAt = new Date(Date.now() + 86_400_000).toISOString();
  const { error: monitorErr } = await supabase.from("trade_monitoring_rules").insert({
    trade_id: tradeId,
    cadence_seconds: 86400,
    invalidation_conditions: [{ rule: "invalidation_rule", value: invalidationText }],
    silent_update_thresholds: {},
    critical_alert_routing: {},
    next_parameter_check_at: nextCheckAt,
  });

  if (monitorErr) {
    throw new Error(`deployDraft: monitoring rules insert failed: ${monitorErr.message}`);
  }

  // 8. Update draft to 'deployed' and link back to trade
  const { error: draftUpdateErr } = await supabase
    .from("trade_drafts")
    .update({
      state: "deployed",
      deployed_trade_id: tradeId,
      updated_at: now,
    })
    .eq("id", draftId);

  if (draftUpdateErr) {
    throw new Error(`deployDraft: draft state update failed: ${draftUpdateErr.message}`);
  }

  // 9. Set next_parameter_check_at on the trade
  await supabase
    .from("trades")
    .update({ next_parameter_check_at: nextCheckAt })
    .eq("id", tradeId);

  // 10. Emit deployed event with frozen contract
  await emitTradeEvent({
    userId,
    entityType: "trade",
    entityId: tradeId,
    eventType: "trade.deployed",
    payload: {
      draftId,
      ticker: draft.ticker,
      direction: draft.direction,
      plan,
      requiredFieldCount: requiredFields.length,
    },
  });

  return { tradeId };
}

// ---------------------------------------------------------------------------
// recordMonitorCheck — persist a monitor check result (canon §10)
// ---------------------------------------------------------------------------

export async function recordMonitorCheck(
  tradeId: string,
  result: MonitorCheckResult,
): Promise<void> {
  const supabase = createServiceSupabase();

  // Persist the check record
  const { error: checkErr } = await supabase.from("trade_monitor_checks").insert({
    trade_id: tradeId,
    ran_at: result.ranAt,
    result: result as unknown as Database["public"]["Tables"]["trade_monitor_checks"]["Insert"]["result"],
    alert_fired: result.alert?.type ?? null,
  });

  if (checkErr) throw new Error(`recordMonitorCheck: insert failed: ${checkErr.message}`);

  // Write silent timeline entries
  for (const su of result.silentUpdates) {
    const { error: suErr } = await supabase.from("trade_silent_updates").insert({
      trade_id: tradeId,
      kind: su.kind as Database["public"]["Tables"]["trade_silent_updates"]["Insert"]["kind"],
      summary: su.summary,
      evidence_id: su.evidenceId ?? null,
    });
    if (suErr) throw new Error(`recordMonitorCheck: silent_update insert failed: ${suErr.message}`);
  }

  // Update last check timestamps on the trade
  const { data: monitorRule } = await supabase
    .from("trade_monitoring_rules")
    .select("cadence_seconds")
    .eq("trade_id", tradeId)
    .single();

  const cadence = monitorRule?.cadence_seconds ?? 86400;
  const nextCheckAt = new Date(Date.now() + cadence * 1000).toISOString();

  await supabase
    .from("trades")
    .update({
      last_parameter_check_at: result.ranAt,
      last_parameter_check_result: result as unknown as Database["public"]["Tables"]["trades"]["Update"]["last_parameter_check_result"],
      next_parameter_check_at: nextCheckAt,
    })
    .eq("id", tradeId);

  // Fetch userId for event emission
  const { data: trade } = await supabase
    .from("trades")
    .select("user_id")
    .eq("id", tradeId)
    .single();

  if (trade) {
    await emitTradeEvent({
      userId: trade.user_id,
      entityType: "trade",
      entityId: tradeId,
      eventType: "trade.monitor_check",
      payload: {
        ranAt: result.ranAt,
        compliant: result.compliant,
        alertFired: result.alert?.type ?? null,
        breachCount: result.breaches.length,
      },
    });
  }
}
