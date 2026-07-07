import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { normalizeHighlightColor, normalizeHighlightQuote } from "@/lib/reader-state";
import { requireUser } from "@/lib/request-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const highlightUpdateSchema = z.object({
  quote: z.string().trim().min(1).max(2000).optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  color: z.string().trim().max(20).optional(),
  range_start: z.number().int().min(0).nullable().optional(),
  range_end: z.number().int().min(0).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; highlightId: string }> },
) {
  const user = await requireUser(req);
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const parsed = highlightUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError("Invalid highlight", 400);
  }

  const { id, highlightId } = await params;
  const data = parsed.data;
  const updates: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  if (data.quote !== undefined) {
    updates.push(`quote = $${index++}`);
    values.push(normalizeHighlightQuote(data.quote));
  }
  if (data.note !== undefined) {
    updates.push(`note = $${index++}`);
    values.push(data.note);
  }
  if (data.color !== undefined) {
    updates.push(`color = $${index++}`);
    values.push(normalizeHighlightColor(data.color));
  }
  if (data.range_start !== undefined) {
    updates.push(`range_start = $${index++}`);
    values.push(data.range_start);
  }
  if (data.range_end !== undefined) {
    updates.push(`range_end = $${index++}`);
    values.push(data.range_end);
  }

  if (updates.length === 0) {
    return apiError("No valid fields to update", 400);
  }

  updates.push("updated_at = NOW()");
  values.push(highlightId, id, user.id);

  const result = await db.query(
    `UPDATE item_highlights
     SET ${updates.join(", ")}
     WHERE id = $${index++}
       AND item_id = $${index++}
       AND user_id = $${index}
     RETURNING id,
               item_id,
               quote,
               note,
               color,
               range_start,
               range_end,
               created_at,
               updated_at`,
    values,
  );

  if (result.rowCount === 0) {
    return apiError("Highlight not found", 404);
  }

  return apiOk({ highlight: result.rows[0] });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; highlightId: string }> },
) {
  const user = await requireUser(req);
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const { id, highlightId } = await params;
  const result = await db.query(
    "DELETE FROM item_highlights WHERE id = $1 AND item_id = $2 AND user_id = $3",
    [highlightId, id, user.id],
  );

  if (result.rowCount === 0) {
    return apiError("Highlight not found", 404);
  }

  return apiOk({ success: true });
}
