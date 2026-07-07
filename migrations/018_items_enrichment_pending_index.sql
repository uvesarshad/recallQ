CREATE INDEX IF NOT EXISTS idx_items_pending_enrichment
  ON items(created_at ASC)
  WHERE enriched = false;
