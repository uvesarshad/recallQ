import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { nanoid } from "nanoid";
import { rateLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/request-auth";
import { getTelegramBotUrl, getTelegramBotUsername } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  // Rotating the link token shouldn't be a hot path — cap to deter a
  // stolen-session attacker from rapidly cycling the token to keep us locked
  // out of any in-flight Telegram link attempt.
  const limit = await rateLimit({
    key: `telegram-token:user:${user.id}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return apiError("Too many token rotations. Try again in an hour.", 429);
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
