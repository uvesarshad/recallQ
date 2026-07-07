ALTER TABLE items
  ADD COLUMN IF NOT EXISTS enrichment_status TEXT,
  ADD COLUMN IF NOT EXISTS enrichment_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrichment_attempt_count INTEGER,
  ADD COLUMN IF NOT EXISTS enrichment_last_error TEXT;

UPDATE items
SET enrichment_status = CASE
    WHEN enriched = TRUE THEN 'enriched'
    ELSE COALESCE(enrichment_status, 'pending')
  END,
  enrichment_attempt_count = COALESCE(enrichment_attempt_count, 0);

ALTER TABLE items
  ALTER COLUMN enrichment_status SET DEFAULT 'pending',
  ALTER COLUMN enrichment_status SET NOT NULL,
  ALTER COLUMN enrichment_attempt_count SET DEFAULT 0,
  ALTER COLUMN enrichment_attempt_count SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'items_enrichment_status_check'
  ) THEN
    ALTER TABLE items
      ADD CONSTRAINT items_enrichment_status_check
      CHECK (enrichment_status IN ('pending', 'processing', 'retrying', 'enriched', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'items_enrichment_attempt_count_check'
  ) THEN
    ALTER TABLE items
      ADD CONSTRAINT items_enrichment_attempt_count_check
      CHECK (enrichment_attempt_count >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_items_enrichment_claim
  ON items(created_at ASC)
  WHERE enriched = FALSE
    AND enrichment_status IN ('pending', 'retrying', 'processing');
