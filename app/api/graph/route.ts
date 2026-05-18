import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { requireSessionUser } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

const GRAPH_ITEM_LIMIT = 500;

export async function GET(req: Request) {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const { searchParams } = new URL(req.url);
  const minStrength = Math.min(Math.max(parseFloat(searchParams.get("min_strength") ?? "0"), 0), 1);

  const itemsResult = await db.query(
    `SELECT id, type, title, summary, tags, raw_url, source, file_name,
            collection_id, canvas_x, canvas_y, canvas_pinned, enriched, image_url, created_at
     FROM items
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [user.id, GRAPH_ITEM_LIMIT]
  );

  const itemIds = (itemsResult.rows as { id: string }[]).map((r) => r.id);

  const relationsResult = await db.query(
    `SELECT id, item_a_id, item_b_id, relation_type, strength
     FROM item_relations
     WHERE user_id = $1
       AND strength >= $2
       AND item_a_id = ANY($3::uuid[])
       AND item_b_id = ANY($3::uuid[])`,
    [user.id, minStrength, itemIds]
  );

  return apiOk({
    nodes: itemsResult.rows,
    edges: relationsResult.rows,
  });
}
