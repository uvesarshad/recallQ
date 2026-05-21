import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { requireSessionUser } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }
  const { id } = await params;

  const result = await db.query(
    `SELECT i.id, i.type, i.title, i.summary, i.tags, i.raw_url, r.relation_type, r.strength
     FROM item_relations r
     JOIN items i ON (i.id = r.item_a_id OR i.id = r.item_b_id)
     WHERE (r.item_a_id = $1 OR r.item_b_id = $1)
       AND i.id != $1
       AND r.user_id = $2
     ORDER BY r.strength DESC
     LIMIT 20`,
    [id, user.id]
  );

  return apiOk({ related: result.rows });
}
