-- 016_outcome_attribution.sql
-- Closed-trade attribution rows for strategy analytics and the advanced statistics pack.
-- Depends on: 015_trade_workflow_spine (trade_drafts, trade_reviews), 010_first_class_strategies
--
-- HARD RULES (canon §2.1):
--   • No score, verdict, readiness_score, or assessment_drift columns.
--   • strategy_statistics is a computed cache — never treat it as source of truth.
--   • analytics must never mix closed and open trade state (canon §11 / R5).

-- ============================================================
-- strategy_outcomes
-- One row per closed trade that completed a structured review.
-- Created by POST /api/trades/[id]/review (PR 5).
-- Powers all strategy proof surfaces (PR 7 + PR 8).
-- ============================================================
CREATE TABLE IF NOT EXISTS strategy_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  strategy_id UUID NOT NULL REFERENCES user_strategies(id) ON DELETE CASCADE,
  strategy_version_id UUID REFERENCES strategy_versions(id) ON DELETE SET NULL,

  -- Core outcome
  outcome_r NUMERIC NOT NULL,

  -- Excursion analytics (PR 8 — Advanced Statistics Pack)
  mae_r NUMERIC,     -- maximum adverse excursion in R
  mfe_r NUMERIC,     -- maximum favourable excursion in R

  -- Target touch flags (populated from trade exit events)
  touched_1r BOOLEAN NOT NULL DEFAULT false,
  touched_2r BOOLEAN NOT NULL DEFAULT false,
  touched_3r BOOLEAN NOT NULL DEFAULT false,

  -- Holding duration in minutes
  holding_minutes INTEGER,

  -- Parameter compliance attribution (PR 8 — parameter failure latency)
  first_parameter_failure_at TIMESTAMPTZ,

  -- Override cost ledger (canon §13.1)
  estimated_r_without_override NUMERIC,  -- what the rule-based exit would have produced
  had_override BOOLEAN NOT NULL DEFAULT false,
  override_r_cost NUMERIC,               -- outcome_r minus estimated_r_without_override (signed)

  -- Execution classification (mirrors trade_reviews.execution_adherence)
  execution_classification TEXT
    CHECK (execution_classification IN ('clean', 'minor_deviation', 'major_deviation')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One outcome row per trade; a re-review updates via UPDATE not INSERT
  UNIQUE(trade_id)
);

CREATE INDEX IF NOT EXISTS idx_strategy_outcomes_user_strategy_created
  ON strategy_outcomes(user_id, strategy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_strategy_outcomes_strategy
  ON strategy_outcomes(strategy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_strategy_outcomes_user
  ON strategy_outcomes(user_id, created_at DESC);

ALTER TABLE strategy_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own strategy outcomes" ON strategy_outcomes;
CREATE POLICY "Users own strategy outcomes" ON strategy_outcomes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- strategy_statistics
-- Rolled-up analytics cache keyed by strategy.
-- Recomputed by GET /api/analytics/strategy/[id] (PR 7).
-- NEVER used as the source of truth — always derived from
-- strategy_outcomes. Treat as a stale-able read cache only.
--
-- RLS: user can read/write their own strategy's cache.
-- ============================================================
CREATE TABLE IF NOT EXISTS strategy_statistics (
  strategy_id UUID PRIMARY KEY REFERENCES user_strategies(id) ON DELETE CASCADE,

  -- Sample size gate: surfaces must display a warning when sample_size < 30 (Hard Rule 9)
  sample_size INTEGER NOT NULL DEFAULT 0,

  -- Core metrics
  win_rate NUMERIC,           -- fraction of outcome_r > 0
  expectancy_r NUMERIC,       -- average outcome_r across all closed trades

  -- Excursion aggregates (PR 8)
  avg_mae_r NUMERIC,
  avg_mfe_r NUMERIC,

  -- Discipline metrics
  override_rate NUMERIC,          -- fraction of trades with had_override = true
  override_cost_total_r NUMERIC,  -- sum of override_r_cost across all trades

  -- Advanced statistics (PR 8)
  -- Median minutes from first_parameter_failure_at to trade close
  parameter_failure_latency_p50 INTEGER,
  -- Fraction of trades where price touched 2R before stop
  target_capture_efficiency NUMERIC,

  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE strategy_statistics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own strategy statistics" ON strategy_statistics;
CREATE POLICY "Users own strategy statistics" ON strategy_statistics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_strategies
      WHERE user_strategies.id = strategy_statistics.strategy_id
        AND user_strategies.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_strategies
      WHERE user_strategies.id = strategy_statistics.strategy_id
        AND user_strategies.user_id = auth.uid()
    )
  );
