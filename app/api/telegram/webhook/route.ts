import { apiOk } from "@/lib/api";
import { answerArchiveQuestion } from "@/lib/archive-chat";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ingestItem } from "@/lib/ingest";
import { getTelegramBotUrl, getTelegramFile, sendTelegramMessage } from "@/lib/telegram";

function getForwardedText(message: any) {
  if (typeof message.text === "string" && message.text.trim()) return message.text;
  if (typeof message.caption === "string" && message.caption.trim()) return message.caption;

  return [
    message.forward_sender_name,
    message.forward_origin?.chat?.title,
    message.forward_origin?.sender_user?.username,
  ]
    .filter(Boolean)
    .join(" ");
}

function getTelegramReturnUrl() {
  if (!env.APP_URL) {
    return null;
  }

  return new URL("/app?source=telegram", env.APP_URL).toString();
}

export async function POST(req: Request) {
  const secretToken = req.headers.get("X-Telegram-Bot-Api-Secret-Token");

  if (secretToken !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const update = await req.json();

  if (!update.message) {
    return apiOk({ ok: true });
  }

  const { message } = update;
  const chatId = message.chat.id;
  const text = getForwardedText(message);
  const trimmedText = text.trim();
  const commandMatch = trimmedText.match(/^\/([a-z_]+)(?:@\w+)?(?:\s+([\s\S]+))?$/i);
  const command = commandMatch?.[1];
  const commandPayload = commandMatch?.[2]?.trim();
  const telegramReturnUrl = getTelegramReturnUrl();

  if (command === "start" || command === "connect") {
    const token = commandPayload;
    if (!token) {
      await sendTelegramMessage(
        chatId,
        `Open Recall and generate a Telegram connect link, then return here: <a href="${getTelegramBotUrl()}">open bot</a>.`
      );
      return apiOk({ ok: true });
    }

    const userResult = await db.query(
      "SELECT id, telegram_chat_id FROM users WHERE telegram_link_token = $1",
      [token]
    );

    if (userResult.rowCount === 0) {
      await sendTelegramMessage(chatId, "Invalid or expired token. Please try again from the app.");
      return apiOk({ ok: true });
    }

    const userId = userResult.rows[0].id;
    const existingChatId = userResult.rows[0].telegram_chat_id;

    if (existingChatId && Number(existingChatId) === Number(chatId)) {
      await db.query(
        "UPDATE users SET telegram_link_token = NULL WHERE id = $1",
        [userId]
      );
      await sendTelegramMessage(chatId, "Your Recall account is already linked. Send or forward anything here to save it.");
      return apiOk({ ok: true });
    }

    await db.query(
      "UPDATE users SET telegram_chat_id = NULL WHERE telegram_chat_id = $1 AND id <> $2",
      [chatId, userId]
    );

    await db.query(
      "UPDATE users SET telegram_chat_id = $1, telegram_link_token = NULL WHERE id = $2",
      [chatId, userId]
    );

    await sendTelegramMessage(
      chatId,
      "Account linked successfully. Forward links, notes, photos, or documents here and Recall will save them."
    );
    return apiOk({ ok: true });
  }

  // Handle content ingest (Phase 2.11)
  // Check if user is linked
  const userResult = await db.query(
    "SELECT id FROM users WHERE telegram_chat_id = $1",
    [chatId]
  );

  if (userResult.rowCount === 0) {
    await sendTelegramMessage(
      chatId,
      `This Telegram chat is not linked yet. Open Recall, generate a Telegram connect link, then come back here: <a href="${getTelegramBotUrl()}">open bot</a>.`
    );
    return apiOk({ ok: true });
  }

  const userId = userResult.rows[0].id;

  if (command === "help") {
    await sendTelegramMessage(chatId, getHelpMessage());
    return apiOk({ ok: true });
  }

  if (command === "list") {
    const reply = await buildListReply(userId, commandPayload || "");
    await sendTelegramMessage(chatId, reply);
    return apiOk({ ok: true });
  }

  if (command === "ask") {
    const question = commandPayload || "";
    const reply = await answerQuestionReply(userId, question);
    await sendTelegramMessage(chatId, reply);
    return apiOk({ ok: true });
  }

  if (!message.document && !message.photo && isLikelyQuestion(trimmedText)) {
    const reply = await answerQuestionReply(userId, trimmedText);
    await sendTelegramMessage(chatId, reply);
    return apiOk({ ok: true });
  }

  let result: Awaited<ReturnType<typeof ingestItem>> | null = null;
  let confirmationLabel = "Note";

  if (message.document) {
    const file = await getTelegramFile(message.document.file_id);
    result = await ingestItem({
      userId,
      type: "file",
      raw_text: text || null,
      capture_note: message.caption || null,
      source: "telegram",
      fileBuffer: file.buffer,
      fileName: message.document.file_name || file.filePath.split("/").pop() || "telegram-document",
      fileMimeType: message.document.mime_type || "application/octet-stream",
      reminder_channels: ["telegram"],
    });
    confirmationLabel = "Document";
  } else if (Array.isArray(message.photo) && message.photo.length > 0) {
    const photo = message.photo[message.photo.length - 1];
    const file = await getTelegramFile(photo.file_id);
    result = await ingestItem({
      userId,
      type: "file",
      raw_text: text || null,
      capture_note: message.caption || null,
      source: "telegram",
      fileBuffer: file.buffer,
      fileName: file.filePath.split("/").pop() || `telegram-photo-${photo.file_unique_id}.jpg`,
      fileMimeType: "image/jpeg",
      reminder_channels: ["telegram"],
    });
    confirmationLabel = "Photo";
  } else {
    let type: "url" | "note" = "note";
    let raw_url: string | null = null;
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      type = "url";
      raw_url = urlMatch[0];
      confirmationLabel = "URL";
    }

    result = await ingestItem({
      userId,
      type,
      raw_url,
      raw_text: text,
      capture_note: message.caption || null,
      source: "telegram",
      reminder_channels: ["telegram"],
    });
  }

  if (!result) {
    await sendTelegramMessage(chatId, "❌ Unsupported Telegram message type.");
  } else if (result.error === "limit_reached") {
    await sendTelegramMessage(chatId, "⚠️ Limit reached! Please upgrade your plan in the app.");
  } else if (result.error === "unsupported_file_type") {
    await sendTelegramMessage(chatId, "⚠️ That file type is not supported yet.");
  } else if (result.success) {
    const savedLabel =
      confirmationLabel === "Document"
        ? message.document?.file_name || "document"
        : confirmationLabel === "Photo"
          ? "photo"
          : confirmationLabel === "URL"
            ? rawLabel(text)
            : rawLabel(text || message.caption || "note");
    const reminderLine = result.reminder_at
      ? `\nReminder set for <b>${formatTelegramDate(result.reminder_at)}</b>. It will be delivered here on Telegram.`
      : "";
    const openLine = telegramReturnUrl ? `\n<a href="${telegramReturnUrl}">Open Telegram captures in Recall</a>` : "";
    await sendTelegramMessage(
      chatId,
      `Saved ${confirmationLabel.toLowerCase()}: <b>${escapeHtml(savedLabel)}</b>${reminderLine}\nAI enrichment is running now.${openLine}`
    );
  } else {
    await sendTelegramMessage(chatId, "❌ Failed to save. Please try again later.");
  }

  return apiOk({ ok: true });
}

function rawLabel(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 72 ? `${normalized.slice(0, 69)}...` : normalized;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function isLikelyQuestion(input: string) {
  const lowered = input.toLowerCase();
  if (!lowered) return false;
  if (/(https?:\/\/|remind me|follow up|follow-up)/.test(lowered)) return false;
  if (lowered.endsWith("?")) return true;
  return /^(what|which|when|where|why|how|who|find|show me|search|summarize|do i have|have i saved)\b/.test(lowered);
}

async function answerQuestionReply(userId: string, question: string) {
  const response = await answerArchiveQuestion({
    userId,
    query: question,
    timezone: "IST",
  });

  const sources = response.citations
    .filter((citation) => citation.title || citation.url)
    .slice(0, 3)
    .map((citation, index) => {
      const label = citation.title || citation.url || "Source";
      return `${index + 1}. ${escapeHtml(rawLabel(label))}`;
    });

  return sources.length > 0
    ? `${escapeHtml(response.answer)}\n\n<b>Sources</b>\n${sources.join("\n")}`
    : escapeHtml(response.answer);
}

async function buildListReply(userId: string, request: string) {
  const parsed = parseListRequest(request);
  const conditions = ["user_id = $1"];
  const params: any[] = [userId];
  let paramIndex = 2;

  if (parsed.type) {
    conditions.push(`type = $${paramIndex++}`);
    params.push(parsed.type);
  }

  if (parsed.source) {
    conditions.push(`source = $${paramIndex++}`);
    params.push(parsed.source);
  }

  if (parsed.from) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(parsed.from.toISOString());
  }

  if (parsed.query) {
    conditions.push(`(coalesce(title, '') ILIKE $${paramIndex} OR coalesce(raw_text, '') ILIKE $${paramIndex} OR coalesce(raw_url, '') ILIKE $${paramIndex})`);
    params.push(`%${parsed.query}%`);
    paramIndex++;
  }

  const result = await db.query(
    `SELECT id, type, title, raw_url, raw_text, created_at
     FROM items
     WHERE ${conditions.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT 10`,
    params
  );

  if (result.rowCount === 0) {
    return "No saved items matched that list query.";
  }

  const heading = request ? `Latest matches for: <b>${escapeHtml(request)}</b>` : "Latest saved items";
  const lines = result.rows.map((item: any, index: number) => {
    const label = item.title || item.raw_url || rawLabel(item.raw_text || "Untitled");
    const suffix = item.raw_url ? `\n   ${escapeHtml(item.raw_url)}` : "";
    return `${index + 1}. <b>${escapeHtml(rawLabel(label))}</b> (${item.type}, ${formatShortDate(item.created_at)})${suffix}`;
  });

  return `${heading}\n\n${lines.join("\n\n")}`;
}

function parseListRequest(input: string) {
  const lowered = input.toLowerCase();
  let query = input.trim();
  let type: "url" | "file" | "note" | "text" | null = null;
  let source: "telegram" | "pwa-share" | "email" | "web" | "manual" | null = null;
  let from: Date | null = null;

  if (/\b(links|link|urls|url)\b/.test(lowered)) {
    type = "url";
    query = query.replace(/\b(links|link|urls|url)\b/gi, "");
  } else if (/\b(files|file|docs|documents|pdfs|pdf)\b/.test(lowered)) {
    type = "file";
    query = query.replace(/\b(files|file|docs|documents|pdfs|pdf)\b/gi, "");
  } else if (/\b(notes|note|texts|text)\b/.test(lowered)) {
    type = "note";
    query = query.replace(/\b(notes|note|texts|text)\b/gi, "");
  }

  if (/\btelegram\b/.test(lowered)) {
    source = "telegram";
    query = query.replace(/\btelegram\b/gi, "");
  }

  const now = new Date();
  if (/\btoday\b/.test(lowered)) {
    from = new Date(now);
    from.setHours(0, 0, 0, 0);
    query = query.replace(/\btoday\b/gi, "");
  } else if (/\byesterday\b/.test(lowered)) {
    from = new Date(now);
    from.setDate(from.getDate() - 1);
    from.setHours(0, 0, 0, 0);
    query = query.replace(/\byesterday\b/gi, "");
  } else if (/\bthis week\b/.test(lowered)) {
    from = new Date(now);
    from.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    from.setHours(0, 0, 0, 0);
    query = query.replace(/\bthis week\b/gi, "");
  }

  query = query.replace(/\bsaved\b/gi, "").trim();

  return {
    type,
    source,
    from,
    query,
  };
}

function getHelpMessage() {
  return [
    "<b>Recall Telegram commands</b>",
    "/list",
    "/list links saved today",
    "/list telegram this week",
    "/ask What did I save about invoices?",
    "",
    "You can also:",
    "• send a link or note to save it",
    "• add natural reminders like “remind me to fill this form on Tuesday”",
    "• ask a normal question and I will search your saved archive",
  ].join("\n");
}

function formatTelegramDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}
