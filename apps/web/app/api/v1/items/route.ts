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
  const favorite = searchParams.get("favorite");
  const archived = searchParams.get("archived");
  const readLater = searchParams.get("read_later");
  const readingState = searchParams.get("reading_state") || "";
  const broken = searchParams.get("broken");
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

  if (favorite === "true" || favorite === "false") {
    conditions.push("is_favorite = $" + paramIndex);
    params.push(favorite === "true");
    paramIndex++;
  }

  if (archived === "true" || archived === "false") {
    conditions.push("is_archived = $" + paramIndex);
    params.push(archived === "true");
    paramIndex++;
  }

  if (readLater === "true" || readLater === "false") {
    conditions.push("is_read_later = $" + paramIndex);
    params.push(readLater === "true");
    paramIndex++;
  }

  if (readingState && ["unread", "reading", "read"].includes(readingState)) {
    conditions.push("reading_state = $" + paramIndex);
    params.push(readingState);
    paramIndex++;
  }

  if (broken === "true" || broken === "false") {
    conditions.push("link_broken = $" + paramIndex);
    params.push(broken === "true");
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

  if (
    since &&
    !cursor &&
    !query &&
    !tag &&
    !collection &&
    !type &&
    !favorite &&
    !archived &&
    !readLater &&
    !readingState &&
    !broken
  ) {
    const deltaResult = await db.query(
      `WITH changes AS (
         SELECT id,
                type,
                title,
                summary,
                tags,
                source,
                created_at,
                updated_at,
                raw_url,
                LEFT(raw_text, 240) AS raw_text,
                capture_note,
                collection_id,
                NULL::text AS collection_name,
                canvas_x,
                canvas_y,
                canvas_pinned,
                enriched,
                reminder_at,
                reminder_sent,
                file_name,
                file_mime_type,
                image_url,
                blur_data_url,
                archive_requested_at,
                archive_status,
                archive_last_error,
                archive_last_attempt_at,
                link_last_checked_at,
                link_http_status,
                link_broken,
                link_failure_reason,
                link_review_status,
                link_reviewed_at,
                link_review_note,
                reading_progress,
                reading_state,
                reader_position,
                is_favorite,
                is_archived,
                is_read_later,
                reading_started_at,
                reading_completed_at,
                false AS deleted,
                NULL::timestamptz AS deleted_at,
                updated_at AS sync_at
         FROM items
         WHERE user_id = $1 AND updated_at > $2
         UNION ALL
         SELECT id,
                NULL::text AS type,
                NULL::text AS title,
                NULL::text AS summary,
                NULL::text[] AS tags,
                NULL::text AS source,
                deleted_at AS created_at,
                deleted_at AS updated_at,
                NULL::text AS raw_url,
                NULL::text AS raw_text,
                NULL::text AS capture_note,
                NULL::uuid AS collection_id,
                NULL::text AS collection_name,
                NULL::double precision AS canvas_x,
                NULL::double precision AS canvas_y,
                NULL::boolean AS canvas_pinned,
                NULL::boolean AS enriched,
                NULL::timestamptz AS reminder_at,
                NULL::boolean AS reminder_sent,
                NULL::text AS file_name,
                NULL::text AS file_mime_type,
                NULL::text AS image_url,
                NULL::text AS blur_data_url,
                NULL::timestamptz AS archive_requested_at,
                NULL::text AS archive_status,
                NULL::text AS archive_last_error,
                NULL::timestamptz AS archive_last_attempt_at,
                NULL::timestamptz AS link_last_checked_at,
                NULL::integer AS link_http_status,
                NULL::boolean AS link_broken,
                NULL::text AS link_failure_reason,
                NULL::text AS link_review_status,
                NULL::timestamptz AS link_reviewed_at,
                NULL::text AS link_review_note,
                NULL::integer AS reading_progress,
                NULL::text AS reading_state,
                NULL::text AS reader_position,
                NULL::boolean AS is_favorite,
                NULL::boolean AS is_archived,
                NULL::boolean AS is_read_later,
                NULL::timestamptz AS reading_started_at,
                NULL::timestamptz AS reading_completed_at,
                true AS deleted,
                deleted_at,
                deleted_at AS sync_at
         FROM item_tombstones
         WHERE user_id = $1 AND deleted_at > $2
       )
       SELECT *
       FROM changes
       ORDER BY sync_at ASC
       LIMIT $3`,
      [user.id, since, limit + 1],
    );

    const rows = deltaResult.rows;
    const pageRows = rows.length > limit ? rows.slice(0, limit) : rows;
    const items = pageRows
      .filter((row) => !row.deleted)
      .map(({ deleted, deleted_at, sync_at, ...item }) => item);
    const deletedItems = pageRows
      .filter((row) => row.deleted)
      .map((row) => ({ id: row.id, deleted_at: row.deleted_at }));
    const hasMore = rows.length > limit;
    const nextCursor = pageRows.length > 0 ? pageRows[pageRows.length - 1].sync_at : null;

    return apiOk({ items, deletedItems, nextCursor, hasMore });
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
            items.capture_note,
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
            items.blur_data_url,
            items.archive_requested_at,
            items.archive_status,
            items.archive_last_error,
            items.archive_last_attempt_at,
            items.link_last_checked_at,
            items.link_http_status,
            items.link_broken,
            items.link_failure_reason,
            items.link_review_status,
            items.link_reviewed_at,
            items.link_review_note,
            items.reading_progress,
            items.reading_state,
            items.reader_position,
            items.is_favorite,
            items.is_archived,
            items.is_read_later,
            items.reading_started_at,
            items.reading_completed_at
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
