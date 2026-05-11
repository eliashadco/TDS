-- 015_trade_workflow_spine.sql
-- V4 non-scoring workflow tables.
-- Depends on: 001_profiles, 003_trades, 010_first_class_strategies
--
-- HARD RULES (canon §2.1):
--   • No score, verdict, readiness_score, or assessment_drift columns anywhere in this migration.
--   • Every new table has RLS enabled with a user-scoped policy.
--   • trade_events is append-only (enforced in application layer via server-only command module).

-- ============================================================
-- trade_drafts
-- Staged ideas, planning state, blockers, lineage.
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  ticker TEXT NOT NULL DEFAULT '',
  direction TEXT CHECK (direction IN ('LONG', 'SHORT')),
  mode TEXT,
  strategy_id UUID REFERENCES user_strategies(id) ON DELETE SET NULL,

  state TEXT NOT NULL DEFAULT 'observed'
    CHECK (state IN ('observed', 'qualified', 'planned', 'ready', 'deployed', 'archived')),

  draft_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- intake_fields is an array of DraftIntakeField objects (types/draft.ts §5.2)
  -- Each field carries: id, scope, operationalClass, provenance, resolutionState, challengeState, value
  intake_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- blockers is an array of BlockerCode strings
  blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- plan holds entry, stop, targets, risk_pct, sl_proximity, execution_intent
  plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- last result from POST /api/drafts/[id]/challenge
  challenge_result JSONB,

  parent_draft_id UUID REFERENCES trade_drafts(id) ON DELETE SET NULL,
  deployed_trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,

  -- Reserved: populated when Phase 1 prop-firm tables (migration 018) are applied.
  firm_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_drafts_user_state
  ON trade_drafts(user_id, state);
CREATE INDEX IF NOT EXISTS idx_trade_drafts_user_created
  ON trade_drafts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_drafts_deployed_trade
  ON trade_drafts(deployed_trade_id)
  WHERE deployed_trade_id IS NOT NULL;

ALTER TABLE trade_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own trade drafts" ON trade_drafts;
CREATE POLICY "Users own trade drafts" ON trade_drafts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- trade_events  (append-only workflow audit log)
-- entity_id references trade_drafts.id or trades.id — no FK
-- because the reference is polymorphic on entity_type.
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('draft', 'trade')),
  entity_id UUID NOT NULL,
  -- Canonical event types (non-exhaustive — application layer validates):
  -- draft.created, draft.intake_extracted, draft.field_confirmed,
  -- draft.planned, draft.challenged, draft.ready, draft.archived,
  -- trade.deployed, trade.monitor_check, trade.silent_update,
  -- trade.alert_fired, trade.closed, trade.reviewed
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_events_entity
  ON trade_events(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_events_user_created
  ON trade_events(user_id, created_at DESC);

ALTER TABLE trade_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own trade events" ON trade_events;
CREATE POLICY "Users own trade events" ON trade_events
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- trade_reviews
-- Structured post-trade review records.
-- One review per trade (UNIQUE constraint).
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,

  execution_adherence TEXT
    CHECK (execution_adherence IN ('clean', 'minor_deviation', 'major_deviation')),
  deviation_tag TEXT,
  override_present BOOLEAN NOT NULL DEFAULT false,
  -- Numeric R-value representing the cost of overriding the frozen plan
  override_r_cost NUMERIC,
  -- Estimated exit if the platform rule had been followed exactly
  rule_based_exit_estimate JSONB,
  lesson TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(trade_id)
);

CREATE INDEX IF NOT EXISTS idx_trade_reviews_user
  ON trade_reviews(user_id, created_at DESC);

ALTER TABLE trade_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own trade reviews" ON trade_reviews;
CREATE POLICY "Users own trade reviews" ON trade_reviews
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- workflow_tasks
-- Due actions derived from workflow state.
-- Source of truth for dashboard Act Now items (canon §7.1).
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Allowed task_type values: 'draft_due', 'review_due', 'monitor_check_due', 'blocker_clear'
  task_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  due_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_workflow_tasks_user_due
  ON workflow_tasks(user_id, due_at)
  WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_entity
  ON workflow_tasks(entity_type, entity_id)
  WHERE completed_at IS NULL;

ALTER TABLE workflow_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own workflow tasks" ON workflow_tasks;
CREATE POLICY "Users own workflow tasks" ON workflow_tasks
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- strategy_parameter_definitions
-- Per-strategy typed fields with comparison semantics,
-- source expectations, and lock behaviour.
-- ============================================================
CREATE TABLE IF NOT EXISTS strategy_parameter_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES user_strategies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('numeric', 'price', 'level', 'enum', 'text', 'boolean')),
  operational_class TEXT NOT NULL
    CHECK (operational_class IN ('informational', 'required_for_deploy', 'required_for_monitoring')),
  scope TEXT NOT NULL
    CHECK (scope IN ('context', 'contract', 'risk', 'execution')),
  -- e.g. { "operator": "<=", "tolerance_pct": 0.5 }
  comparison_semantics JSONB,
  -- array of allowed evidence source labels (canon §8.4 whitelist)
  source_expectations JSONB,
  lock_behaviour TEXT NOT NULL DEFAULT 'lock_on_confirm'
    CHECK (lock_behaviour IN ('lock_on_deploy', 'lock_on_confirm', 'soft')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strategy_param_defs_strategy
  ON strategy_parameter_definitions(strategy_id);

ALTER TABLE strategy_parameter_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own strategy parameter definitions" ON strategy_parameter_definitions;
CREATE POLICY "Users own strategy parameter definitions" ON strategy_parameter_definitions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_strategies
      WHERE user_strategies.id = strategy_parameter_definitions.strategy_id
        AND user_strategies.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_strategies
      WHERE user_strategies.id = strategy_parameter_definitions.strategy_id
        AND user_strategies.user_id = auth.uid()
    )
  );

-- ============================================================
-- trade_parameter_values
-- Resolved values locked onto one draft or trade at deploy.
-- At least one of trade_id / draft_id must be non-null.
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_parameter_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  draft_id UUID REFERENCES trade_drafts(id) ON DELETE CASCADE,
  parameter_definition_id UUID NOT NULL
    REFERENCES strategy_parameter_definitions(id) ON DELETE RESTRICT,
  value JSONB NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provenance TEXT NOT NULL
    CHECK (provenance IN ('user', 'ai_extract', 'ai_suggest', 'market_derived')),

  CONSTRAINT trade_or_draft_required
    CHECK (trade_id IS NOT NULL OR draft_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_trade_param_values_trade
  ON trade_parameter_values(trade_id)
  WHERE trade_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trade_param_values_draft
  ON trade_parameter_values(draft_id)
  WHERE draft_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trade_param_values_definition
  ON trade_parameter_values(parameter_definition_id);

ALTER TABLE trade_parameter_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own trade parameter values" ON trade_parameter_values;
CREATE POLICY "Users own trade parameter values" ON trade_parameter_values
  FOR ALL USING (
    (
      trade_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM trades
        WHERE trades.id = trade_parameter_values.trade_id
          AND trades.user_id = auth.uid()
      )
    ) OR (
      draft_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM trade_drafts
        WHERE trade_drafts.id = trade_parameter_values.draft_id
          AND trade_drafts.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    (
      trade_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM trades
        WHERE trades.id = trade_parameter_values.trade_id
          AND trades.user_id = auth.uid()
      )
    ) OR (
      draft_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM trade_drafts
        WHERE trade_drafts.id = trade_parameter_values.draft_id
          AND trade_drafts.user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- trade_evidence_records
-- Provider-sourced evidence attached to a trade or draft.
-- Only sources from the canon §8.4 whitelist are permitted
-- (enforced in application layer).
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_evidence_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  draft_id UUID REFERENCES trade_drafts(id) ON DELETE CASCADE,
  -- e.g. 'polygon', 'yahoo', 'reuters', 'sec_edgar', 'company_ir'
  provider TEXT NOT NULL,
  source_label TEXT NOT NULL,
  citation_url TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  normalized_payload JSONB NOT NULL,
  -- true = routine update (silent); false = user-facing evidence
  silent_update BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_trade_evidence_trade
  ON trade_evidence_records(trade_id, captured_at DESC)
  WHERE trade_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trade_evidence_draft
  ON trade_evidence_records(draft_id, captured_at DESC)
  WHERE draft_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trade_evidence_user
  ON trade_evidence_records(user_id, captured_at DESC);

ALTER TABLE trade_evidence_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own trade evidence records" ON trade_evidence_records;
CREATE POLICY "Users own trade evidence records" ON trade_evidence_records
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- trade_monitoring_rules
-- Per-trade monitoring cadence and alert routing.
-- One rule set per trade (UNIQUE constraint).
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_monitoring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  -- Cadence in seconds; default 86400 = 24h
  cadence_seconds INTEGER NOT NULL DEFAULT 86400,
  -- Structured invalidation rules (array of condition objects)
  invalidation_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Thresholds below which a change is treated as silent (not critical)
  silent_update_thresholds JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Maps alert_type → delivery channel config
  critical_alert_routing JSONB NOT NULL DEFAULT '{}'::jsonb,
  next_parameter_check_at TIMESTAMPTZ,
  last_parameter_check_at TIMESTAMPTZ,
  last_parameter_check_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(trade_id)
);

CREATE INDEX IF NOT EXISTS idx_trade_monitoring_next_check
  ON trade_monitoring_rules(next_parameter_check_at)
  WHERE next_parameter_check_at IS NOT NULL;

ALTER TABLE trade_monitoring_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own trade monitoring rules" ON trade_monitoring_rules;
CREATE POLICY "Users own trade monitoring rules" ON trade_monitoring_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_monitoring_rules.trade_id
        AND trades.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_monitoring_rules.trade_id
        AND trades.user_id = auth.uid()
    )
  );

-- ============================================================
-- trade_monitor_checks  (history of compliance checks)
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_monitor_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- { compliant: bool, breaches: [...], evidence_ids: [...] }
  result JSONB NOT NULL,
  -- null = no alert fired; non-null = one of four permitted alert types (canon §10.1)
  alert_fired TEXT
    CHECK (alert_fired IN ('invalidation_breached', 'sl_hit', 'target_hit', 'sl_proximity'))
);

CREATE INDEX IF NOT EXISTS idx_trade_monitor_checks_trade
  ON trade_monitor_checks(trade_id, ran_at DESC);

ALTER TABLE trade_monitor_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own trade monitor checks" ON trade_monitor_checks;
CREATE POLICY "Users own trade monitor checks" ON trade_monitor_checks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_monitor_checks.trade_id
        AND trades.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_monitor_checks.trade_id
        AND trades.user_id = auth.uid()
    )
  );

-- ============================================================
-- trade_silent_updates
-- Routine monitor results written as timeline entries.
-- These never trigger push notifications (canon §10.1).
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_silent_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  kind TEXT NOT NULL
    CHECK (kind IN ('context_change', 'price_drift', 'news', 'parameter_drift')),
  summary TEXT NOT NULL,
  evidence_id UUID REFERENCES trade_evidence_records(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_silent_updates_trade
  ON trade_silent_updates(trade_id, created_at DESC);

ALTER TABLE trade_silent_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own trade silent updates" ON trade_silent_updates;
CREATE POLICY "Users own trade silent updates" ON trade_silent_updates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_silent_updates.trade_id
        AND trades.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_silent_updates.trade_id
        AND trades.user_id = auth.uid()
    )
  );

-- ============================================================
-- Add V4 columns to trades
-- ============================================================
-- Lineage: which draft produced this live trade
ALTER TABLE trades ADD COLUMN IF NOT EXISTS lineage_draft_id UUID
  REFERENCES trade_drafts(id) ON DELETE SET NULL;

-- Denormalized convenience for the edge function query
-- (authoritative values also live in trade_monitoring_rules)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS next_parameter_check_at TIMESTAMPTZ;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS last_parameter_check_at TIMESTAMPTZ;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS last_parameter_check_result JSONB;

-- Reserved for Phase 1 prop-firm layer (no FK until migration 018 creates firm_accounts)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS firm_id UUID;

CREATE INDEX IF NOT EXISTS idx_trades_lineage_draft
  ON trades(lineage_draft_id)
  WHERE lineage_draft_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trades_next_param_check
  ON trades(next_parameter_check_at)
  WHERE next_parameter_check_at IS NOT NULL AND closed = false;
