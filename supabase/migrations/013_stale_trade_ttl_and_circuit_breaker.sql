-- 013: Stale Blocked Trade Cleanup + Circuit Breaker Hardening
-- Fixes two edge cases identified in TRD v2 §12 and §22.2 assessment.

-- 1. TTL for stale "blocked" trades (§22.2 Override Lifecycle)
-- If a user's connection drops between trade insert (state=blocked) and
-- the override API call, we get an orphaned blocked trade.
-- This function reverts blocked trades older than 10 minutes back to "initiated".

CREATE OR REPLACE FUNCTION cleanup_stale_blocked_trades()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE trades
  SET state = 'initiated',
      classification = 'in_policy',
      updated_at = now()
  WHERE state = 'blocked'
    AND updated_at < now() - INTERVAL '10 minutes';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- 2. Add peak_equity column to profiles for accurate drawdown calculation.
-- Circuit breaker drawdown is computed on CLOSED TRADE EQUITY only (§20 constraint).
-- peak_equity tracks the highest recorded equity from closed trades.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS peak_equity NUMERIC NOT NULL DEFAULT 0;

-- Backfill peak_equity to current equity for existing rows
UPDATE profiles SET peak_equity = GREATEST(equity, peak_equity) WHERE peak_equity = 0 AND equity > 0;
