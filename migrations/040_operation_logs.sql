CREATE TABLE IF NOT EXISTS operation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  operation TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed', 'skipped')),
  attempt_count INTEGER CHECK (attempt_count IS NULL OR attempt_count >= 0),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  input_chars INTEGER CHECK (input_chars IS NULL OR input_chars >= 0),
  output_chars INTEGER CHECK (output_chars IS NULL OR output_chars >= 0),
  estimated_input_tokens INTEGER CHECK (estimated_input_tokens IS NULL OR estimated_input_tokens >= 0),
  estimated_output_tokens INTEGER CHECK (estimated_output_tokens IS NULL OR estimated_output_tokens >= 0),
  crawl_bytes INTEGER CHECK (crawl_bytes IS NULL OR crawl_bytes >= 0),
  failure_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operation_logs_item_created
  ON operation_logs(item_id, created_at DESC)
  WHERE item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operation_logs_job_created
  ON operation_logs(job_id, created_at DESC)
  WHERE job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operation_logs_operation_created
  ON operation_logs(operation, created_at DESC);
