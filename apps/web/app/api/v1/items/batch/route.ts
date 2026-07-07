import { apiError, apiOk } from "@/lib/api";
import { deleteArchiveAssetsForItems } from "@/lib/archive-assets";
import { db } from "@/lib/db";
import { recordItemTombstones } from "@/lib/item-tombstones";
import { requireSessionUser } from "@/lib/request-auth";
import { deleteFile } from "@/lib/storage";
import { enqueueWebhookEvent } from "@/lib/webhooks";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateActionSchema = z.object({
  kind: z.literal("update"),
  collection_id: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  reminder_at: z.string().datetime().nullable().optional(),
});

const deleteActionSchema = z.object({
  kind: z.literal("delete"),
});

const batchSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.union([updateActionSchema, deleteActionSchema]),
});

export async function POST(req: Request) {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const parsed = batchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError("Invalid batch request", 400);
  }

  const {
    ids,
    action,
  } = parsed.data;

  const uniqueIds = Array.from(new Set(ids));
  const ownedItems = await db.query<{ id: string; file_path: string | null }>(
    "SELECT id, file_path FROM items WHERE user_id = $1 AND id = ANY($2::uuid[])",
    [user.id, uniqueIds],
  );

  if (ownedItems.rows.length !== uniqueIds.length) {
    return apiError("One or more items were not found", 404);
  }

  if (action.kind === "delete") {
    await recordItemTombstones(user.id, uniqueIds);
    await deleteArchiveAssetsForItems(user.id, uniqueIds);
    await db.query("DELETE FROM items WHERE user_id = $1 AND id = ANY($2::uuid[])", [user.id, uniqueIds]);
    for (const item of ownedItems.rows) {
      if (item.file_path) {
        await deleteFile(user.id, item.file_path);
      }
    }
    await Promise.all(uniqueIds.map((id) => enqueueWebhookEvent({
      userId: user.id,
      event: "item.deleted",
      itemId: null,
      data: { id },
    }).catch((error) => {
      console.warn("Failed to enqueue item.deleted webhook", error);
    })));
    return apiOk({ success: true, count: uniqueIds.length, action: "delete" });
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  if (action.collection_id !== undefined) {
    updates.push(`collection_id = $${index++}`);
    values.push(action.collection_id);
  }

  if (action.tags !== undefined) {
    updates.push(`tags = $${index++}`);
    values.push(action.tags);
  }

  if (action.reminder_at !== undefined) {
    updates.push(`reminder_at = $${index++}`);
    values.push(action.reminder_at);
  }

  if (updates.length === 0) {
    return apiError("No valid updates provided", 400);
  }

  updates.push("updated_at = NOW()");
  values.push(user.id, uniqueIds);

  await db.query(
    `UPDATE items
     SET ${updates.join(", ")}
     WHERE user_id = $${index++} AND id = ANY($${index}::uuid[])`,
    values,
  );

  if (action.reminder_at !== undefined) {
    await db.query(
      "DELETE FROM reminders WHERE user_id = $1 AND item_id = ANY($2::uuid[]) AND sent = FALSE",
      [user.id, uniqueIds],
    );

    if (action.reminder_at) {
      await db.query(
        `INSERT INTO reminders (item_id, user_id, remind_at, channels)
         SELECT id, $1, $2, '{email}'
         FROM items
         WHERE user_id = $1 AND id = ANY($3::uuid[])`,
        [user.id, action.reminder_at, uniqueIds],
      );
    }
  }

  await Promise.all(uniqueIds.map((id) => enqueueWebhookEvent({
    userId: user.id,
    event: "item.updated",
    itemId: id,
    data: { id, fields: Object.keys(action).filter((field) => field !== "kind") },
  }).catch((error) => {
    console.warn("Failed to enqueue item.updated webhook", error);
  })));

  return apiOk({ success: true, count: uniqueIds.length, action: "update" });
}
