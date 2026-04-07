-- ============================================================
-- TDS Full Schema Migration — Run in Supabase SQL Editor
-- Combines migrations 001-005 into a single idempotent script.
-- Migration 006 (pg_cron jobs) is separate — run AFTER enabling
-- pg_cron and pg_net extensions in Dashboard → Database → Extensions.
-- ============================================================

-- 001: Profiles
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  mode TEXT NOT NULL DEFAULT 'swing'
    CHECK (mode IN ('investment','swing','daytrade','scalp')),
  equity NUMERIC NOT NULL DEFAULT 100000,
  learn_mode BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 002: User Metrics
CREATE TABLE IF NOT EXISTS user_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  metric_id TEXT NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('fundamental','technical')),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, mode, metric_id)
);

-- 003: Trades
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

-- 004: Watchlist
CREATE TABLE IF NOT EXISTS watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('LONG','SHORT')),
  asset_class TEXT DEFAULT 'Equity',
  mode TEXT NOT NULL,
  scores JSONB DEFAULT '{}',
  verdict TEXT,
  note TEXT,
  last_scored_at TIMESTAMPTZ,
  flagged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT DEFAULT 'marketwatch',
  UNIQUE(user_id, ticker, direction)
);

-- 005: Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own profiles" ON profiles;
CREATE POLICY "Users own profiles" ON profiles
  FOR ALL USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users own metrics" ON user_metrics;
CREATE POLICY "Users own metrics" ON user_metrics
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own trades" ON trades;
CREATE POLICY "Users own trades" ON trades
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own watchlist" ON watchlist_items;
CREATE POLICY "Users own watchlist" ON watchlist_items
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
