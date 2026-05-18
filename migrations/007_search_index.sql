-- Persisted tsvector column for fast full-text search.
-- Replaces inline to_tsvector() computation on every query.
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS tsv tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(raw_text, '')), 'C')
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_items_tsv ON items USING GIN(tsv);
