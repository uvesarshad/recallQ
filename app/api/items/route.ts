import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { requireSessionUser } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const tag = searchParams.get("tag") || "";
  const collection = searchParams.get("collection") || "";
  const type = searchParams.get("type") || "";
  const cursor = searchParams.get("cursor") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

  let conditions = ["user_id = $1"];
  let params: any[] = [user.id];
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

  if (cursor) {
    conditions.push(`created_at < (SELECT created_at FROM items WHERE id = $${paramIndex})`);
    params.push(cursor);
    paramIndex++;
  }

  const whereClause = conditions.join(" AND ");

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
            items.canvas_x,
            items.canvas_y,
            items.canvas_pinned,
            items.enriched,
            items.reminder_at,
            items.reminder_sent,
            items.file_name,
            items.file_mime_type,
            items.image_url
     FROM items
     LEFT JOIN collections ON collections.id = items.collection_id
     WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex}`,
    [...params, limit + 1]
  );

  const hasMore = result.rows.length > limit;
  const items = hasMore ? result.rows.slice(0, limit) : result.rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return apiOk({ items, nextCursor, hasMore });
}
