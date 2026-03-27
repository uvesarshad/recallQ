import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { requireSessionUser } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const itemsResult = await db.query(
    `SELECT id, type, title, summary, tags, raw_url, source, file_name,
            collection_id, canvas_x, canvas_y, canvas_pinned, enriched, image_url, created_at
     FROM items 
     WHERE user_id = $1`,
    [user.id]
  );
  
  const relationsResult = await db.query(
    `SELECT id, item_a_id, item_b_id, relation_type, strength
     FROM item_relations
     WHERE user_id = $1`,
    [user.id]
  );

  return apiOk({
    nodes: itemsResult.rows,
    edges: relationsResult.rows,
  });
}
