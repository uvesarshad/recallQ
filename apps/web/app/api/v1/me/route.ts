import { apiError, apiOk } from "@/lib/api";
import { isBillingEnabled, isSelfHosted } from "@/lib/billing";
import { db } from "@/lib/db";
import { getPlanLimits } from "@/lib/plan-limits";
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
            inbound_email_address, plan, created_at,
            subscription_plan, subscription_status, subscription_current_start,
            subscription_current_end, subscription_cancel_at_cycle_end,
            razorpay_subscription_id,
            saves_this_month, storage_used_bytes,
            chat_queries_today, chat_queries_reset_date
     FROM users
     WHERE id = $1`,
    [user.id],
  );

  const row = result.rows[0] ?? null;
  const limits = row ? getPlanLimits(row.plan ?? "free") : null;

  return apiOk({
    user: row,
    billing: {
      enabled: isBillingEnabled(),
      selfHosted: isSelfHosted(),
    },
    usage: row && limits ? {
      saves_this_month: row.saves_this_month ?? 0,
      max_saves_per_month: limits.maxSavesPerMonth,
      storage_used_bytes: row.storage_used_bytes ?? 0,
      max_storage_bytes: limits.maxStorageBytes,
      chat_queries_today: row.chat_queries_today ?? 0,
      chat_queries_reset_date: row.chat_queries_reset_date ?? null,
      max_chat_queries_per_day: limits.chatQueriesPerDay,
    } : null,
  });
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
     RETURNING id, email, name, bio, timezone, marketing_consent, analytics_consent, inbound_email_address, plan, created_at,
               subscription_plan, subscription_status, subscription_current_start, subscription_current_end,
               subscription_cancel_at_cycle_end, razorpay_subscription_id`,
    [data.name, data.bio, data.timezone, data.marketing_consent, data.analytics_consent, user.id],
  );

  return apiOk({
    user: result.rows[0],
    billing: {
      enabled: isBillingEnabled(),
      selfHosted: isSelfHosted(),
    },
  });
}

export async function DELETE() {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  await db.query("DELETE FROM users WHERE id = $1", [user.id]);
  return apiOk({ success: true });
}
