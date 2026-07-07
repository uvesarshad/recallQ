import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const { searchParams } = new URL(req.url);
  const parsedLimit = Number.parseInt(searchParams.get("limit") || "50", 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 50;
  const cursor = searchParams.get("cursor");
  const params: unknown[] = [user.id];
  const conditions = [
    "items.user_id = $1",
    "items.raw_url IS NOT NULL",
    "items.link_broken = TRUE",
    "items.link_review_status <> 'false_positive'",
  ];

  if (cursor) {
    params.push(cursor);
    conditions.push(`items.created_at < (
      SELECT created_at
      FROM items
      WHERE id = $${params.length} AND user_id = $1
    )`);
  }

  params.push(limit + 1);
  const result = await db.query(
    `SELECT items.id,
            items.type,
            items.title,
            items.summary,
            items.tags,
            items.source,
            items.created_at,
            items.updated_at,
            items.raw_url,
            LEFT(items.raw_text, 240) AS raw_text,
            items.collection_id,
            collections.name AS collection_name,
            items.link_last_checked_at,
            items.link_http_status,
            items.link_broken,
            items.link_failure_reason,
            items.link_review_status,
            items.link_reviewed_at,
            items.link_review_note,
            items.archive_status,
            items.archive_last_error
     FROM items
     LEFT JOIN collections ON collections.id = items.collection_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY items.created_at DESC
     LIMIT $${params.length}`,
    params,
  );

  const hasMore = result.rows.length > limit;
  const items = hasMore ? result.rows.slice(0, limit) : result.rows;
  return apiOk({
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
    hasMore,
  });
}
