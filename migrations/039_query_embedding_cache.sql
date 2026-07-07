CREATE TABLE IF NOT EXISTS query_embedding_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_hash TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google',
  model TEXT NOT NULL DEFAULT 'text-embedding-004',
  dimensions INTEGER NOT NULL DEFAULT 768 CHECK (dimensions > 0),
  embedding vector(768) NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0 CHECK (hit_count >= 0),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT query_embedding_cache_unique UNIQUE (query_hash, provider, model)
);

CREATE INDEX IF NOT EXISTS idx_query_embedding_cache_last_used
  ON query_embedding_cache(last_used_at DESC);

CREATE INDEX IF NOT EXISTS idx_query_embedding_cache_expires
  ON query_embedding_cache(expires_at)
  WHERE expires_at IS NOT NULL;
