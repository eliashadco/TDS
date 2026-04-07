CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  ticker TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('LONG','SHORT')),
  asset_class TEXT NOT NULL DEFAULT 'Equity',
  mode TEXT NOT NULL,
  setup_types TEXT[] DEFAULT '{}',
  conditions TEXT[] DEFAULT '{}',
  chart_pattern TEXT DEFAULT 'None',
  thesis TEXT NOT NULL,
  catalyst_window TEXT,
  invalidation TEXT NOT NULL,

  scores JSONB NOT NULL DEFAULT '{}',
  notes JSONB NOT NULL DEFAULT '{}',
  f_score INTEGER NOT NULL DEFAULT 0,
  t_score INTEGER NOT NULL DEFAULT 0,
  f_total INTEGER NOT NULL DEFAULT 0,
  t_total INTEGER NOT NULL DEFAULT 0,

  conviction TEXT,
  risk_pct NUMERIC,
  entry_price NUMERIC,
  stop_loss NUMERIC,
  shares INTEGER DEFAULT 0,
  tranche1_shares INTEGER DEFAULT 0,
  tranche2_shares INTEGER DEFAULT 0,
  tranche2_filled BOOLEAN DEFAULT false,
  tranche2_deadline TIMESTAMPTZ,

  exit_t1 BOOLEAN DEFAULT false,
  exit_t2 BOOLEAN DEFAULT false,
  exit_t3 BOOLEAN DEFAULT false,
  exit_price NUMERIC,
  r2_target NUMERIC,
  r4_target NUMERIC,

  market_price NUMERIC,

  confirmed BOOLEAN NOT NULL DEFAULT false,
  closed BOOLEAN NOT NULL DEFAULT false,
  closed_at TIMESTAMPTZ,
  closed_reason TEXT,
  source TEXT NOT NULL DEFAULT 'thesis'
    CHECK (source IN ('thesis','marketwatch')),

  journal_entry TEXT DEFAULT '',
  journal_exit TEXT DEFAULT '',
  journal_post TEXT DEFAULT '',

  insight JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(user_id, closed, confirmed);
CREATE INDEX IF NOT EXISTS idx_trades_ticker ON trades(user_id, ticker);
