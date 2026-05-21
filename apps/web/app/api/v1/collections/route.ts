import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { requireSessionUser } from "@/lib/request-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const collectionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.string().trim().max(20).optional(),
  icon: z.string().trim().max(50).optional(),
});

export async function GET() {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const result = await db.query(
    "SELECT * FROM collections WHERE user_id = $1 ORDER BY created_at DESC",
    [user.id]
  );

  return apiOk({ collections: result.rows });
}

export async function POST(req: Request) {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const data = collectionSchema.parse(await req.json());

  const result = await db.query(
    "INSERT INTO collections (user_id, name, color, icon) VALUES ($1, $2, $3, $4) RETURNING *",
    [user.id, data.name, data.color || null, data.icon || null]
  );

  return apiOk({ collection: result.rows[0] });
}
