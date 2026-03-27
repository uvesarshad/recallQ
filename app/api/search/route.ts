import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { embedText } from "@/lib/gemini";
import { requireSessionUser } from "@/lib/request-auth";
import { hasVectorSupport } from "@/lib/vector";

export const dynamic = "force-dynamic";

function makeSnippet(query: string, item: Record<string, unknown>) {
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

  if (mode === "fulltext") {
    const result = await db.query(
      `SELECT id, type, title, summary, tags, source, created_at, raw_url, raw_text,
              ts_rank(
                setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
                setweight(to_tsvector('english', coalesce(raw_text, '')), 'C'),
                websearch_to_tsquery('english', $2)
              ) as rank
       FROM items 
       WHERE user_id = $1 AND (
         to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(raw_text, '')) @@ websearch_to_tsquery('english', $2)
       )
       ORDER BY rank DESC, created_at DESC
       LIMIT 20`,
      [user.id, query]
    );

    const exact = result.rows.map((item) => ({ ...item, snippet: makeSnippet(query, item) }));
    return apiOk({ items: exact, exact, semantic: [] });
  }

  if (mode === "semantic" || mode === "hybrid") {
    const vectorEnabled = await hasVectorSupport();
    if (!vectorEnabled) {
      if (mode === "semantic") {
        return apiOk({ items: [], exact: [], semantic: [] });
      }

      const fulltextResult = await db.query(
        `SELECT id, type, title, summary, tags, source, created_at, raw_url, raw_text,
                ts_rank(
                  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                  setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
                  setweight(to_tsvector('english', coalesce(raw_text, '')), 'C'),
                  websearch_to_tsquery('english', $1)
                ) as rank
         FROM items 
         WHERE user_id = $2 AND (
           to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(raw_text, '')) @@ websearch_to_tsquery('english', $1)
         )
         ORDER BY rank DESC, created_at DESC
         LIMIT 20`,
        [query, user.id]
      );

      const exact = fulltextResult.rows.map((item) => ({ ...item, snippet: makeSnippet(query, item) }));
      return apiOk({ items: exact, exact, semantic: [] });
    }

    const embedding = await embedText(query);
    if (!embedding) {
      return apiOk({ items: [], exact: [], semantic: [] });
    }

    const semanticResult = await db.query(
      `SELECT id, type, title, summary, tags, source, created_at, raw_url, raw_text,
              1 - (embedding <=> $1::vector) as similarity
       FROM items 
       WHERE user_id = $2 AND embedding IS NOT NULL
       AND 1 - (embedding <=> $1::vector) > 0.7
       ORDER BY embedding <=> $1::vector
       LIMIT 20`,
      [JSON.stringify(embedding), user.id]
    );

    const semantic = semanticResult.rows.map((item) => ({
      ...item,
      snippet: makeSnippet(query, item),
    }));

    if (mode === "semantic") {
      return apiOk({ items: semantic, exact: [], semantic });
    }

    const fulltextResult = await db.query(
      `SELECT id, type, title, summary, tags, source, created_at, raw_url, raw_text,
              ts_rank(
                setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
                setweight(to_tsvector('english', coalesce(raw_text, '')), 'C'),
                websearch_to_tsquery('english', $1)
              ) as rank
       FROM items 
       WHERE user_id = $2 AND (
         to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(raw_text, '')) @@ websearch_to_tsquery('english', $1)
       )
       ORDER BY rank DESC, created_at DESC
       LIMIT 20`,
      [query, user.id]
    );

    const exact = fulltextResult.rows.map((item) => ({ ...item, snippet: makeSnippet(query, item) }));
    const exactIds = new Set(exact.map((item: any) => item.id));
    const merged = [...exact, ...semantic.filter((item: any) => !exactIds.has(item.id))];
    const deduped = Array.from(new Map(merged.map(item => [item.id, item])).values());

    return apiOk({ items: deduped, exact, semantic });
  }

  return apiOk({ items: [], exact: [], semantic: [] });
}
