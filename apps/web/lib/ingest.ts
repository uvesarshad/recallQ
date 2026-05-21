import { db } from "@/lib/db";
import { getPlanLimits, getMaxReminders, Plan } from "@/lib/plan-limits";
import { inferCaptureActions } from "./comment-actions";
import { isAcceptedMimeType, saveFile } from "./storage";

export interface IngestPayload {
  userId: string;
  type: "url" | "text" | "file" | "note";
  title?: string | null;
  tags?: string[];
  raw_url?: string | null;
  raw_text?: string | null;
  capture_note?: string | null;
  reminder_at?: string | null;
  reminder_channels?: string[];
  actionOverrides?: {
    tags?: string[];
    categoryName?: string | null;
    reminderAt?: string | null;
  };
  source: "web" | "pwa-share" | "telegram" | "email" | "extension" | "manual";
  collection_id?: string | null;
  fileBuffer?: Buffer | null;
  fileName?: string | null;
  fileMimeType?: string | null;
}

export async function ingestItem(payload: IngestPayload) {
  // Read plan info first (needed for file-size check and limit cap value).
  const userResult = await db.query(
    "SELECT plan, saves_this_month, storage_used_bytes FROM users WHERE id = $1",
    [payload.userId]
  );

  if (userResult.rowCount === 0) {
    throw new Error("User not found");
  }

  const user = userResult.rows[0];
  const limits = getPlanLimits(user.plan as Plan);

  // File checks before we touch the counter.
  if (payload.fileBuffer) {
    if (payload.fileBuffer.length > limits.maxFileUploadSizeMB * 1024 * 1024) {
      return { error: "file_too_large" };
    }
    const projectedBytes = (user.storage_used_bytes ?? 0) + payload.fileBuffer.length;
    if (projectedBytes > limits.maxStorageBytes) {
      return { error: "storage_limit_reached" };
    }
  }

  if (payload.fileBuffer && !isAcceptedMimeType(payload.fileMimeType)) {
    return { error: "unsupported_file_type" };
  }

  // Atomic increment: only succeeds when the current count is below the cap.
  // This eliminates the read-check-increment race condition.
  const cap = limits.maxSavesPerMonth;
  const incrementResult = await db.query(
    `UPDATE users
     SET saves_this_month = saves_this_month + 1
     WHERE id = $1 AND saves_this_month < $2
     RETURNING saves_this_month`,
    [payload.userId, cap]
  );

  if (incrementResult.rowCount === 0) {
    return { error: "limit_reached" };
  }

  const inferred = await inferCaptureActions({
    userId: payload.userId,
    body: [payload.title, payload.raw_text, payload.capture_note, payload.raw_url].filter(Boolean).join("\n"),
    existingCollectionId: payload.collection_id,
    existingReminderAt: payload.reminder_at,
    existingTags: payload.tags ?? [],
    overrides: payload.actionOverrides,
  });

  // Pre-insert to get ID for file path if needed
  // (Alternatively we can generate a UUID here)
  const itemId = (await db.query("SELECT uuid_generate_v4() as id")).rows[0].id;

  let filePath = null;
  if (payload.fileBuffer && payload.fileName) {
    filePath = await saveFile(payload.userId, itemId, payload.fileName, payload.fileBuffer);
  }

  // Insert item
  const itemResult = await db.query(
    `INSERT INTO items (
       id, user_id, collection_id, type, raw_url, raw_text, title, tags, source, capture_note,
       reminder_at, enriched, file_path, file_name, file_mime_type
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING id`,
    [
      itemId,
      payload.userId,
      inferred.collectionId || null,
      payload.type,
      payload.raw_url || null,
      payload.raw_text || null,
      payload.title || null,
      inferred.tags,
      payload.source,
      payload.capture_note || null,
      inferred.reminderAt || null,
      false,
      filePath,
      payload.fileName || null,
      payload.fileMimeType || null,
    ]
  );

  // Track storage for all item types.
  let storageDelta = 0;
  if (payload.fileBuffer) {
    storageDelta = payload.fileBuffer.length;
  } else if (payload.raw_text) {
    storageDelta = Buffer.byteLength(payload.raw_text, "utf8");
  } else if (payload.raw_url) {
    storageDelta = Buffer.byteLength(payload.raw_url, "utf8");
  }
  if (storageDelta > 0) {
    await db.query(
      "UPDATE users SET storage_used_bytes = storage_used_bytes + $1 WHERE id = $2",
      [storageDelta, payload.userId]
    );
  }

  if (inferred.reminderAt) {
    // Check reminder cap before inserting.
    const maxReminders = getMaxReminders(user.plan as Plan);
    const reminderCount = await db.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM reminders WHERE user_id = $1 AND sent = FALSE",
      [payload.userId]
    );
    const activeCount = parseInt(reminderCount.rows[0].count, 10);

    if (activeCount < maxReminders) {
      const channels = payload.reminder_channels ?? ["email"];
      await db.query(
        `INSERT INTO reminders (item_id, user_id, remind_at, channels)
         VALUES ($1, $2, $3, $4)`,
        [itemId, payload.userId, inferred.reminderAt, channels],
      );
    }
  }

  return {
    success: true,
    id: itemResult.rows[0].id,
    enrich_status: "pending" as const,
    reminder_at: inferred.reminderAt || null,
  };
}
