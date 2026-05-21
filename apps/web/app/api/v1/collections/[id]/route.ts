import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { requireSessionUser } from "@/lib/request-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const collectionUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  color: z.string().trim().max(20).optional(),
  icon: z.string().trim().max(50).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }
  const { id } = await params;

  const data = collectionUpdateSchema.parse(await req.json());
  
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${idx++}`);
    values.push(data.name);
  }
  if (data.color !== undefined) {
    updates.push(`color = $${idx++}`);
    values.push(data.color);
  }
  if (data.icon !== undefined) {
    updates.push(`icon = $${idx++}`);
    values.push(data.icon);
  }

  if (updates.length === 0) {
    return apiError("No valid fields to update", 400);
  }

  values.push(id, user.id);

  const result = await db.query(
    `UPDATE collections SET ${updates.join(", ")} WHERE id = $${idx++} AND user_id = $${idx} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return apiError("Collection not found or not owned by user", 404);
  }

  return apiOk({ collection: result.rows[0] });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }
  const { id } = await params;

  const result = await db.query(
    "DELETE FROM collections WHERE id = $1 AND user_id = $2",
    [id, user.id]
  );

  if (result.rowCount === 0) {
    return apiError("Collection not found or not owned by user", 404);
  }

  return apiOk({ success: true });
}
