import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { isPushEnabled } from "@/lib/push";
import { requireSessionUser } from "@/lib/request-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(req: Request) {
  const user = await requireSessionUser();
  if (!user) return apiError("Unauthorized", 401);

  if (!isPushEnabled()) return apiError("Push notifications are not configured", 501);

  const parsed = subscriptionSchema.safeParse(await req.json());
  if (!parsed.success) return apiError("Invalid subscription payload", 400);

  await db.query(
    "UPDATE users SET push_subscription = $1, updated_at = NOW() WHERE id = $2",
    [JSON.stringify(parsed.data), user.id]
  );

  return apiOk({ registered: true });
}

export async function DELETE(req: Request) {
  const user = await requireSessionUser();
  if (!user) return apiError("Unauthorized", 401);

  await db.query(
    "UPDATE users SET push_subscription = NULL, updated_at = NOW() WHERE id = $1",
    [user.id]
  );

  return apiOk({ unregistered: true });
}
