-- ============================================================
-- 012: Discipline System — Trade Lifecycle, Overrides, Discipline Metrics
-- TRD v2 §4 (Discipline Profiles), §21 (Schema), §22 (State Machines)
-- ============================================================

-- 1. Trade lifecycle state (§22.1)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'initiated'
  CHECK (state IN ('initiated','evaluated','blocked','deployed','overridden','closed'));

-- 2. Trade classification (§10.2)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS classification TEXT NOT NULL DEFAULT 'in_policy'
  CHECK (classification IN ('in_policy','override','out_of_bounds'));

-- 3. Discipline profile on profiles (§4.1)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS discipline_profile TEXT NOT NULL DEFAULT 'balanced'
  CHECK (discipline_profile IN ('strict','balanced','expert'));

-- 4. Overrides table (§9, §21.1)
CREATE TABLE IF NOT EXISTS overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rules_broken TEXT[] NOT NULL DEFAULT '{}',
  justification TEXT NOT NULL,
  quality_flag TEXT NOT NULL DEFAULT 'valid'
    CHECK (quality_flag IN ('valid','low_quality','high_risk')),
  ai_audit JSONB,
  timer_duration_sec INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_overrides_trade ON overrides(trade_id);
CREATE INDEX IF NOT EXISTS idx_overrides_user ON overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_overrides_user_created ON overrides(user_id, created_at DESC);

-- 5. Discipline metrics table (§10, §21.1)
CREATE TABLE IF NOT EXISTS discipline_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES user_strategies(id) ON DELETE SET NULL,
  score NUMERIC NOT NULL DEFAULT 100,
  period TEXT NOT NULL,
  in_policy_count INTEGER NOT NULL DEFAULT 0,
  override_count INTEGER NOT NULL DEFAULT 0,
  oob_count INTEGER NOT NULL DEFAULT 0,
  pnl_in_policy NUMERIC NOT NULL DEFAULT 0,
  pnl_override NUMERIC NOT NULL DEFAULT 0,
  pnl_oob NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, strategy_id, period)
);

CREATE INDEX IF NOT EXISTS idx_discipline_metrics_user ON discipline_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_discipline_metrics_user_period ON discipline_metrics(user_id, period DESC);

-- 6. RLS policies
ALTER TABLE overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE discipline_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own overrides" ON overrides;
CREATE POLICY "Users own overrides" ON overrides
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own discipline metrics" ON discipline_metrics;
CREATE POLICY "Users own discipline metrics" ON discipline_metrics
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. Backfill existing trades: confirmed → deployed, closed → closed
UPDATE trades SET state = 'deployed' WHERE confirmed = true AND closed = false AND state = 'initiated';
UPDATE trades SET state = 'closed' WHERE closed = true AND state = 'initiated';
