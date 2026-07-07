CREATE TABLE IF NOT EXISTS ai_prompt_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  enrichment_instructions TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (enrichment_instructions IS NULL OR char_length(enrichment_instructions) <= 1200)
);
