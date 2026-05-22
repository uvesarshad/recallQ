import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { db } from "../lib/db";
import { logger } from "../lib/logger";
import { sendTelegramMessage } from "../lib/telegram";
import { isPushEnabled, sendPushNotification, type PushSubscriptionJSON } from "../lib/push";
import {
  isPermanentlyInvalid,
  sendExpoPushBatch,
  type ExpoPushMessage,
} from "../lib/expo-push";
import { installCrashHandlers, startHeartbeat } from "../lib/worker-heartbeat";
import { Resend } from "resend";

// Resend's constructor throws when RESEND_API_KEY is missing (since v6.x).
// Make it lazy so the worker can still run for Telegram + push deliveries
// when email isn't configured. Email channels are skipped with a warn.
let cachedResend: Resend | null = null;
function getResend(): Resend | null {
  if (cachedResend) return cachedResend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  cachedResend = new Resend(key);
  return cachedResend;
}

async function sendReminder(reminder: any) {
  const { channels, user_id, item_id } = reminder;

  const itemResult = await db.query(
    "SELECT id, title, raw_url, raw_text, capture_note, type FROM items WHERE id = $1",
    [item_id]
  );
  if (itemResult.rowCount === 0) return;
  const item = itemResult.rows[0];

  const userResult = await db.query("SELECT email, telegram_chat_id, push_subscription FROM users WHERE id = $1", [user_id]);
  if (userResult.rowCount === 0) return;
  const user = userResult.rows[0];

  const label = item.title || summarizeText(item.capture_note || item.raw_text || item.raw_url || "Saved item");
  const subject = `⏰ Reminder: ${label}`;
  const body = `This is your reminder for: ${label}

Link: ${item.raw_url || "N/A"}`;

  for (const channel of channels) {
    try {
      if (channel === 'email' && user.email) {
        const resend = getResend();
        if (!resend) {
          logger.warn("reminder", "RESEND_API_KEY not set — skipping email channel", { item_id: item.id });
          continue;
        }
        await resend.emails.send({
          from: `reminders@${process.env.APP_DOMAIN}`,
          to: user.email,
          subject: subject,
          text: body,
        });
        logger.info("reminder", `Email sent`, { item_id: item.id, email: user.email });
      } else if (channel === 'telegram' && user.telegram_chat_id) {
        const telegramBody = [
          "<b>Reminder</b>",
          escapeHtml(label),
          item.raw_url ? escapeHtml(item.raw_url) : null,
        ].filter(Boolean).join("\n");
        await sendTelegramMessage(user.telegram_chat_id, telegramBody);
        logger.info("reminder", `Telegram sent`, { item_id: item.id });
      } else if (channel === 'push') {
        // Fan out to BOTH web push (browser) and Expo Push (mobile) so a
        // user with their phone signed in gets the reminder even if they
        // haven't accepted web push in the browser. Both are best-effort.
        if (user.push_subscription && isPushEnabled()) {
          const sub = typeof user.push_subscription === 'string'
            ? JSON.parse(user.push_subscription)
            : user.push_subscription as PushSubscriptionJSON;
          await sendPushNotification(sub, {
            title: `⏰ Reminder`,
            body: label,
            url: item.raw_url ?? undefined,
          });
          logger.info("reminder", `Web push sent`, { item_id: item.id });
        }

        await sendExpoPushToUser(user_id, label, {
          id: String(item.id),
          raw_url: item.raw_url ?? null,
        });
      }
    } catch (err) {
      logger.error("reminder", `Channel failed`, { channel, item_id: item.id, error: String(err) });
    }
  }

  // Mark as sent
  await db.query("UPDATE reminders SET sent = true, sent_at = NOW() WHERE id = $1", [reminder.id]);
  await db.query("UPDATE items SET reminder_sent = true WHERE id = $1", [item_id]);
}

function summarizeText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 90 ? `${normalized.slice(0, 87)}...` : normalized;
}

// Fans a reminder out to every active Expo Push token for `userId`. Marks
// tokens revoked when Expo reports them as permanently invalid
// (DeviceNotRegistered = app uninstalled / push permission removed).
async function sendExpoPushToUser(
  userId: string,
  label: string,
  item: { id: string; raw_url: string | null },
): Promise<void> {
  const tokensResult = await db.query<{ id: string; token: string }>(
    `SELECT id, token FROM device_push_tokens
      WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
  if (tokensResult.rowCount === 0) return;

  const messages: ExpoPushMessage[] = tokensResult.rows.map((row) => ({
    to: row.token,
    title: "⏰ Reminder",
    body: label,
    sound: "default",
    priority: "high",
    // Mobile app reads `data.itemId` on notification tap to deep-link.
    data: { itemId: item.id, url: item.raw_url ?? null },
  }));

  const results = await sendExpoPushBatch(messages);
  const revokeIds: string[] = [];
  for (let i = 0; i < results.length; i++) {
    if (isPermanentlyInvalid(results[i].ticket)) {
      revokeIds.push(tokensResult.rows[i].id);
    }
  }
  if (revokeIds.length > 0) {
    await db.query(
      `UPDATE device_push_tokens SET revoked_at = now() WHERE id = ANY($1::uuid[])`,
      [revokeIds],
    );
    logger.warn("reminder", "Revoked dead Expo tokens", { count: revokeIds.length });
  }
  logger.info("reminder", "Expo Push sent", {
    item_id: item.id,
    sent: messages.length,
    revoked: revokeIds.length,
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

let lastResetMonth = -1;

async function checkMonthlyReset() {
  const now = new Date();
  // Only reset on the 1st of the month, and only once per month (guard against
  // the worker firing every minute during the midnight hour).
  if (now.getUTCDate() === 1 && now.getUTCHours() === 0 && now.getUTCMonth() !== lastResetMonth) {
    logger.info("reminder", "Running monthly reset of saves_this_month");
    await db.query("UPDATE users SET saves_this_month = 0");
    lastResetMonth = now.getUTCMonth();
  }
}

async function startWorker() {
  installCrashHandlers("reminder");
  startHeartbeat("reminders");
  logger.info("reminder", "Reminder worker started", { pid: process.pid });

  while (true) {
    try {
      // Check for due reminders
      const result = await db.query(
        "SELECT * FROM reminders WHERE remind_at <= NOW() AND sent = FALSE LIMIT 10"
      );
      for (const reminder of result.rows) {
        await sendReminder(reminder);
      }
      
      // Check for monthly reset
      await checkMonthlyReset();

    } catch (err) {
      logger.error("reminder", "Batch failed", { error: String(err) });
    }

    await new Promise((resolve) => setTimeout(resolve, 60000)); // Poll every 60 seconds
  }
}

startWorker();
