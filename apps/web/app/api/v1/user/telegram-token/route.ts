import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { nanoid } from "nanoid";
import { requireSessionUser } from "@/lib/request-auth";
import { getTelegramBotUrl, getTelegramBotUsername } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const token = nanoid(10);

  await db.query(
    "UPDATE users SET telegram_link_token = $1 WHERE id = $2",
    [token, user.id]
  );

  return apiOk({
    token,
    botUsername: getTelegramBotUsername(),
    botUrl: getTelegramBotUrl(token),
  });
}
