CREATE TABLE IF NOT EXISTS user_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  learning_goal TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  preset_key TEXT,
  is_preset_clone BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  active_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS strategy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES user_strategies(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(strategy_id, version_number)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'user_strategies_active_version_id_fkey'
      AND table_name = 'user_strategies'
  ) THEN
    ALTER TABLE user_strategies
      ADD CONSTRAINT user_strategies_active_version_id_fkey
      FOREIGN KEY (active_version_id) REFERENCES strategy_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_strategies_user_mode ON user_strategies(user_id, mode);
CREATE INDEX IF NOT EXISTS idx_strategy_versions_strategy_created ON strategy_versions(strategy_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_strategies_default_per_mode ON user_strategies(user_id, mode) WHERE is_default = true;

ALTER TABLE user_metrics ADD COLUMN IF NOT EXISTS strategy_id UUID REFERENCES user_strategies(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'user_metrics_user_id_mode_metric_id_key'
      AND table_name = 'user_metrics'
  ) THEN
    ALTER TABLE user_metrics DROP CONSTRAINT user_metrics_user_id_mode_metric_id_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'user_metrics_user_id_strategy_id_metric_id_key'
      AND table_name = 'user_metrics'
  ) THEN
    ALTER TABLE user_metrics
      ADD CONSTRAINT user_metrics_user_id_strategy_id_metric_id_key UNIQUE (user_id, strategy_id, metric_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_metrics_strategy ON user_metrics(user_id, mode, strategy_id);

ALTER TABLE trades ADD COLUMN IF NOT EXISTS strategy_id UUID REFERENCES user_strategies(id) ON DELETE SET NULL;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS strategy_version_id UUID REFERENCES strategy_versions(id) ON DELETE SET NULL;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS strategy_name TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS strategy_snapshot JSONB;

ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS strategy_id UUID REFERENCES user_strategies(id) ON DELETE SET NULL;
ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS strategy_version_id UUID REFERENCES strategy_versions(id) ON DELETE SET NULL;
ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS strategy_name TEXT;
ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS strategy_snapshot JSONB;

ALTER TABLE user_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own strategies" ON user_strategies;
CREATE POLICY "Users own strategies" ON user_strategies
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own strategy versions" ON strategy_versions;
CREATE POLICY "Users own strategy versions" ON strategy_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM user_strategies
      WHERE user_strategies.id = strategy_versions.strategy_id
        AND user_strategies.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_strategies
      WHERE user_strategies.id = strategy_versions.strategy_id
        AND user_strategies.user_id = auth.uid()
    )
  );