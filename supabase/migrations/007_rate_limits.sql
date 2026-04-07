-- Persistent rate-limiting table (replaces in-memory Map that resets on cold start)
CREATE TABLE IF NOT EXISTS rate_limits (
  key        TEXT        PRIMARY KEY,
  count      INTEGER     NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-cleanup: drop stale rows older than 2 hours (runs every hour)
SELECT cron.schedule(
  'cleanup-rate-limits',
  '0 * * * *',
  $$DELETE FROM rate_limits WHERE window_start < now() - interval '2 hours'$$
);

-- Atomic check-and-increment function used by API routes
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max_per_hour INT DEFAULT 30
)
RETURNS TABLE(allowed BOOLEAN, retry_after_sec INT) AS $$
DECLARE
  v_count      INT;
  v_window     TIMESTAMPTZ;
  v_now        TIMESTAMPTZ := now();
BEGIN
  -- Upsert: insert or fetch existing
  INSERT INTO rate_limits (key, count, window_start)
  VALUES (p_key, 1, v_now)
  ON CONFLICT (key) DO NOTHING;

  SELECT count, window_start INTO v_count, v_window
  FROM rate_limits WHERE key = p_key FOR UPDATE;

  -- Window expired → reset
  IF v_now - v_window >= interval '1 hour' THEN
    UPDATE rate_limits SET count = 1, window_start = v_now WHERE key = p_key;
    allowed := true;
    retry_after_sec := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Over limit
  IF v_count >= p_max_per_hour THEN
    allowed := false;
    retry_after_sec := EXTRACT(EPOCH FROM (v_window + interval '1 hour' - v_now))::INT;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Increment
  UPDATE rate_limits SET count = count + 1 WHERE key = p_key;
  allowed := true;
  retry_after_sec := 0;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;
