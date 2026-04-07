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
