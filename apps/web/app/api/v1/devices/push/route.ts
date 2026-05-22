import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api-response";
import { isExpoPushToken } from "@/lib/expo-push";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/request-auth";

const RegisterSchema = z.object({
  token: z
    .string()
    .min(1)
    .max(256)
    .refine(isExpoPushToken, { message: "Not a valid Expo Push token" }),
  platform: z.enum(["ios", "android", "web"]),
  device_name: z.string().min(1).max(64).optional(),
});

// POST /api/v1/devices/push — register the current device's Expo Push
// token. Idempotent: re-registering the same token updates `last_seen_at`
// and `device_name` rather than failing on the UNIQUE constraint. Accepts
// either a NextAuth session (web) or a bearer PAT (mobile / extension).
export async function POST(req: Request): Promise<Response> {
  const user = await requireUser(req);
  if (!user) return fail("unauthorized", "Sign in required", 401);

  // Idempotent registration but still gate against a misbehaving mobile
  // client looping every second. 60/user/hour leaves room for token rotates.
  const limit = await rateLimit({
    key: `device-push:user:${user.id}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return fail("rate_limited", "Too many push registrations from this account.", 429);
  }

  const body = await parseBody(req, RegisterSchema);
  if (!body.ok) return body.response;

  const { token, platform, device_name } = body.data;

  const result = await db.query<{ id: string; created_at: Date }>(
    `INSERT INTO device_push_tokens (user_id, token, platform, device_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (token) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           platform = EXCLUDED.platform,
           device_name = COALESCE(EXCLUDED.device_name, device_push_tokens.device_name),
           last_seen_at = now(),
           revoked_at = NULL
     RETURNING id, created_at`,
    [user.id, token, platform, device_name ?? null],
  );

  const row = result.rows[0];
  return ok(
    { id: row.id, created_at: row.created_at.toISOString() },
    { status: 201 },
  );
}

// GET /api/v1/devices/push — list the user's active push tokens. Session-
// only (the mobile client doesn't need to enumerate other devices via
// bearer; this is for the future "Connected devices" settings panel).
export async function GET(req: Request): Promise<Response> {
  const user = await requireUser(req);
  if (!user || user.authType === "token") {
    return fail("unauthorized", "Session sign-in required", 401);
  }

  const result = await db.query<{
    id: string;
    platform: string;
    device_name: string | null;
    created_at: Date;
    last_seen_at: Date;
  }>(
    `SELECT id, platform, device_name, created_at, last_seen_at
       FROM device_push_tokens
      WHERE user_id = $1 AND revoked_at IS NULL
      ORDER BY last_seen_at DESC`,
    [user.id],
  );

  return ok({
    devices: result.rows.map((r) => ({
      id: r.id,
      platform: r.platform,
      device_name: r.device_name,
      created_at: r.created_at.toISOString(),
      last_seen_at: r.last_seen_at.toISOString(),
    })),
  });
}
