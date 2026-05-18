import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { db } from "../lib/db";
import { logger } from "../lib/logger";
import { sendTelegramMessage } from "../lib/telegram";
import { isPushEnabled, sendPushNotification, type PushSubscriptionJSON } from "../lib/push";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
      } else if (channel === 'push' && user.push_subscription && isPushEnabled()) {
        const sub = typeof user.push_subscription === 'string'
          ? JSON.parse(user.push_subscription)
          : user.push_subscription as PushSubscriptionJSON;
        await sendPushNotification(sub, {
          title: `⏰ Reminder`,
          body: label,
          url: item.raw_url ?? undefined,
        });
        logger.info("reminder", `Push sent`, { item_id: item.id });
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
  logger.info("reminder", "Reminder worker started");

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
