import "server-only";
import { createServiceSupabase } from "@/lib/supabase/server";
import { emitTradeEvent } from "./events";
import type { BlockerCode, DraftChallengeResponse, DraftIntakeField } from "@/types/draft";
import type { Database, Json } from "@/types/database";

export type TradeDraftRow = Database["public"]["Tables"]["trade_drafts"]["Row"];

export interface DraftPlan {
  entry?: number | null;
  stop?: number | null;
  targets?: number[];
  risk_pct?: number | null;
  sl_proximity?: number | null;
  execution_intent?: string;
}

export interface CreateDraftInput {
  userId: string;
  ticker: string;
  direction?: "LONG" | "SHORT";
  mode?: string;
  strategyId?: string;
  draftContext?: Record<string, unknown>;
}

export interface PartialDraftMetadata {
  ticker?: string;
  direction?: "LONG" | "SHORT" | null;
  mode?: string | null;
  strategy_id?: string | null;
  draft_context?: Record<string, unknown>;
  intake_fields?: DraftIntakeField[];
}

// ---------------------------------------------------------------------------
// createDraft
// ---------------------------------------------------------------------------

export async function createDraft(
  input: CreateDraftInput,
): Promise<{ draftId: string; draft: TradeDraftRow }> {
  const supabase = createServiceSupabase();

  const { data, error } = await supabase
    .from("trade_drafts")
    .insert({
      user_id: input.userId,
      ticker: input.ticker,
      direction: input.direction ?? null,
      mode: input.mode ?? null,
      strategy_id: input.strategyId ?? null,
      draft_context: (input.draftContext ?? {}) as Json,
      state: "observed",
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`createDraft failed: ${error?.message ?? "no data returned"}`);
  }

  await emitTradeEvent({
    userId: input.userId,
    entityType: "draft",
    entityId: data.id,
    eventType: "draft.created",
    payload: { ticker: input.ticker, direction: input.direction },
  });

  return { draftId: data.id, draft: data };
}

// ---------------------------------------------------------------------------
// patchDraftMetadata — shallow top-level merge (canon §7.1)
// ---------------------------------------------------------------------------

export async function patchDraftMetadata(
  draftId: string,
  patch: PartialDraftMetadata,
): Promise<TradeDraftRow> {
  const supabase = createServiceSupabase();

  // Build the update object — only include keys explicitly provided
  const update: Database["public"]["Tables"]["trade_drafts"]["Update"] = {
    updated_at: new Date().toISOString(),
  };

  if (patch.ticker !== undefined) update.ticker = patch.ticker;
  if (patch.direction !== undefined) update.direction = patch.direction;
  if (patch.mode !== undefined) update.mode = patch.mode;
  if (patch.strategy_id !== undefined) update.strategy_id = patch.strategy_id;
  if (patch.draft_context !== undefined) {
    update.draft_context = patch.draft_context as Database["public"]["Tables"]["trade_drafts"]["Update"]["draft_context"];
  }
  if (patch.intake_fields !== undefined) {
    update.intake_fields = patch.intake_fields as unknown as Database["public"]["Tables"]["trade_drafts"]["Update"]["intake_fields"];
  }

  const { data, error } = await supabase
    .from("trade_drafts")
    .update(update)
    .eq("id", draftId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`patchDraftMetadata failed: ${error?.message ?? "no data returned"}`);
  }

  return data;
}

// ---------------------------------------------------------------------------
// freezeDraftPlan — write plan, advance state to 'planned', return blockers
// ---------------------------------------------------------------------------

export async function freezeDraftPlan(
  draftId: string,
  plan: DraftPlan,
): Promise<{ draft: TradeDraftRow; blockers: BlockerCode[] }> {
  const supabase = createServiceSupabase();

  // Merge new plan over existing plan (JSONB || operator equivalent)
  const { data: existing, error: fetchErr } = await supabase
    .from("trade_drafts")
    .select("plan, user_id, intake_fields, strategy_id, challenge_result")
    .eq("id", draftId)
    .single();

  if (fetchErr || !existing) {
    throw new Error(`freezeDraftPlan: draft not found [${draftId}]`);
  }

  const mergedPlan = { ...(existing.plan as object ?? {}), ...plan };

  // Evaluate which blockers are plan-related
  const planBlockers: BlockerCode[] = [];
  const p = plan;
  if (p.stop == null || typeof p.stop !== "number" || !isFinite(p.stop)) planBlockers.push("STOP_LOSS_MISSING");
  if (p.entry == null || typeof p.entry !== "number" || !isFinite(p.entry)) planBlockers.push("ENTRY_PRICE_MISSING");
  if (p.risk_pct == null || typeof p.risk_pct !== "number" || p.risk_pct <= 0 || p.risk_pct > 4) planBlockers.push("RISK_NOT_SET");

  const nextState = planBlockers.length === 0 ? "planned" : "qualified";

  const { data, error } = await supabase
    .from("trade_drafts")
    .update({
      plan: mergedPlan as Json,
      blockers: planBlockers as unknown as Json,
      state: nextState,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`freezeDraftPlan update failed: ${error?.message ?? "no data"}`);
  }

  await emitTradeEvent({
    userId: existing.user_id as string,
    entityType: "draft",
    entityId: draftId,
    eventType: "draft.planned",
    payload: { plan: mergedPlan, blockers: planBlockers },
  });

  return { draft: data, blockers: planBlockers };
}

// ---------------------------------------------------------------------------
// runDraftChallenge — evaluate field-level challenge states (canon §5.2)
// Price/level fields require live market data; those are marked not_comparable
// here and upgraded by the API route when market context is available.
// ---------------------------------------------------------------------------

export async function runDraftChallenge(
  draftId: string,
): Promise<DraftChallengeResponse> {
  const supabase = createServiceSupabase();

  const { data: draft, error: fetchErr } = await supabase
    .from("trade_drafts")
    .select("user_id, intake_fields, strategy_id, blockers")
    .eq("id", draftId)
    .single();

  if (fetchErr || !draft) {
    throw new Error(`runDraftChallenge: draft not found [${draftId}]`);
  }

  // Load parameter definitions to know field types
  const paramDefs: Record<string, { type: string; operational_class: string }> = {};
  if (draft.strategy_id) {
    const { data: defs } = await supabase
      .from("strategy_parameter_definitions")
      .select("id, type, operational_class")
      .eq("strategy_id", draft.strategy_id as string);
    if (defs) {
      for (const d of defs) paramDefs[d.id] = { type: d.type, operational_class: d.operational_class };
    }
  }

  const intakeFields = (draft.intake_fields ?? []) as unknown as DraftIntakeField[];
  const ranAt = new Date().toISOString();

  const challengeFields: DraftChallengeResponse["fields"] = intakeFields.map((f) => {
    // Fields without a value cannot be verified
    if (f.value == null) {
      return { fieldId: f.id, challengeState: "not_comparable" as const };
    }

    const def = f.parameterDefinitionId ? paramDefs[f.parameterDefinitionId] : null;
    const fieldType = def?.type ?? "text";

    // Non-numeric types (enum, text, boolean) don't require live market comparison
    if (["enum", "text", "boolean"].includes(fieldType)) {
      return {
        fieldId: f.id,
        challengeState:
          f.resolutionState === "user_confirmed"
            ? ("confirmed" as const)
            : ("not_checked" as const),
      };
    }

    // Numeric/price/level fields need live market data — deferred to API route
    return { fieldId: f.id, challengeState: "not_comparable" as const };
  });

  // Blockers: any required_for_deploy field in 'challenged' state
  const requiredIds = new Set(
    intakeFields
      .filter((f) => f.operationalClass === "required_for_deploy")
      .map((f) => f.id),
  );
  const challengeBlockers: BlockerCode[] =
    challengeFields.some((cf) => cf.challengeState === "challenged" && requiredIds.has(cf.fieldId))
      ? ["CHALLENGE_FAILED"]
      : [];

  const result: DraftChallengeResponse = {
    draftId,
    ranAt,
    fields: challengeFields,
    blockers: challengeBlockers,
  };

  // Persist result on draft
  const { error: updateErr } = await supabase
    .from("trade_drafts")
    .update({
      challenge_result: result as unknown as Database["public"]["Tables"]["trade_drafts"]["Update"]["challenge_result"],
      updated_at: ranAt,
    })
    .eq("id", draftId);

  if (updateErr) {
    throw new Error(`runDraftChallenge: failed to persist result: ${updateErr.message}`);
  }

  await emitTradeEvent({
    userId: draft.user_id as string,
    entityType: "draft",
    entityId: draftId,
    eventType: "draft.challenged",
    payload: { ranAt, fieldCount: challengeFields.length, blockers: challengeBlockers },
  });

  return result;
}

// ---------------------------------------------------------------------------
// archiveDraft
// ---------------------------------------------------------------------------

export async function archiveDraft(draftId: string, reason: string): Promise<void> {
  const supabase = createServiceSupabase();

  const { data: draft, error: fetchErr } = await supabase
    .from("trade_drafts")
    .select("user_id")
    .eq("id", draftId)
    .single();

  if (fetchErr || !draft) {
    throw new Error(`archiveDraft: draft not found [${draftId}]`);
  }

  const { error } = await supabase
    .from("trade_drafts")
    .update({ state: "archived", updated_at: new Date().toISOString() })
    .eq("id", draftId);

  if (error) throw new Error(`archiveDraft failed: ${error.message}`);

  await emitTradeEvent({
    userId: draft.user_id as string,
    entityType: "draft",
    entityId: draftId,
    eventType: "draft.archived",
    payload: { reason },
  });
}
