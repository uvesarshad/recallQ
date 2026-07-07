import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { enqueueJob } from "@/lib/jobs";
import { requireUser } from "@/lib/request-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateFeedSchema = z.object({
  title: z.string().trim().max(200).nullable().optional(),
  collection_id: z.string().uuid().nullable().optional(),
  enabled: z.boolean().optional(),
  poll_interval_minutes: z.number().int().min(15).max(24 * 60).optional(),
  sync_now: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req);
  if (!user) return apiError("Unauthorized", 401);
  const { id } = await params;

  const parsed = updateFeedSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("Invalid RSS feed update", 400);

  if (parsed.data.collection_id) {
    const collection = await db.query("SELECT id FROM collections WHERE id = $1 AND user_id = $2", [
      parsed.data.collection_id,
      user.id,
    ]);
    if (collection.rowCount === 0) return apiError("Collection not found", 404);
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  for (const [field, value] of Object.entries(parsed.data)) {
    if (field === "sync_now" || value === undefined) continue;
    updates.push(`${field} = $${index++}`);
    values.push(value);
  }

  if (updates.length > 0) {
    updates.push("updated_at = NOW()");
    values.push(id, user.id);
    const result = await db.query(
      `UPDATE rss_feeds SET ${updates.join(", ")} WHERE id = $${index++} AND user_id = $${index}`,
      values,
    );
    if (result.rowCount === 0) return apiError("RSS feed not found", 404);
  } else {
    const existing = await db.query("SELECT id FROM rss_feeds WHERE id = $1 AND user_id = $2", [id, user.id]);
    if (existing.rowCount === 0) return apiError("RSS feed not found", 404);
  }

  if (parsed.data.sync_now) {
    await enqueueJob({ type: "import", userId: user.id, payload: { kind: "rss_feed", feedId: id } });
  }

  return apiOk({ success: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req);
  if (!user) return apiError("Unauthorized", 401);
  const { id } = await params;

  const result = await db.query("DELETE FROM rss_feeds WHERE id = $1 AND user_id = $2", [id, user.id]);
  if (result.rowCount === 0) return apiError("RSS feed not found", 404);

  return apiOk({ success: true });
}
