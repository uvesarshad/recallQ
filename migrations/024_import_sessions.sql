CREATE TABLE IF NOT EXISTS import_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (
    source IN ('browser_html', 'pocket', 'omnivore', 'linkwarden', 'csv', 'json')
  ),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'previewing', 'importing', 'succeeded', 'failed', 'cancelled')
  ),
  file_name TEXT,
  total_count INTEGER NOT NULL DEFAULT 0 CHECK (total_count >= 0),
  processed_count INTEGER NOT NULL DEFAULT 0 CHECK (processed_count >= 0),
  imported_count INTEGER NOT NULL DEFAULT 0 CHECK (imported_count >= 0),
  duplicate_count INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  error_summary TEXT,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_session_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_session_id UUID NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  source_id TEXT,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'imported', 'duplicate', 'failed', 'skipped')
  ),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_sessions_user_created
  ON import_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_import_sessions_status
  ON import_sessions(status, created_at ASC)
  WHERE status IN ('pending', 'previewing', 'importing');

CREATE INDEX IF NOT EXISTS idx_import_session_items_session
  ON import_session_items(import_session_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_import_session_items_item
  ON import_session_items(item_id)
  WHERE item_id IS NOT NULL;
