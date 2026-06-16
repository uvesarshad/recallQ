import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Accepts a bearer token as well as a session cookie — non-web clients
  // (Chrome extension feed, mobile) read their archive through this route.
  const user = await requireUser(req);
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const tag = searchParams.get("tag") || "";
  const collection = searchParams.get("collection") || "";
  const type = searchParams.get("type") || "";
  const cursor = searchParams.get("cursor") || "";
  // Delta-sync mode: when `since` (ISO timestamp) is present, return items
  // changed after it, oldest-first, so the extension can pull cross-device
  // changes incrementally. Advances by the last item's `updated_at`. (New +
  // edited items only; server-side deletions need tombstones — deferred.)
  const since = searchParams.get("since") || "";
  // Validate the limit param: parseInt of bad input returns NaN, which
  // would propagate into the SQL LIMIT clause and error out. Clamp to a
  // sane default + cap.
  const parsedLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 20;

  const conditions = ["user_id = $1"];
  const params: unknown[] = [user.id];
  let paramIndex = 2;

  if (query) {
    conditions.push(`(title ILIKE $${paramIndex} OR summary ILIKE $${paramIndex} OR raw_text ILIKE $${paramIndex})`);
    params.push(`%${query}%`);
    paramIndex++;
  }

  if (tag) {
    conditions.push("$" + paramIndex + " = ANY(tags)");
    params.push(tag);
    paramIndex++;
  }

  if (collection) {
    conditions.push("collection_id = $" + paramIndex);
    params.push(collection);
    paramIndex++;
  }

  if (type) {
    conditions.push("type = $" + paramIndex);
    params.push(type);
    paramIndex++;
  }

  if (since && !cursor) {
    // Delta mode advances by timestamp, not item-id cursor.
    conditions.push(`updated_at > $${paramIndex}`);
    params.push(since);
    paramIndex++;
  } else if (cursor) {
    conditions.push(`created_at < (SELECT created_at FROM items WHERE id = $${paramIndex})`);
    params.push(cursor);
    paramIndex++;
  }

  const whereClause = conditions.join(" AND ");
  // Delta pulls go oldest-first so the client can advance `since`; the normal
  // feed stays newest-first.
  const orderBy = since && !cursor ? "updated_at ASC" : "created_at DESC";

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
            LEFT(items.raw_text, 240) AS raw_text, -- truncated for list performance; single-item GET returns full value
            items.collection_id,
            collections.name AS collection_name,
            items.canvas_x,
            items.canvas_y,
            items.canvas_pinned,
            items.enriched,
            items.reminder_at,
            items.reminder_sent,
            items.file_name,
            items.file_mime_type,
            items.image_url,
            items.blur_data_url
     FROM items
     LEFT JOIN collections ON collections.id = items.collection_id
     WHERE ${whereClause}
     ORDER BY ${orderBy}
     LIMIT $${paramIndex}`,
    [...params, limit + 1]
  );

  const hasMore = result.rows.length > limit;
  const items = hasMore ? result.rows.slice(0, limit) : result.rows;
  // In delta mode the cursor is the last item's updated_at; otherwise its id.
  const nextCursor = hasMore
    ? since && !cursor
      ? items[items.length - 1].updated_at
      : items[items.length - 1].id
    : null;

  return apiOk({ items, nextCursor, hasMore });
}
