import type { QueryResultRow } from "pg";

export const ENRICHMENT_BATCH_SIZE = 5;
export const MAX_ENRICHMENT_ATTEMPTS = 5;
export const ENRICHMENT_STALE_LOCK_SECONDS = 15 * 60;
export const ENRICHMENT_RETRY_BASE_SECONDS = 60;
export const ENRICHMENT_RETRY_MAX_SECONDS = 60 * 60;
export const MAX_ENRICHMENT_ERROR_LENGTH = 1000;

export type EnrichmentStatus = "pending" | "processing" | "retrying" | "enriched" | "failed";

export type EnrichmentClaimItem = QueryResultRow & {
  id: string;
  user_id: string;
  type: "url" | "text" | "file" | "note";
  raw_url: string | null;
  url_host: string | null;
  raw_text: string | null;
  file_path: string | null;
  file_name: string | null;
  file_mime_type: string | null;
  capture_note: string | null;
  title: string | null;
  enrichment_attempt_count: number;
};

type QueryResult<T extends QueryResultRow> = {
  rows: T[];
  rowCount?: number | null;
};

export type EnrichmentClaimDb = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
};

export function formatEnrichmentError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, MAX_ENRICHMENT_ERROR_LENGTH);
}

export async function claimEnrichmentItems(
  db: EnrichmentClaimDb,
  batchSize = ENRICHMENT_BATCH_SIZE,
) {
  const result = await db.query<EnrichmentClaimItem>(
    `WITH candidate_items AS (
       SELECT id
       FROM items
       WHERE enriched = FALSE
         AND enrichment_attempt_count < $2
         AND (
           enrichment_status = 'pending'
           OR (
             enrichment_status = 'retrying'
             AND (
               enrichment_locked_at IS NULL
               OR enrichment_locked_at <= NOW() - (
                 LEAST($4, POWER(2, LEAST(enrichment_attempt_count, 10))::int * $5)
                 * INTERVAL '1 second'
               )
             )
           )
           OR (
             enrichment_status = 'processing'
             AND (
               enrichment_locked_at IS NULL
               OR enrichment_locked_at <= NOW() - ($3 * INTERVAL '1 second')
             )
           )
         )
       ORDER BY created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE items
     SET enrichment_status = 'processing',
         enrichment_locked_at = NOW(),
         updated_at = NOW()
     FROM candidate_items
     WHERE items.id = candidate_items.id
     RETURNING items.id,
               items.user_id,
               items.type,
               items.raw_url,
               items.url_host,
               items.raw_text,
               items.file_path,
               items.file_name,
               items.file_mime_type,
               items.capture_note,
               items.title,
               items.enrichment_attempt_count`,
    [
      batchSize,
      MAX_ENRICHMENT_ATTEMPTS,
      ENRICHMENT_STALE_LOCK_SECONDS,
      ENRICHMENT_RETRY_MAX_SECONDS,
      ENRICHMENT_RETRY_BASE_SECONDS,
    ],
  );

  return result.rows;
}

export async function markEnrichmentSucceeded(db: EnrichmentClaimDb, itemId: string) {
  await db.query(
    `UPDATE items
     SET enrichment_status = 'enriched',
         enrichment_locked_at = NULL,
         enrichment_last_error = NULL,
         enriched = TRUE,
         enriched_at = COALESCE(enriched_at, NOW()),
         updated_at = NOW()
     WHERE id = $1`,
    [itemId],
  );
}

export async function markEnrichmentFailed(
  db: EnrichmentClaimDb,
  itemId: string,
  error: unknown,
) {
  const result = await db.query<{
    enrichment_status: EnrichmentStatus;
    enrichment_attempt_count: number;
  }>(
    `UPDATE items
     SET enrichment_attempt_count = enrichment_attempt_count + 1,
         enrichment_status = CASE
           WHEN enrichment_attempt_count + 1 >= $3 THEN 'failed'
           ELSE 'retrying'
         END,
         enrichment_locked_at = NOW(),
         enrichment_last_error = $2,
         updated_at = NOW()
     WHERE id = $1
     RETURNING enrichment_status, enrichment_attempt_count`,
    [itemId, formatEnrichmentError(error), MAX_ENRICHMENT_ATTEMPTS],
  );

  return result.rows[0] ?? null;
}
