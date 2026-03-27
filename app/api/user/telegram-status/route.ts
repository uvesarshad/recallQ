import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { requireSessionUser } from "@/lib/request-auth";
import { getTelegramBotUrl, getTelegramBotUsername } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const result = await db.query(
    "SELECT telegram_chat_id FROM users WHERE id = $1",
    [user.id]
  );

  return apiOk({
    linked: !!result.rows[0]?.telegram_chat_id,
    botUsername: getTelegramBotUsername(),
    botUrl: getTelegramBotUrl(),
  });
}
