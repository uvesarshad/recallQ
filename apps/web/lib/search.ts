// Server-side search used both by /api/v1/search and by the Feed page in
// search-results mode. Hybrid mode combines a Postgres full-text query with a
// pgvector cosine-similarity query, falls back to ILIKE matching when the
// tsvector index isn't available, and silently degrades to text-only when
// pgvector is missing.

import { db } from "@/lib/db";
import { embedQueryText } from "@/lib/gemini";
import {
  decodeSearchCursor,
  encodeSearchCursor,
  parseAdvancedSearch as parseSearchQuery,
  searchCursorForTests,
  type ParsedSearchQuery,
  type SearchMode,
} from "@/lib/search-query";
import type { ArchiveItem } from "@/lib/types";
import { hasVectorSupport } from "@/lib/vector";

export { parseAdvancedSearch } from "@/lib/search-query";
export { searchCursorForTests };
export type { SearchMode } from "@/lib/search-query";

export type SearchItem = ArchiveItem & {
  rank?: number;
  similarity?: number | string;
  snippet?: string | null;
};

export type SearchResult = {
  items: SearchItem[];
  exact: SearchItem[];
  semantic: SearchItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

export const MAX_QUERY_LENGTH = 500;
export const RESULT_LIMIT = 20;
export const MAX_RESULT_LIMIT = 50;
const MAX_MERGE_SCAN_LIMIT = 500;

type SearchOptions = {
  limit?: number;
  cursor?: string | null;
  maxLimit?: number;
};

const ITEM_SELECT = `items.id, items.type, items.title, items.summary, items.tags, items.source,
              items.created_at, items.updated_at, items.raw_url, LEFT(items.raw_text, 240) AS raw_text,
              items.collection_id, collections.name AS collection_name, items.canvas_x, items.canvas_y,
              items.canvas_pinned, items.enriched, items.reminder_at, items.reminder_sent,
              items.file_name, items.file_mime_type, items.image_url, items.blur_data_url,
              items.link_last_checked_at, items.link_http_status, items.link_broken,
              items.link_failure_reason, items.link_review_status,
              items.reading_progress, items.reading_state, items.reader_position,
              items.is_favorite, items.is_archived, items.is_read_later`;

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

function clampLimit(limit: number | undefined, maxLimit = MAX_RESULT_LIMIT): number {
  if (!Number.isFinite(limit)) return RESULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit || RESULT_LIMIT), 1), maxLimit);
}

function addFilterConditions(parsed: ParsedSearchQuery, conditions: string[], params: unknown[]) {
  if (parsed.filters.types.length > 0) {
    params.push(Array.from(new Set(parsed.filters.types)));
    conditions.push(`items.type = ANY($${params.length}::text[])`);
  }
  if (parsed.filters.tags.length > 0) {
    params.push(Array.from(new Set(parsed.filters.tags)));
    conditions.push(`items.tags @> $${params.length}::text[]`);
  }
  if (parsed.filters.folders.length > 0) {
    params.push(Array.from(new Set(parsed.filters.folders.map((folder) => folder.toLowerCase()))));
    conditions.push(`(LOWER(collections.name) = ANY($${params.length}::text[])
      OR items.collection_id::text = ANY($${params.length}::text[]))`);
  }
  if (parsed.filters.sources.length > 0) {
    params.push(Array.from(new Set(parsed.filters.sources)));
    conditions.push(`items.source = ANY($${params.length}::text[])`);
  }
  if (parsed.filters.after) {
    params.push(parsed.filters.after);
    conditions.push(`items.created_at >= $${params.length}::timestamptz`);
  }
  if (parsed.filters.before) {
    params.push(parsed.filters.before);
    conditions.push(`items.created_at <= $${params.length}::timestamptz`);
  }
  if (parsed.filters.hasReminder === true) {
    conditions.push(`items.reminder_at IS NOT NULL`);
  }
  if (parsed.filters.hasReminder === false) {
    conditions.push(`items.reminder_at IS NULL`);
  }
  if (parsed.filters.isEnriched !== null) {
    params.push(parsed.filters.isEnriched);
    conditions.push(`items.enriched = $${params.length}`);
  }
  if (parsed.filters.isBroken === true) {
    conditions.push(`items.link_broken = TRUE`);
  }
}

function addTextFallbackCondition(parsed: ParsedSearchQuery, conditions: string[], params: unknown[]) {
  if (parsed.groups.length === 0) return;

  const groupClauses = parsed.groups.map((group) => {
    const termClauses = group.map((term) => {
      params.push(`%${term.value}%`);
      const index = params.length;
      return `(items.title ILIKE $${index}
           OR items.summary ILIKE $${index}
           OR items.raw_text ILIKE $${index}
           OR items.raw_url ILIKE $${index}
           OR EXISTS (
             SELECT 1 FROM unnest(items.tags) AS tag
             WHERE tag ILIKE $${index}
           )
           OR EXISTS (
             SELECT 1
             FROM item_highlights
             WHERE item_highlights.item_id = items.id
               AND item_highlights.user_id = items.user_id
               AND (
                 item_highlights.quote ILIKE $${index}
                 OR item_highlights.note ILIKE $${index}
               )
           ))`;
    });
    return `(${termClauses.join(" AND ")})`;
  });

  conditions.push(`(${groupClauses.join(" OR ")})`);
}

function addFullTextCondition(parsed: ParsedSearchQuery, conditions: string[], params: unknown[]) {
  if (!parsed.textQuery) return;
  params.push(parsed.textQuery);
  conditions.push(`(items.tsv @@ websearch_to_tsquery('english', $${params.length})
    OR EXISTS (
      SELECT 1
      FROM item_highlights
      WHERE item_highlights.item_id = items.id
        AND item_highlights.user_id = items.user_id
        AND to_tsvector('english', item_highlights.quote || ' ' || COALESCE(item_highlights.note, ''))
          @@ websearch_to_tsquery('english', $${params.length})
    ))`);
}

function nextCursor(mode: SearchMode, query: string, offset: number, rowsLength: number, limit: number) {
  if (rowsLength <= limit) return null;
  return encodeSearchCursor({ v: 1, mode, query, offset: offset + limit });
}

export async function runExactSearch(
  userId: string,
  query: string,
  options: SearchOptions = {},
): Promise<{ items: SearchItem[]; nextCursor: string | null; hasMore: boolean }> {
  const parsed = parseSearchQuery(query);
  const limit = clampLimit(options.limit, options.maxLimit);
  const offset = decodeSearchCursor(options.cursor, "fulltext", query)?.offset ?? 0;
  try {
    const conditions = ["items.user_id = $1"];
    const params: unknown[] = [userId];
    addFilterConditions(parsed, conditions, params);
    addFullTextCondition(parsed, conditions, params);
    const rankExpression = parsed.textQuery
      ? `ts_rank(items.tsv, websearch_to_tsquery('english', $${params.length}))`
      : "0";
    params.push(limit + 1, offset);
    const result = await db.query<SearchItem>(
      `SELECT ${ITEM_SELECT}, ${rankExpression} AS rank
       FROM items
       LEFT JOIN collections ON collections.id = items.collection_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY rank DESC, items.created_at DESC, items.id DESC
       LIMIT $${params.length - 1}
       OFFSET $${params.length}`,
      params,
    );
    const rows = result.rows;
    const items = rows.slice(0, limit).map((item) => ({ ...item, snippet: makeSnippet(parsed.textQuery || query, item) }));
    const cursor = nextCursor("fulltext", query, offset, rows.length, limit);
    return { items, nextCursor: cursor, hasMore: cursor !== null };
  } catch (error) {
    console.warn("Falling back to basic search:", error);
    const conditions = ["items.user_id = $1"];
    const params: unknown[] = [userId];
    addFilterConditions(parsed, conditions, params);
    addTextFallbackCondition(parsed, conditions, params);
    params.push(limit + 1, offset);
    const result = await db.query<SearchItem>(
      `SELECT ${ITEM_SELECT}
       FROM items
       LEFT JOIN collections ON collections.id = items.collection_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY items.created_at DESC, items.id DESC
       LIMIT $${params.length - 1}
       OFFSET $${params.length}`,
      params,
    );
    const rows = result.rows;
    const items = rows.slice(0, limit).map((item) => ({ ...item, snippet: makeSnippet(parsed.textQuery || query, item) }));
    const cursor = nextCursor("fulltext", query, offset, rows.length, limit);
    return { items, nextCursor: cursor, hasMore: cursor !== null };
  }
}

export async function runSemanticSearch(
  userId: string,
  query: string,
  options: SearchOptions = {},
): Promise<{ items: SearchItem[]; nextCursor: string | null; hasMore: boolean }> {
  const parsed = parseSearchQuery(query);
  const limit = clampLimit(options.limit, options.maxLimit);
  const offset = decodeSearchCursor(options.cursor, "semantic", query)?.offset ?? 0;
  if (!parsed.textQuery) return { items: [], nextCursor: null, hasMore: false };
  const vectorEnabled = await hasVectorSupport();
  if (!vectorEnabled) return { items: [], nextCursor: null, hasMore: false };

  try {
    const embedding = await embedQueryText(parsed.textQuery);
    if (!embedding) return { items: [], nextCursor: null, hasMore: false };
    const conditions = ["items.user_id = $2", "items.embedding IS NOT NULL", "1 - (items.embedding <=> $1::vector) > 0.7"];
    const params: unknown[] = [JSON.stringify(embedding), userId];
    addFilterConditions(parsed, conditions, params);
    params.push(limit + 1, offset);

    const semanticResult = await db.query<SearchItem>(
      `SELECT ${ITEM_SELECT}, 1 - (items.embedding <=> $1::vector) as similarity
       FROM items
       LEFT JOIN collections ON collections.id = items.collection_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY items.embedding <=> $1::vector, items.created_at DESC, items.id DESC
       LIMIT $${params.length - 1}
       OFFSET $${params.length}`,
      params,
    );

    const rows = semanticResult.rows;
    const items = rows.slice(0, limit).map((item) => ({ ...item, snippet: makeSnippet(parsed.textQuery, item) }));
    const cursor = nextCursor("semantic", query, offset, rows.length, limit);
    return { items, nextCursor: cursor, hasMore: cursor !== null };
  } catch (error) {
    console.warn("Semantic search unavailable:", error);
    return { items: [], nextCursor: null, hasMore: false };
  }
}

export async function runHybridSearch(
  userId: string,
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult> {
  const limit = clampLimit(options.limit);
  const offset = decodeSearchCursor(options.cursor, "hybrid", query)?.offset ?? 0;
  if (offset >= MAX_MERGE_SCAN_LIMIT) {
    return { items: [], exact: [], semantic: [], nextCursor: null, hasMore: false };
  }
  const fetchLimit = Math.min(MAX_MERGE_SCAN_LIMIT, offset + limit + 1);
  const semantic = await runSemanticSearch(userId, query, { limit: fetchLimit, maxLimit: MAX_MERGE_SCAN_LIMIT });
  const exact = await runExactSearch(userId, query, { limit: fetchLimit, maxLimit: MAX_MERGE_SCAN_LIMIT });
  const exactIds = new Set(exact.items.map((item) => item.id));
  const merged = [...exact.items, ...semantic.items.filter((item) => !exactIds.has(item.id))];
  const deduped = Array.from(new Map(merged.map((item) => [item.id, item])).values());
  const page = deduped.slice(offset, offset + limit);
  const nextOffset = offset + limit;
  const hasMore =
    nextOffset < MAX_MERGE_SCAN_LIMIT &&
    (deduped.length > nextOffset || exact.hasMore || semantic.hasMore);
  return {
    items: page,
    exact: exact.items,
    semantic: semantic.items,
    nextCursor: hasMore ? encodeSearchCursor({ v: 1, mode: "hybrid", query, offset: nextOffset }) : null,
    hasMore,
  };
}

export async function runSearch(
  userId: string,
  query: string,
  mode: SearchMode = "hybrid",
  options: SearchOptions = {},
): Promise<SearchResult> {
  if (!query) return { items: [], exact: [], semantic: [], nextCursor: null, hasMore: false };

  if (mode === "fulltext") {
    const exact = await runExactSearch(userId, query, options);
    return { items: exact.items, exact: exact.items, semantic: [], nextCursor: exact.nextCursor, hasMore: exact.hasMore };
  }

  if (mode === "semantic") {
    const semantic = await runSemanticSearch(userId, query, options);
    return {
      items: semantic.items,
      exact: [],
      semantic: semantic.items,
      nextCursor: semantic.nextCursor,
      hasMore: semantic.hasMore,
    };
  }

  return runHybridSearch(userId, query, options);
}
