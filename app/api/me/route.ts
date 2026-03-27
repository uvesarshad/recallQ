import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { requireSessionUser } from "@/lib/request-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const profileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  bio: z.string().trim().max(500).nullable(),
  timezone: z.string().trim().min(1).max(80),
  marketing_consent: z.boolean(),
  analytics_consent: z.boolean(),
});

export async function GET() {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const result = await db.query(
    `SELECT id, email, name, bio, timezone, marketing_consent, analytics_consent,
            inbound_email_address, plan, created_at
     FROM users
     WHERE id = $1`,
    [user.id],
  );

  return apiOk({ user: result.rows[0] ?? null });
}

export async function PATCH(req: Request) {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const data = profileSchema.parse(await req.json());
  const result = await db.query(
    `UPDATE users
     SET name = $1,
         bio = $2,
         timezone = $3,
         marketing_consent = $4,
         analytics_consent = $5,
         updated_at = NOW()
     WHERE id = $6
     RETURNING id, email, name, bio, timezone, marketing_consent, analytics_consent, inbound_email_address, plan, created_at`,
    [data.name, data.bio, data.timezone, data.marketing_consent, data.analytics_consent, user.id],
  );

  return apiOk({ user: result.rows[0] });
}

export async function DELETE() {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  await db.query("DELETE FROM users WHERE id = $1", [user.id]);
  return apiOk({ success: true });
}
