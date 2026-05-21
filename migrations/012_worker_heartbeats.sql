-- Liveness tracking for the background workers. Each worker upserts its row
-- every 30 seconds; the /api/v1/health endpoint reads from this table and
-- reports a worker as `down` when its heartbeat is older than 5 minutes.

CREATE TABLE IF NOT EXISTS worker_heartbeats (
  worker_name        TEXT PRIMARY KEY,
  last_heartbeat_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  pid                INTEGER,
  hostname           TEXT
);
