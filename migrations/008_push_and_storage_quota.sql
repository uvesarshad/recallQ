-- Web push subscription already stored in users.push_subscription (JSONB from 001_initial.sql).
-- Add storage quota tracking.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT NOT NULL DEFAULT 0;
