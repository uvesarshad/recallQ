import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { requireSessionUser } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function DELETE() {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  await db.query(
    "UPDATE users SET telegram_chat_id = NULL, telegram_link_token = NULL WHERE id = $1",
    [user.id]
  );

  return apiOk({ linked: false });
}
