-- Fixed-window rate-limit counter used by apps/web/lib/rate-limit.ts. One row
-- per bucket key (e.g. `auth-tokens:ip:1.2.3.4`, `chat:user:<uuid>`); the
-- helper does an atomic INSERT ... ON CONFLICT that either bumps the counter
-- or resets the window, then checks whether the new count exceeds the limit.
--
-- Old rows can be GC'd by a periodic `DELETE FROM rate_limits WHERE
-- window_started_at < now() - interval '1 day'` cron, but the table stays
-- small enough that we'll postpone that until it matters.

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key          TEXT PRIMARY KEY,
  count               INTEGER NOT NULL DEFAULT 0,
  window_started_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window
  ON rate_limits (window_started_at);
