-- Tiny base64-encoded JPEG that `next/image` uses as a `placeholder="blur"`
-- background until the real preview image loads. Computed once during
-- enrichment via `sharp` (see apps/web/workers/enrichment-worker.ts) and
-- stored alongside the existing `image_url`. ~200-400 bytes per item.

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS blur_data_url TEXT;
