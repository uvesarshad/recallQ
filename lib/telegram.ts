import { env, requireEnv } from "@/lib/env";

export function getTelegramBotUsername() {
  return env.TELEGRAM_BOT_USERNAME || "RecallBot";
}

export function getTelegramBotUrl(startToken?: string) {
  const username = getTelegramBotUsername();
  const url = new URL(`https://t.me/${username}`);
  if (startToken) {
    url.searchParams.set("start", startToken);
  }

  return url.toString();
}

export async function sendTelegramMessage(chatId: string | number, text: string) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });
  } catch (err) {
    console.error("Failed to send Telegram message:", err);
  }
}

export async function setTelegramWebhook(url: string) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const secretToken = env.TELEGRAM_WEBHOOK_SECRET;
  if (!token) return;

  const apiUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${url}&secret_token=${secretToken}`;
  const res = await fetch(apiUrl);
  return await res.json();
}

export async function getTelegramFile(fileId: string) {
  const token = requireEnv("TELEGRAM_BOT_TOKEN");
  const response = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
  const data = await response.json();
  const filePath = data?.result?.file_path;
  if (!filePath) {
    throw new Error("Telegram file path missing");
  }

  const fileResponse = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  const buffer = Buffer.from(await fileResponse.arrayBuffer());
  return { buffer, filePath };
}
