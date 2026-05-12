/**
 * Field-level provenance model — canon §5.2.
 * Implements the three-state parameter provenance model. IP filing reference: TDS-IP-001 (Phase 0).
 *
 * Every intake field carries its own lifecycle, independent of the coarse draft state.
 * The UI uses this to distinguish extracted candidates, suggested values, missing values,
 * and confirmed contract values.
 */

// ---------------------------------------------------------------------------
// Primitive union types (canon §5.2)
// ---------------------------------------------------------------------------

/** Where a field value came from. */
export type Provenance = 'user' | 'ai_extract' | 'ai_suggest' | 'market_derived';

/** Which intake lane owns the field. */
export type IntakeScope = 'context' | 'contract' | 'risk' | 'execution';

/** Deployment criticality of the field. */
export type OperationalClass =
  | 'informational'
  | 'required_for_deploy'
  | 'required_for_monitoring';

/**
 * Confirmation progress of a field value.
 * AI-produced values always start as candidate_extracted or candidate_suggested.
 * Only explicit trader action sets user_confirmed (Hard Rule 5).
 */
export type ResolutionState =
  | 'candidate_extracted'
  | 'candidate_suggested'
  | 'needs_user_value'
  | 'user_confirmed';

/** Pre-deploy market verification state of a field. */
export type ChallengeState =
  | 'not_checked'
  | 'confirmed'
  | 'challenged'
  | 'not_comparable';

/** Coarse draft lifecycle state (canon §5.1). */
export type DraftState =
  | 'observed'
  | 'qualified'
  | 'planned'
  | 'ready'
  | 'deployed'
  | 'archived';

// ---------------------------------------------------------------------------
// Blocker codes — deterministic deploy gates (canon §5 / lib/trading/guards.ts)
// ---------------------------------------------------------------------------

export type BlockerCode =
  | 'STRATEGY_NOT_SELECTED'
  | 'PARAMETERS_NOT_CONFIRMED'
  | 'INVALIDATION_RULE_MISSING'
  | 'STOP_LOSS_MISSING'
  | 'ENTRY_PRICE_MISSING'
  | 'RISK_NOT_SET'
  | 'HEAT_CAP_EXCEEDED'
  | 'CHALLENGE_NOT_RUN'
  | 'CHALLENGE_FAILED';

// ---------------------------------------------------------------------------
// DraftIntakeField — core unit of the provenance model
// ---------------------------------------------------------------------------

/**
 * A single intake field with its full lifecycle state.
 * T is the type of the field value (e.g. number for price levels, string for text).
 */
export interface DraftIntakeField<T = unknown> {
  /** Stable identifier scoped to (draft, parameterDefinitionId or well-known name). */
  id: string;
  /** References strategy_parameter_definitions.id — null for context fields without a definition. */
  parameterDefinitionId: string | null;
  /** Human-readable field label. */
  name: string;
  scope: IntakeScope;
  operationalClass: OperationalClass;
  provenance: Provenance;
  resolutionState: ResolutionState;
  challengeState: ChallengeState;
  /** The resolved or candidate value. Null when resolutionState is needs_user_value. */
  value: T | null;
  /** Alternative candidate values the trader can pick from before confirming. */
  candidateValues?: T[];
  /** IDs of trade_evidence_records that support this field's value. */
  evidenceIds?: string[];
  notes?: string;
}

// ---------------------------------------------------------------------------
// DraftIntakeSession — full intake state for a draft
// ---------------------------------------------------------------------------

export interface DraftIntakeSession {
  draftId: string;
  fields: DraftIntakeField[];
  blockers: BlockerCode[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// API response shapes (canon §7.1 / §7.2)
// ---------------------------------------------------------------------------

/**
 * Response from POST /api/drafts/[id]/challenge.
 * Replaces the legacy /api/drafts/[id]/score route.
 */
export interface DraftChallengeResponse {
  draftId: string;
  ranAt: string;
  fields: Array<{
    fieldId: string;
    challengeState: ChallengeState;
    detail?: string;
    evidenceId?: string;
  }>;
  blockers: BlockerCode[];
}

/**
 * Response from POST /api/ai/extract-params.
 * Replaces the legacy /api/ai/assess route.
 *
 * HARD RULE 5: every field in this response MUST have
 * resolutionState ∈ { candidate_extracted, candidate_suggested }.
 * The server enforces this — the client must never assume user_confirmed.
 */
export interface ExtractParamsResponse {
  draftId: string;
  fields: DraftIntakeField[];
  notes?: string;
}

/**
 * Minimal draft row shape returned by GET /api/drafts/[id].
 * Full DB row type lives in types/database.ts.
 */
export interface DraftSummary {
  id: string;
  userId: string;
  ticker: string;
  direction: 'LONG' | 'SHORT' | null;
  mode: string | null;
  strategyId: string | null;
  state: DraftState;
  blockers: BlockerCode[];
  createdAt: string;
  updatedAt: string;
}
