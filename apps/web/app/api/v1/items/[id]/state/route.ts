import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { clampReadingProgress, inferReadingState } from "@/lib/reader-state";
import { requireUser } from "@/lib/request-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const itemStateSchema = z.object({
  reading_progress: z.number().finite().min(0).max(100).optional(),
  reading_state: z.enum(["unread", "reading", "read"]).optional(),
  reader_position: z.string().trim().max(200).nullable().optional(),
  is_favorite: z.boolean().optional(),
  is_archived: z.boolean().optional(),
  is_read_later: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(req);
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const parsed = itemStateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError("Invalid item state", 400);
  }

  const { id } = await params;
  const data = parsed.data;
  const updates: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  const progress =
    data.reading_progress !== undefined ? clampReadingProgress(data.reading_progress) : undefined;
  const readingState =
    data.reading_state !== undefined || progress !== undefined
      ? inferReadingState({
          reading_progress: progress,
          reading_state: data.reading_state ?? null,
        })
      : undefined;

  if (progress !== undefined) {
    updates.push(`reading_progress = $${index++}`);
    values.push(progress);
  }
  if (readingState !== undefined) {
    updates.push(`reading_state = $${index++}`);
    values.push(readingState);
    updates.push(`reading_started_at = CASE
      WHEN reading_started_at IS NULL AND $${index - 1} IN ('reading', 'read') THEN NOW()
      ELSE reading_started_at
    END`);
    updates.push(`reading_completed_at = CASE
      WHEN $${index - 1} = 'read' THEN COALESCE(reading_completed_at, NOW())
      WHEN $${index - 1} <> 'read' THEN NULL
      ELSE reading_completed_at
    END`);
  }
  if (data.reader_position !== undefined) {
    updates.push(`reader_position = $${index++}`);
    values.push(data.reader_position);
  }
  if (data.is_favorite !== undefined) {
    updates.push(`is_favorite = $${index++}`);
    values.push(data.is_favorite);
  }
  if (data.is_archived !== undefined) {
    updates.push(`is_archived = $${index++}`);
    values.push(data.is_archived);
  }
  if (data.is_read_later !== undefined) {
    updates.push(`is_read_later = $${index++}`);
    values.push(data.is_read_later);
  }

  if (updates.length === 0) {
    return apiError("No valid fields to update", 400);
  }

  updates.push("updated_at = NOW()");
  values.push(id, user.id);

  const result = await db.query(
    `UPDATE items
     SET ${updates.join(", ")}
     WHERE id = $${index++} AND user_id = $${index}
     RETURNING id,
               reading_progress,
               reading_state,
               reader_position,
               is_favorite,
               is_archived,
               is_read_later,
               reading_started_at,
               reading_completed_at,
               updated_at`,
    values,
  );

  if (result.rowCount === 0) {
    return apiError("Item not found", 404);
  }

  return apiOk({ item: result.rows[0] });
}
