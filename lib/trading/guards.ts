import type { BlockerCode, DraftChallengeResponse, DraftIntakeField } from "@/types/draft";
import { validatePortfolioHeat } from "./validation";

export interface GuardDraftInput {
  strategy_id: string | null;
  intake_fields: DraftIntakeField[];
  plan: {
    entry?: number | null;
    stop?: number | null;
    risk_pct?: number | null;
    [key: string]: unknown;
  };
  challenge_result: DraftChallengeResponse | null;
}

export interface GuardContext {
  /** Current open-trade portfolio heat as a percentage (e.g. 6 = 6%). */
  currentPortfolioHeatPct: number;
}

/**
 * Deterministic pre-deploy guardrail evaluation (canon §5 / §13.1).
 * Pure function — no DB calls, no side effects.
 * The caller is responsible for fetching draft data and portfolio context.
 *
 * Blocker specificity rule: INVALIDATION_RULE_MISSING fires for the invalidation
 * field specifically; PARAMETERS_NOT_CONFIRMED covers all other unconfirmed
 * required_for_deploy fields. Both can appear together.
 */
export function evaluateDeployGuardrails(
  draft: GuardDraftInput,
  context: GuardContext,
): { ready: boolean; blockers: BlockerCode[] } {
  const blockers: BlockerCode[] = [];

  // Gate 1 — strategy must be selected
  if (!draft.strategy_id) {
    blockers.push("STRATEGY_NOT_SELECTED");
  }

  // Gate 3 (specific) — invalidation rule must be user_confirmed
  const invalidationField = draft.intake_fields.find(
    (f) => f.name === "invalidation_rule",
  );
  if (invalidationField?.resolutionState !== "user_confirmed") {
    blockers.push("INVALIDATION_RULE_MISSING");
  }

  // Gate 2 (generic) — all other required_for_deploy fields must be user_confirmed
  // The invalidation_rule field is handled by the specific gate above.
  const unconfirmedRequired = draft.intake_fields.filter(
    (f) =>
      f.operationalClass === "required_for_deploy" &&
      f.resolutionState !== "user_confirmed" &&
      f.name !== "invalidation_rule",
  );
  if (unconfirmedRequired.length > 0) {
    blockers.push("PARAMETERS_NOT_CONFIRMED");
  }

  // Gate 4 — stop loss must be a finite number
  const stop = draft.plan?.stop;
  if (stop == null || typeof stop !== "number" || !isFinite(stop)) {
    blockers.push("STOP_LOSS_MISSING");
  }

  // Gate 5 — entry price must be a finite number
  const entry = draft.plan?.entry;
  if (entry == null || typeof entry !== "number" || !isFinite(entry)) {
    blockers.push("ENTRY_PRICE_MISSING");
  }

  // Gate 6 — risk_pct must be in (0, 4]
  const risk = draft.plan?.risk_pct;
  if (risk == null || typeof risk !== "number" || risk <= 0 || risk > 4) {
    blockers.push("RISK_NOT_SET");
  }

  // Gate 7 — portfolio heat cap (reuses existing 12% rule from validation.ts)
  if (typeof risk === "number" && risk > 0) {
    const { allowed } = validatePortfolioHeat(context.currentPortfolioHeatPct, risk / 100);
    if (!allowed) {
      blockers.push("HEAT_CAP_EXCEEDED");
    }
  }

  // Gate 8 — challenge must have been run at least once
  if (!draft.challenge_result) {
    blockers.push("CHALLENGE_NOT_RUN");
  } else {
    // Gate 9 — no required_for_deploy field may be in 'challenged' state
    const requiredFieldIds = new Set(
      draft.intake_fields
        .filter((f) => f.operationalClass === "required_for_deploy")
        .map((f) => f.id),
    );
    const hasChallengedRequired = draft.challenge_result.fields.some(
      (cf) =>
        cf.challengeState === "challenged" && requiredFieldIds.has(cf.fieldId),
    );
    if (hasChallengedRequired) {
      blockers.push("CHALLENGE_FAILED");
    }
  }

  return { ready: blockers.length === 0, blockers };
}
