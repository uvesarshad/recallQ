ALTER TABLE items
  ADD COLUMN IF NOT EXISTS url_host TEXT;

UPDATE items
SET url_host = NULLIF(
  regexp_replace(
    regexp_replace(
      lower(split_part(split_part(split_part(raw_url, '://', 2), '/', 1), '?', 1)),
      '^www\.',
      ''
    ),
    ':\d+$',
    ''
  ),
  ''
)
WHERE raw_url IS NOT NULL
  AND url_host IS NULL;

CREATE INDEX IF NOT EXISTS idx_items_user_url_host
  ON items(user_id, url_host)
  WHERE url_host IS NOT NULL;
