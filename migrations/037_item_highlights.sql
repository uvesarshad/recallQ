CREATE TABLE IF NOT EXISTS item_highlights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quote TEXT NOT NULL,
  note TEXT,
  color TEXT NOT NULL DEFAULT 'yellow',
  range_start INTEGER,
  range_end INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (length(trim(quote)) > 0),
  CHECK (range_start IS NULL OR range_start >= 0),
  CHECK (range_end IS NULL OR range_end >= 0),
  CHECK (range_start IS NULL OR range_end IS NULL OR range_end >= range_start),
  CHECK (color IN ('yellow', 'green', 'blue', 'pink', 'purple'))
);

CREATE INDEX IF NOT EXISTS idx_item_highlights_item
  ON item_highlights(item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_item_highlights_user_created
  ON item_highlights(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_item_highlights_quote
  ON item_highlights USING GIN (to_tsvector('english', quote || ' ' || COALESCE(note, '')));
