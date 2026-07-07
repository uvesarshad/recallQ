import { z } from "zod";
import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/request-auth";
import { MAX_QUERY_LENGTH } from "@/lib/search";

export const dynamic = "force-dynamic";

const savedSearchUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  query: z.string().trim().min(1).max(MAX_QUERY_LENGTH).optional(),
  mode: z.enum(["hybrid", "fulltext", "semantic"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(req);
  if (!user) {
    return apiError("Unauthorized", 401);
  }
  const { id } = await params;

  const parsed = savedSearchUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return apiError("Invalid saved search update", 400, { details: parsed.error.issues });
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  if (parsed.data.name !== undefined) {
    updates.push(`name = $${index++}`);
    values.push(parsed.data.name);
  }
  if (parsed.data.query !== undefined) {
    updates.push(`query = $${index++}`);
    values.push(parsed.data.query);
  }
  if (parsed.data.mode !== undefined) {
    updates.push(`mode = $${index++}`);
    values.push(parsed.data.mode);
  }

  if (updates.length === 0) {
    return apiError("No valid fields to update", 400);
  }

  updates.push("updated_at = NOW()");
  values.push(id, user.id);

  try {
    const result = await db.query(
      `UPDATE smart_saved_searches
       SET ${updates.join(", ")}
       WHERE id = $${index++} AND user_id = $${index}
       RETURNING id, name, query, mode, created_at, updated_at`,
      values,
    );

    if (result.rows.length === 0) {
      return apiError("Saved search not found", 404);
    }

    return apiOk({ smartSearch: result.rows[0] });
  } catch (error) {
    if (error instanceof Error && error.message.includes("idx_smart_saved_searches_user_name")) {
      return apiError("A saved search with that name already exists", 409);
    }
    throw error;
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(req);
  if (!user) {
    return apiError("Unauthorized", 401);
  }
  const { id } = await params;

  const result = await db.query(
    "DELETE FROM smart_saved_searches WHERE id = $1 AND user_id = $2",
    [id, user.id],
  );

  if (result.rowCount === 0) {
    return apiError("Saved search not found", 404);
  }

  return apiOk({ success: true });
}
