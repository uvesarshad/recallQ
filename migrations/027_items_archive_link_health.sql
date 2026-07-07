ALTER TABLE items
  ADD COLUMN IF NOT EXISTS archive_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archive_status TEXT NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS archive_last_error TEXT,
  ADD COLUMN IF NOT EXISTS archive_last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS link_last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS link_http_status INTEGER,
  ADD COLUMN IF NOT EXISTS link_broken BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS link_failure_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'items_archive_status_check'
  ) THEN
    ALTER TABLE items
      ADD CONSTRAINT items_archive_status_check
      CHECK (archive_status IN ('not_requested', 'pending', 'processing', 'available', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_items_archive_status
  ON items(user_id, archive_status, archive_requested_at DESC)
  WHERE archive_status <> 'not_requested';

CREATE INDEX IF NOT EXISTS idx_items_link_broken
  ON items(user_id, link_broken, link_last_checked_at DESC)
  WHERE raw_url IS NOT NULL;
