import { createHash } from "crypto";

import { db } from "@/lib/db";

export const QUERY_EMBEDDING_CACHE_TTL_DAYS = 30;

type CachedEmbeddingRow = {
  embedding: string | number[];
};

type QueryEmbeddingCacheOptions = {
  provider?: string;
  model?: string;
  ttlDays?: number;
};

export function normalizeEmbeddingQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function hashQuery(normalizedQuery: string) {
  return createHash("sha256").update(normalizedQuery).digest("hex");
}

function parseVector(value: string | number[]) {
  if (Array.isArray(value)) return value.map(Number);
  return value
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isFinite(part));
}

export async function getCachedQueryEmbedding(
  query: string,
  options: QueryEmbeddingCacheOptions = {},
) {
  const normalizedQuery = normalizeEmbeddingQuery(query);
  if (!normalizedQuery) return null;

  const provider = options.provider ?? "google";
  const model = options.model ?? "text-embedding-004";
  const queryHash = hashQuery(normalizedQuery);

  try {
    const result = await db.query<CachedEmbeddingRow>(
      `UPDATE query_embedding_cache
       SET hit_count = hit_count + 1,
           last_used_at = NOW(),
           updated_at = NOW()
       WHERE query_hash = $1
         AND provider = $2
         AND model = $3
         AND (expires_at IS NULL OR expires_at > NOW())
       RETURNING embedding::text AS embedding`,
      [queryHash, provider, model],
    );

    const row = result.rows[0];
    return row ? parseVector(row.embedding) : null;
  } catch {
    return null;
  }
}

export async function setCachedQueryEmbedding(
  query: string,
  embedding: number[],
  options: QueryEmbeddingCacheOptions = {},
) {
  const normalizedQuery = normalizeEmbeddingQuery(query);
  if (!normalizedQuery || embedding.length === 0) return;

  const provider = options.provider ?? "google";
  const model = options.model ?? "text-embedding-004";
  const ttlDays = options.ttlDays ?? QUERY_EMBEDDING_CACHE_TTL_DAYS;
  const queryHash = hashQuery(normalizedQuery);

  try {
    await db.query(
      `INSERT INTO query_embedding_cache (
         query_hash,
         normalized_query,
         provider,
         model,
         dimensions,
         embedding,
         expires_at
       )
       VALUES (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6::vector,
         NOW() + ($7 * INTERVAL '1 day')
       )
       ON CONFLICT (query_hash, provider, model)
       DO UPDATE SET embedding = EXCLUDED.embedding,
                     dimensions = EXCLUDED.dimensions,
                     expires_at = EXCLUDED.expires_at,
                     updated_at = NOW()`,
      [
        queryHash,
        normalizedQuery,
        provider,
        model,
        embedding.length,
        JSON.stringify(embedding),
        ttlDays,
      ],
    );
  } catch {
    // Cache failures should never block search or chat.
  }
}
