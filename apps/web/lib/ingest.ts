import { db } from "@/lib/db";
import { enqueuePageArchive } from "@/lib/archive-assets";
import { applyAutomationRules, shouldSkipCaptureByRules } from "@/lib/automation-rules";
import { getPlanLimits, getMaxReminders, type Plan } from "@/lib/plan-limits";
import { getHostname } from "@/lib/relations";
import { enqueueWebhookEvent } from "@/lib/webhooks";
import { ensureCollection, inferCaptureActions } from "./comment-actions";
import { isAcceptedMimeType, removeStoredFile, saveFile } from "./storage";
import { randomUUID } from "crypto";

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
  source: "web" | "pwa-share" | "telegram" | "email" | "extension" | "mobile" | "rss" | "manual";
  automationEvent?: "capture" | "import" | "rss";
  collection_id?: string | null;
  archive_page?: boolean;
  fileBuffer?: Buffer | null;
  fileName?: string | null;
  fileMimeType?: string | null;
}

export async function ingestItem(payload: IngestPayload) {
  if (
    await shouldSkipCaptureByRules({
      userId: payload.userId,
      event: payload.automationEvent ?? "capture",
      title: payload.title,
      url: payload.raw_url,
      text: payload.raw_text,
      source: payload.source,
      tags: payload.tags,
    })
  ) {
    return { error: "skipped_by_rule" };
  }

  if (payload.fileBuffer && !isAcceptedMimeType(payload.fileMimeType)) {
    return { error: "unsupported_file_type" };
  }
  if (payload.archive_page && (payload.type !== "url" || !payload.raw_url)) {
    return { error: "archive_requires_url" };
  }

  const inferred = await inferCaptureActions({
    userId: payload.userId,
    body: [payload.title, payload.raw_text, payload.capture_note, payload.raw_url].filter(Boolean).join("\n"),
    existingCollectionId: payload.collection_id,
    existingReminderAt: payload.reminder_at,
    existingTags: payload.tags ?? [],
    overrides: payload.actionOverrides,
    resolveCollection: false,
  });
  const finalTags = inferred.tags;

  const itemId = randomUUID();
  let filePath: string | null = null;
  let fileSaved = false;
  let committedReminderAt: string | null = null;
  const urlHost = getHostname(payload.raw_url);

  let storageDelta = 0;
  if (payload.fileBuffer) {
    storageDelta = payload.fileBuffer.length;
  } else if (payload.raw_text) {
    storageDelta = Buffer.byteLength(payload.raw_text, "utf8");
  } else if (payload.raw_url) {
    storageDelta = Buffer.byteLength(payload.raw_url, "utf8");
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      "SELECT plan, saves_this_month, storage_used_bytes FROM users WHERE id = $1 FOR UPDATE",
      [payload.userId],
    );

    if (userResult.rowCount === 0) {
      throw new Error("User not found");
    }

    const user = userResult.rows[0];
    const plan = user.plan as Plan;
    const limits = getPlanLimits(plan);

    if (payload.fileBuffer && payload.fileBuffer.length > limits.maxFileUploadSizeMB * 1024 * 1024) {
      await client.query("ROLLBACK");
      return { error: "file_too_large" };
    }

    if (
      Number.isFinite(limits.maxSavesPerMonth) &&
      Number(user.saves_this_month ?? 0) >= limits.maxSavesPerMonth
    ) {
      await client.query("ROLLBACK");
      return { error: "limit_reached" };
    }

    if (
      storageDelta > 0 &&
      Number.isFinite(limits.maxStorageBytes) &&
      Number(user.storage_used_bytes ?? 0) + storageDelta > limits.maxStorageBytes
    ) {
      await client.query("ROLLBACK");
      return { error: "storage_limit_reached" };
    }

    if (payload.fileBuffer && payload.fileName) {
      filePath = await saveFile(payload.userId, itemId, payload.fileName, payload.fileBuffer);
      fileSaved = true;
    }

    let collectionId: string | null = null;
    if (payload.collection_id) {
      const collection = await client.query(
        "SELECT id FROM collections WHERE id = $1 AND user_id = $2",
        [payload.collection_id, payload.userId],
      );
      if (collection.rowCount === 0) {
        await client.query("ROLLBACK");
        if (fileSaved && filePath) {
          await removeStoredFile(filePath).catch(() => undefined);
        }
        return { error: "invalid_collection" };
      }
      collectionId = payload.collection_id;
    } else if (inferred.categoryName) {
      collectionId = await ensureCollection(payload.userId, inferred.categoryName, client);
    }

    const itemResult = await client.query(
      `INSERT INTO items (
         id, user_id, collection_id, type, raw_url, url_host, raw_text, title, tags, source, capture_note,
         reminder_at, enriched, file_path, file_name, file_mime_type
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING id`,
      [
        itemId,
        payload.userId,
        collectionId,
        payload.type,
        payload.raw_url || null,
        urlHost,
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
      ],
    );

    await client.query(
      `UPDATE users
       SET saves_this_month = saves_this_month + 1,
           storage_used_bytes = storage_used_bytes + $2
       WHERE id = $1`,
      [payload.userId, storageDelta],
    );

    if (inferred.reminderAt) {
      const maxReminders = getMaxReminders(plan);
      const reminderCount = await client.query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM reminders WHERE user_id = $1 AND sent = FALSE",
        [payload.userId],
      );
      const activeCount = parseInt(reminderCount.rows[0].count, 10);

      if (!Number.isFinite(maxReminders) || activeCount < maxReminders) {
        const channels = payload.reminder_channels ?? ["email"];
        await client.query(
          `INSERT INTO reminders (item_id, user_id, remind_at, channels)
           VALUES ($1, $2, $3, $4)`,
          [itemId, payload.userId, inferred.reminderAt, channels],
        );
        committedReminderAt = inferred.reminderAt;
      }
    }

    let archiveJobId: string | null = null;
    if (payload.archive_page && payload.raw_url) {
      archiveJobId = await enqueuePageArchive({
        db: client,
        userId: payload.userId,
        itemId,
        sourceUrl: payload.raw_url,
      });
    }

    await client.query("COMMIT");

    await applyAutomationRules({
      itemId,
      userId: payload.userId,
      event: payload.automationEvent ?? "capture",
      title: payload.title,
      url: payload.raw_url,
      text: payload.raw_text,
      source: payload.source,
      tags: inferred.tags,
    });

    await enqueueWebhookEvent({
      userId: payload.userId,
      event: "item.created",
      itemId,
      data: {
        id: itemId,
        type: payload.type,
        title: payload.title ?? null,
        source: payload.source,
      },
    }).catch((error) => {
      console.warn("Failed to enqueue item.created webhook", error);
    });

    return {
      success: true,
      id: itemResult.rows[0].id,
      enrich_status: "pending" as const,
      reminder_at: committedReminderAt,
      archive_status: payload.archive_page ? ("pending" as const) : ("not_requested" as const),
      archive_job_id: archiveJobId,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (fileSaved && filePath) {
      await removeStoredFile(filePath).catch(() => undefined);
    }
    throw error;
  } finally {
    client.release();
  }
}
