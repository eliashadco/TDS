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
