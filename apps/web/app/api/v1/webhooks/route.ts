import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/request-auth";
import { parseSafeHttpUrl } from "@/lib/url-safety";
import {
  createWebhookSubscription,
  normalizeWebhookEvents,
  serializeWebhookSubscription,
  type WebhookSubscription,
} from "@/lib/webhooks";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createWebhookSchema = z.object({
  target_url: z.string().url().max(2048),
  description: z.string().trim().max(200).nullable().optional(),
  events: z.array(z.string()).min(1).max(10),
  enabled: z.boolean().optional(),
});

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return apiError("Unauthorized", 401);

  const result = await db.query<WebhookSubscription>(
    `SELECT id, target_url, description, events, enabled, secret_hash,
            failure_count, last_success_at, last_failure_at, created_at, updated_at
     FROM webhook_subscriptions
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [user.id],
  );

  return apiOk({ webhooks: result.rows.map(serializeWebhookSubscription) });
}

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return apiError("Unauthorized", 401);

  const parsed = createWebhookSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("Invalid webhook subscription", 400);

  try {
    parseSafeHttpUrl(parsed.data.target_url);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unsafe webhook URL", 400);
  }

  const events = normalizeWebhookEvents(parsed.data.events);
  if (events.length === 0) return apiError("At least one supported webhook event is required", 400);

  const result = await createWebhookSubscription({
    userId: user.id,
    targetUrl: parsed.data.target_url,
    description: parsed.data.description ?? null,
    events,
    enabled: parsed.data.enabled,
  });

  return apiOk(result, { status: 201 });
}
