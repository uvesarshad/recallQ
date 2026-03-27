require("dotenv").config();

async function main() {
  const appUrl = process.env.APP_URL;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!appUrl || !token || !secret) {
    throw new Error("APP_URL, TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET are required");
  }

  const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/telegram/webhook`;
  const response = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}&secret_token=${encodeURIComponent(secret)}`,
  );
  const result = await response.json();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
