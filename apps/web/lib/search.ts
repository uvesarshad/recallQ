// Server-side search used both by /api/v1/search and by the Feed page in
// search-results mode. Hybrid mode combines a Postgres full-text query with a
// pgvector cosine-similarity query, falls back to ILIKE matching when the
// tsvector index isn't available, and silently degrades to text-only when
// pgvector is missing.

import { db } from "@/lib/db";
import { embedText } from "@/lib/gemini";
import type { ArchiveItem } from "@/lib/types";
import { hasVectorSupport } from "@/lib/vector";

export type SearchMode = "hybrid" | "fulltext" | "semantic";

export type SearchItem = ArchiveItem & {
  rank?: number;
  similarity?: number | string;
  snippet?: string | null;
};

export type SearchResult = {
  items: SearchItem[];
  exact: SearchItem[];
  semantic: SearchItem[];
};

export const MAX_QUERY_LENGTH = 500;
export const RESULT_LIMIT = 20;

export function makeSnippet(
  query: string,
  item: { title?: string | null; summary?: string | null; raw_text?: string | null },
): string | null {
  const haystack = [item.title, item.summary, item.raw_text]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
  if (!haystack) return null;

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const index = terms
    .map((term) => haystack.toLowerCase().indexOf(term))
    .find((value) => value >= 0);

  if (index === undefined || index < 0) {
    return haystack.slice(0, 180);
  }

  const start = Math.max(0, index - 40);
  const end = Math.min(haystack.length, index + 140);
  return `${start > 0 ? "..." : ""}${haystack.slice(start, end)}${end < haystack.length ? "..." : ""}`;
}

export async function runExactSearch(userId: string, query: string): Promise<SearchItem[]> {
  try {
    const result = await db.query<SearchItem>(
      `SELECT id, type, title, summary, tags, source, created_at, updated_at,
              raw_url, raw_text, collection_id, canvas_x, canvas_y, canvas_pinned,
              enriched, reminder_at, reminder_sent, file_name, file_mime_type, image_url,
              ts_rank(tsv, websearch_to_tsquery('english', $1)) AS rank
       FROM items
       WHERE user_id = $2
         AND tsv @@ websearch_to_tsquery('english', $1)
       ORDER BY rank DESC, created_at DESC
       LIMIT $3`,
      [query, userId, RESULT_LIMIT],
    );
    return result.rows.map((item) => ({ ...item, snippet: makeSnippet(query, item) }));
  } catch (error) {
    console.warn("Falling back to basic search:", error);
    const likeQuery = `%${query}%`;
    const result = await db.query<SearchItem>(
      `SELECT id, type, title, summary, tags, source, created_at, updated_at,
              raw_url, raw_text, collection_id, canvas_x, canvas_y, canvas_pinned,
              enriched, reminder_at, reminder_sent, file_name, file_mime_type, image_url
       FROM items
       WHERE user_id = $1
         AND (
           title ILIKE $2
           OR summary ILIKE $2
           OR raw_text ILIKE $2
           OR raw_url ILIKE $2
           OR EXISTS (
             SELECT 1 FROM unnest(tags) AS tag
             WHERE tag ILIKE $2
           )
         )
       ORDER BY created_at DESC
       LIMIT $3`,
      [userId, likeQuery, RESULT_LIMIT],
    );
    return result.rows.map((item) => ({ ...item, snippet: makeSnippet(query, item) }));
  }
}

export async function runSemanticSearch(userId: string, query: string): Promise<SearchItem[]> {
  const vectorEnabled = await hasVectorSupport();
  if (!vectorEnabled) return [];

  try {
    const embedding = await embedText(query);
    if (!embedding) return [];

    const semanticResult = await db.query<SearchItem>(
      `SELECT id, type, title, summary, tags, source, created_at, updated_at,
              raw_url, raw_text, collection_id, canvas_x, canvas_y, canvas_pinned,
              enriched, reminder_at, reminder_sent, file_name, file_mime_type, image_url,
              1 - (embedding <=> $1::vector) as similarity
       FROM items
       WHERE user_id = $2 AND embedding IS NOT NULL
         AND 1 - (embedding <=> $1::vector) > 0.7
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [JSON.stringify(embedding), userId, RESULT_LIMIT],
    );

    return semanticResult.rows.map((item) => ({ ...item, snippet: makeSnippet(query, item) }));
  } catch (error) {
    console.warn("Semantic search unavailable:", error);
    return [];
  }
}

export async function runHybridSearch(userId: string, query: string): Promise<SearchResult> {
  const semantic = await runSemanticSearch(userId, query);
  const exact = await runExactSearch(userId, query);
  const exactIds = new Set(exact.map((item) => item.id));
  const merged = [...exact, ...semantic.filter((item) => !exactIds.has(item.id))];
  const deduped = Array.from(new Map(merged.map((item) => [item.id, item])).values());
  return { items: deduped, exact, semantic };
}

export async function runSearch(
  userId: string,
  query: string,
  mode: SearchMode = "hybrid",
): Promise<SearchResult> {
  if (!query) return { items: [], exact: [], semantic: [] };

  if (mode === "fulltext") {
    const exact = await runExactSearch(userId, query);
    return { items: exact, exact, semantic: [] };
  }

  if (mode === "semantic") {
    const semantic = await runSemanticSearch(userId, query);
    return { items: semantic, exact: [], semantic };
  }

  return runHybridSearch(userId, query);
}
