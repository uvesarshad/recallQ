CREATE TABLE IF NOT EXISTS smart_saved_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL CHECK (length(query) > 0 AND length(query) <= 500),
  mode TEXT NOT NULL DEFAULT 'hybrid' CHECK (mode IN ('hybrid', 'fulltext', 'semantic')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_smart_saved_searches_user_created
  ON smart_saved_searches(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_smart_saved_searches_user_name
  ON smart_saved_searches(user_id, lower(name));
