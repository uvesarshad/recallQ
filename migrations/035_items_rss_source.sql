ALTER TABLE items
  DROP CONSTRAINT IF EXISTS items_source_check;

ALTER TABLE items
  ADD CONSTRAINT items_source_check
  CHECK (source IN ('web', 'pwa-share', 'telegram', 'email', 'extension', 'mobile', 'rss', 'manual'));
