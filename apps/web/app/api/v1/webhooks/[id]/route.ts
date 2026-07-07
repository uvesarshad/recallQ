import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/request-auth";
import { parseSafeHttpUrl } from "@/lib/url-safety";
import {
  normalizeWebhookEvents,
  serializeWebhookSubscription,
  type WebhookSubscription,
} from "@/lib/webhooks";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateWebhookSchema = z.object({
  target_url: z.string().url().max(2048).optional(),
  description: z.string().trim().max(200).nullable().optional(),
  events: z.array(z.string()).min(1).max(10).optional(),
  enabled: z.boolean().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(req);
  if (!user) return apiError("Unauthorized", 401);
  const { id } = await params;

  const result = await db.query<WebhookSubscription>(
    `SELECT id, target_url, description, events, enabled, secret_hash,
            failure_count, last_success_at, last_failure_at, created_at, updated_at
     FROM webhook_subscriptions
     WHERE id = $1 AND user_id = $2`,
    [id, user.id],
  );
  const row = result.rows[0];
  if (!row) return apiError("Webhook subscription not found", 404);
  return apiOk({ webhook: serializeWebhookSubscription(row) });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(req);
  if (!user) return apiError("Unauthorized", 401);
  const { id } = await params;

  const parsed = updateWebhookSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("Invalid webhook subscription update", 400);

  const updates: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  if (parsed.data.target_url !== undefined) {
    try {
      parseSafeHttpUrl(parsed.data.target_url);
    } catch (error) {
      return apiError(error instanceof Error ? error.message : "Unsafe webhook URL", 400);
    }
    updates.push(`target_url = $${index++}`);
    values.push(parsed.data.target_url);
  }
  if (parsed.data.description !== undefined) {
    updates.push(`description = $${index++}`);
    values.push(parsed.data.description);
  }
  if (parsed.data.enabled !== undefined) {
    updates.push(`enabled = $${index++}`);
    values.push(parsed.data.enabled);
  }
  if (parsed.data.events !== undefined) {
    const events = normalizeWebhookEvents(parsed.data.events);
    if (events.length === 0) return apiError("At least one supported webhook event is required", 400);
    updates.push(`events = $${index++}`);
    values.push(events);
  }

  if (updates.length === 0) return apiError("No valid updates provided", 400);
  updates.push("updated_at = NOW()");
  values.push(id, user.id);

  const result = await db.query(
    `UPDATE webhook_subscriptions
     SET ${updates.join(", ")}
     WHERE id = $${index++} AND user_id = $${index}`,
    values,
  );
  if (result.rowCount === 0) return apiError("Webhook subscription not found", 404);

  return apiOk({ success: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(req);
  if (!user) return apiError("Unauthorized", 401);
  const { id } = await params;

  const result = await db.query("DELETE FROM webhook_subscriptions WHERE id = $1 AND user_id = $2", [
    id,
    user.id,
  ]);
  if (result.rowCount === 0) return apiError("Webhook subscription not found", 404);
  return apiOk({ success: true });
}
