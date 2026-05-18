import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { embedText } from "@/lib/gemini";
import { requireSessionUser } from "@/lib/request-auth";
import type { ArchiveItem } from "@/lib/types";
import { hasVectorSupport } from "@/lib/vector";

export const dynamic = "force-dynamic";

type SearchItem = ArchiveItem & {
  rank?: number;
  similarity?: number | string;
  snippet?: string | null;
};

function makeSnippet(
  query: string,
  item: {
    title?: string | null;
    summary?: string | null;
    raw_text?: string | null;
  },
) {
  const haystack = [item.title, item.summary, item.raw_text]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
  if (!haystack) return null;

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

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

async function runExactSearch(userId: string, query: string) {
  try {
    const result = await db.query<SearchItem>(
      `SELECT id, type, title, summary, tags, source, created_at, raw_url, raw_text,
              ts_rank(tsv, websearch_to_tsquery('english', $1)) AS rank
       FROM items
       WHERE user_id = $2
         AND tsv @@ websearch_to_tsquery('english', $1)
       ORDER BY rank DESC, created_at DESC
       LIMIT 20`,
      [query, userId],
    );

    return result.rows.map((item) => ({ ...item, snippet: makeSnippet(query, item) }));
  } catch (error) {
    console.warn("Falling back to basic search:", error);
    const likeQuery = `%${query}%`;
    const result = await db.query<SearchItem>(
      `SELECT id, type, title, summary, tags, source, created_at, raw_url, raw_text
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
       LIMIT 20`,
      [userId, likeQuery],
    );

    return result.rows.map((item) => ({ ...item, snippet: makeSnippet(query, item) }));
  }
}

async function runSemanticSearch(userId: string, query: string) {
  const vectorEnabled = await hasVectorSupport();
  if (!vectorEnabled) {
    return [];
  }

  try {
    const embedding = await embedText(query);
    if (!embedding) {
      return [];
    }

    const semanticResult = await db.query<SearchItem>(
      `SELECT id, type, title, summary, tags, source, created_at, raw_url, raw_text,
              1 - (embedding <=> $1::vector) as similarity
       FROM items
       WHERE user_id = $2 AND embedding IS NOT NULL
       AND 1 - (embedding <=> $1::vector) > 0.7
       ORDER BY embedding <=> $1::vector
       LIMIT 20`,
      [JSON.stringify(embedding), userId],
    );

    return semanticResult.rows.map((item) => ({
      ...item,
      snippet: makeSnippet(query, item),
    }));
  } catch (error) {
    console.warn("Semantic search unavailable:", error);
    return [];
  }
}

export async function GET(req: Request) {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const mode = searchParams.get("mode") || "hybrid";

  if (!query) {
    return apiOk({ items: [], exact: [], semantic: [] });
  }

  if (query.length > 500) {
    return apiError("Query too long (max 500 characters)", 400);
  }

  if (mode === "fulltext") {
    const exact = await runExactSearch(user.id, query);
    return apiOk({ items: exact, exact, semantic: [] });
  }

  if (mode === "semantic" || mode === "hybrid") {
    const semantic = await runSemanticSearch(user.id, query);

    if (mode === "semantic") {
      return apiOk({ items: semantic, exact: [], semantic });
    }

    const exact = await runExactSearch(user.id, query);
    const exactIds = new Set(exact.map((item) => item.id));
    const merged = [...exact, ...semantic.filter((item) => !exactIds.has(item.id))];
    const deduped = Array.from(new Map(merged.map((item) => [item.id, item])).values());

    return apiOk({ items: deduped, exact, semantic });
  }

  return apiOk({ items: [], exact: [], semantic: [] });
}
