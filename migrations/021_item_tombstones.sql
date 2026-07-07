CREATE TABLE IF NOT EXISTS item_tombstones (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_item_tombstones_user_deleted
  ON item_tombstones(user_id, deleted_at ASC);
