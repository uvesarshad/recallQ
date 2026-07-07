CREATE TABLE IF NOT EXISTS rss_feeds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  poll_interval_minutes INTEGER NOT NULL DEFAULT 60 CHECK (poll_interval_minutes >= 15),
  last_fetched_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  next_fetch_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, url)
);

CREATE TABLE IF NOT EXISTS rss_feed_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feed_id UUID NOT NULL REFERENCES rss_feeds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  entry_key TEXT NOT NULL,
  url TEXT,
  title TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(feed_id, entry_key)
);

CREATE INDEX IF NOT EXISTS idx_rss_feeds_due
  ON rss_feeds(next_fetch_at ASC)
  WHERE enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_rss_feeds_user
  ON rss_feeds(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rss_feed_entries_feed
  ON rss_feed_entries(feed_id, created_at DESC);
