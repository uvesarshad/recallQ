ALTER TABLE archive_assets
  ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cleanup_reason TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'archive_assets_kind_check'
  ) THEN
    ALTER TABLE archive_assets
      DROP CONSTRAINT archive_assets_kind_check;
  END IF;

  ALTER TABLE archive_assets
    ADD CONSTRAINT archive_assets_kind_check
    CHECK (
      kind IN ('html', 'screenshot', 'pdf', 'original_file', 'extracted_text', 'thumbnail', 'video')
    );
END $$;

CREATE INDEX IF NOT EXISTS idx_archive_assets_retention_due
  ON archive_assets(retention_expires_at, created_at)
  WHERE status <> 'deleted';

CREATE INDEX IF NOT EXISTS idx_archive_assets_deleted
  ON archive_assets(deleted_at)
  WHERE status = 'deleted';
