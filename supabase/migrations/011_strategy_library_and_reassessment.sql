ALTER TABLE user_strategies ADD COLUMN IF NOT EXISTS ai_instruction TEXT;

CREATE TABLE IF NOT EXISTS user_trade_structure_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('setup_type', 'condition', 'chart_pattern')),
  label TEXT NOT NULL,
  family TEXT NOT NULL DEFAULT 'Custom',
  detail TEXT NOT NULL DEFAULT '',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_trade_structure_items_user_type_label
  ON user_trade_structure_items (user_id, item_type, lower(label));

CREATE INDEX IF NOT EXISTS idx_user_trade_structure_items_user_type_created
  ON user_trade_structure_items (user_id, item_type, created_at DESC);

ALTER TABLE user_trade_structure_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own shared structure items" ON user_trade_structure_items;
CREATE POLICY "Users own shared structure items" ON user_trade_structure_items
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'watchlist_items_user_id_ticker_direction_key'
      AND table_name = 'watchlist_items'
  ) THEN
    ALTER TABLE watchlist_items DROP CONSTRAINT watchlist_items_user_id_ticker_direction_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'watchlist_items_user_id_strategy_id_ticker_direction_key'
      AND table_name = 'watchlist_items'
  ) THEN
    ALTER TABLE watchlist_items
      ADD CONSTRAINT watchlist_items_user_id_strategy_id_ticker_direction_key
      UNIQUE (user_id, strategy_id, ticker, direction);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_watchlist_items_user_mode_strategy_flagged
  ON watchlist_items (user_id, mode, strategy_id, flagged_at DESC);