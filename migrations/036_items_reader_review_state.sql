ALTER TABLE items
  ADD COLUMN IF NOT EXISTS reading_progress INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reading_state TEXT NOT NULL DEFAULT 'unread',
  ADD COLUMN IF NOT EXISTS reader_position TEXT,
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_read_later BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reading_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reading_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS link_review_status TEXT NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS link_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS link_review_note TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'items_reading_progress_check'
  ) THEN
    ALTER TABLE items
      ADD CONSTRAINT items_reading_progress_check
      CHECK (reading_progress >= 0 AND reading_progress <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'items_reading_state_check'
  ) THEN
    ALTER TABLE items
      ADD CONSTRAINT items_reading_state_check
      CHECK (reading_state IN ('unread', 'reading', 'read'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'items_link_review_status_check'
  ) THEN
    ALTER TABLE items
      ADD CONSTRAINT items_link_review_status_check
      CHECK (link_review_status IN ('unreviewed', 'needs_review', 'retrying', 'false_positive', 'resolved'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_items_reader_state
  ON items(user_id, reading_state, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_items_read_later
  ON items(user_id, is_read_later, created_at DESC)
  WHERE is_read_later = TRUE;

CREATE INDEX IF NOT EXISTS idx_items_favorite
  ON items(user_id, is_favorite, updated_at DESC)
  WHERE is_favorite = TRUE;

CREATE INDEX IF NOT EXISTS idx_items_archived
  ON items(user_id, is_archived, updated_at DESC)
  WHERE is_archived = TRUE;

CREATE INDEX IF NOT EXISTS idx_items_link_review_queue
  ON items(user_id, link_review_status, link_last_checked_at DESC)
  WHERE raw_url IS NOT NULL AND link_broken = TRUE;
