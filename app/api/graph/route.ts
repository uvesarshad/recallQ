import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { requireSessionUser } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

const GRAPH_ITEM_LIMIT = 500;

export async function GET() {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const itemsResult = await db.query(
    `SELECT i.id, i.type, i.title, i.summary, i.tags, i.raw_url, i.source, i.file_name,
            i.collection_id, c.name AS collection_name,
            i.canvas_x, i.canvas_y, i.canvas_pinned, i.enriched, i.image_url, i.created_at
     FROM items i
     LEFT JOIN collections c ON c.id = i.collection_id
     WHERE i.user_id = $1
     ORDER BY i.created_at DESC
     LIMIT $2`,
    [user.id, GRAPH_ITEM_LIMIT]
  );

  return apiOk({ nodes: itemsResult.rows });
}
