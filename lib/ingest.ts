import { db } from "@/lib/db";
import { canUserSave, Plan, PLAN_LIMITS } from "@/lib/plan-limits";
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
  // Get user plan and usage
  const userResult = await db.query(
    "SELECT plan, saves_this_month FROM users WHERE id = $1",
    [payload.userId]
  );
  
  if (userResult.rowCount === 0) {
    throw new Error("User not found");
  }

  const user = userResult.rows[0];

  if (!canUserSave(user.plan as Plan, user.saves_this_month)) {
    return { error: "limit_reached" };
  }

  // File size check
  if (payload.fileBuffer) {
    const limitMB = PLAN_LIMITS[user.plan as Plan].maxFileUploadSizeMB;
    if (payload.fileBuffer.length > limitMB * 1024 * 1024) {
      return { error: "file_too_large" };
    }
  }

  if (payload.fileBuffer && !isAcceptedMimeType(payload.fileMimeType)) {
    return { error: "unsupported_file_type" };
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

  if (inferred.reminderAt) {
    await db.query(
      `INSERT INTO reminders (item_id, user_id, remind_at, channels)
       VALUES ($1, $2, $3, '{email}')`,
      [itemId, payload.userId, inferred.reminderAt],
    );
  }

  // Increment usage
  await db.query(
    "UPDATE users SET saves_this_month = saves_this_month + 1 WHERE id = $1",
    [payload.userId]
  );

  if (inferred.reminderAt) {
    await db.query(
      `UPDATE reminders
       SET channels = $1
       WHERE item_id = $2 AND user_id = $3 AND sent = FALSE`,
      [payload.reminder_channels ?? ["email"], itemId, payload.userId],
    );
  }

  return {
    success: true,
    id: itemResult.rows[0].id,
    enrich_status: "pending" as const,
    reminder_at: inferred.reminderAt || null,
  };
}
