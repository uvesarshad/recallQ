import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { requireSessionUser } from "@/lib/request-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const itemUpdateSchema = z.object({
  title: z.string().trim().max(200).optional(),
  summary: z.string().trim().max(2000).nullable().optional(),
  tags: z.array(z.string()).optional(),
  collection_id: z.string().uuid().nullable().optional(),
  reminder_at: z.string().datetime().nullable().optional(),
  canvas_x: z.number().finite().optional(),
  canvas_y: z.number().finite().optional(),
  canvas_pinned: z.boolean().optional(),
});

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
    `SELECT id, type, title, summary, tags, source, created_at, updated_at,
            raw_url, raw_text, collection_id, canvas_x, canvas_y, canvas_pinned,
            enriched, enriched_at, reminder_at, reminder_sent, 
            file_path, file_name, file_mime_type, capture_note, image_url
     FROM items 
     WHERE id = $1 AND user_id = $2`,
    [id, user.id]
  );

  if (result.rows.length === 0) {
    return apiError("Item not found", 404);
  }

  return apiOk({ item: result.rows[0] });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }
  const { id } = await params;

  const data = itemUpdateSchema.parse(await req.json());
  
  // Build dynamic update query
  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (data.title !== undefined) {
    updates.push(`title = $${idx++}`);
    values.push(data.title);
  }
  if (data.summary !== undefined) {
    updates.push(`summary = $${idx++}`);
    values.push(data.summary);
  }
  if (data.tags !== undefined) {
    updates.push(`tags = $${idx++}`);
    values.push(data.tags);
  }
  if (data.collection_id !== undefined) {
    updates.push(`collection_id = $${idx++}`);
    values.push(data.collection_id);
  }
  if (data.reminder_at !== undefined) {
    updates.push(`reminder_at = $${idx++}`);
    values.push(data.reminder_at);
  }
  if (data.canvas_x !== undefined) {
    updates.push(`canvas_x = $${idx++}`);
    values.push(data.canvas_x);
  }
  if (data.canvas_y !== undefined) {
    updates.push(`canvas_y = $${idx++}`);
    values.push(data.canvas_y);
  }
  if (data.canvas_pinned !== undefined) {
    updates.push(`canvas_pinned = $${idx++}`);
    values.push(data.canvas_pinned);
  }

  if (updates.length === 0) {
    return apiError("No valid fields to update", 400);
  }

  updates.push(`updated_at = NOW()`);
  values.push(id, user.id);

  const result = await db.query(
    `UPDATE items SET ${updates.join(", ")} WHERE id = $${idx++} AND user_id = $${idx}`,
    values
  );

  if (result.rowCount === 0) {
    return apiError("Item not found or not owned by user", 404);
  }

  if (data.reminder_at !== undefined) {
    await db.query(
      "DELETE FROM reminders WHERE item_id = $1 AND user_id = $2 AND sent = FALSE",
      [id, user.id]
    );

    if (data.reminder_at) {
      await db.query(
        `INSERT INTO reminders (item_id, user_id, remind_at, channels)
         VALUES ($1, $2, $3, '{email}')`,
        [id, user.id, data.reminder_at]
      );
    }
  }

  return apiOk({ success: true });
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
    "DELETE FROM items WHERE id = $1 AND user_id = $2",
    [id, user.id]
  );

  if (result.rowCount === 0) {
    return apiError("Item not found or not owned by user", 404);
  }

  return apiOk({ success: true });
}
