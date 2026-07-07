CREATE TABLE IF NOT EXISTS archive_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (
    kind IN ('html', 'screenshot', 'pdf', 'original_file', 'extracted_text', 'thumbnail')
  ),
  status TEXT NOT NULL DEFAULT 'available' CHECK (
    status IN ('pending', 'available', 'failed', 'deleted')
  ),
  file_path TEXT,
  content_type TEXT,
  byte_size BIGINT NOT NULL DEFAULT 0 CHECK (byte_size >= 0),
  content_hash TEXT,
  source_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  captured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_archive_assets_item_kind
  ON archive_assets(item_id, kind);

CREATE INDEX IF NOT EXISTS idx_archive_assets_user_created
  ON archive_assets(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_archive_assets_item_kind_hash
  ON archive_assets(item_id, kind, content_hash)
  WHERE content_hash IS NOT NULL;
