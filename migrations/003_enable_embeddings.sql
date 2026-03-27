DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension unavailable, skipping embedding migration.';
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    ALTER TABLE items
    ADD COLUMN IF NOT EXISTS embedding vector(768);

    CREATE INDEX IF NOT EXISTS idx_items_embedding
    ON items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  END IF;
END $$;
