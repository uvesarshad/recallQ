import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { enqueueJob, type ClaimedJob } from "@/lib/jobs";
import { safeFetch } from "@/lib/url-safety";

export const WEBHOOK_EVENTS = [
  "item.created",
  "item.updated",
  "item.deleted",
  "item.enriched",
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

export type WebhookSubscription = {
  id: string;
  target_url: string;
  description: string | null;
  events: WebhookEvent[];
  enabled: boolean;
  secret_hash: string;
  failure_count: number;
  last_success_at: string | Date | null;
  last_failure_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
};

const WEBHOOK_SECRET_PREFIX = "whsec_";
const SIGNATURE_VERSION = "sha256";

export function normalizeWebhookEvents(events: string[]) {
  const allowed = new Set<string>(WEBHOOK_EVENTS);
  return Array.from(new Set(events.filter((event) => allowed.has(event)))) as WebhookEvent[];
}

export function generateWebhookSecret() {
  return `${WEBHOOK_SECRET_PREFIX}${randomBytes(32).toString("hex")}`;
}

export function hashWebhookSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function maskWebhookSecret(secretHash: string) {
  return `${WEBHOOK_SECRET_PREFIX}${secretHash.slice(0, 8)}...${secretHash.slice(-4)}`;
}

export function signWebhookPayload(secret: string, timestamp: number, body: string) {
  return `${SIGNATURE_VERSION}=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

export function verifyWebhookSignature(input: {
  secret: string;
  timestamp: number;
  body: string;
  signature: string;
}) {
  const expected = signWebhookPayload(input.secret, input.timestamp, input.body);
  const a = Buffer.from(expected);
  const b = Buffer.from(input.signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function serializeWebhookSubscription(row: WebhookSubscription) {
  return {
    id: row.id,
    target_url: row.target_url,
    description: row.description,
    events: row.events,
    enabled: row.enabled,
    secret: maskWebhookSecret(row.secret_hash),
    failure_count: row.failure_count,
    last_success_at: row.last_success_at,
    last_failure_at: row.last_failure_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function createWebhookSubscription(input: {
  userId: string;
  targetUrl: string;
  description?: string | null;
  events: WebhookEvent[];
  enabled?: boolean;
}) {
  const secret = generateWebhookSecret();
  const result = await db.query<WebhookSubscription>(
    `INSERT INTO webhook_subscriptions (
       user_id, target_url, description, events, enabled, secret_hash, secret_encrypted
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, target_url, description, events, enabled, secret_hash,
               failure_count, last_success_at, last_failure_at, created_at, updated_at`,
    [
      input.userId,
      input.targetUrl,
      input.description ?? null,
      input.events,
      input.enabled ?? true,
      hashWebhookSecret(secret),
      encryptSecret(secret),
    ],
  );

  return {
    subscription: serializeWebhookSubscription(result.rows[0]),
    secret,
  };
}

export async function enqueueWebhookEvent(input: {
  userId: string;
  event: WebhookEvent;
  itemId?: string | null;
  data?: Record<string, unknown>;
}) {
  if (typeof db.query !== "function") {
    return [];
  }

  const subscriptions = await db.query<{ id: string }>(
    `SELECT id
     FROM webhook_subscriptions
     WHERE user_id = $1
       AND enabled = TRUE
       AND $2 = ANY(events)`,
    [input.userId, input.event],
  );

  const jobIds: string[] = [];
  for (const subscription of subscriptions.rows) {
    const payload = {
      event: input.event,
      item_id: input.itemId ?? null,
      data: input.data ?? {},
      occurred_at: new Date().toISOString(),
    };
    const delivery = await db.query<{ id: string }>(
      `INSERT INTO webhook_deliveries (subscription_id, user_id, item_id, event, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING id`,
      [subscription.id, input.userId, input.itemId ?? null, input.event, JSON.stringify(payload)],
    );
    const deliveryId = delivery.rows[0]?.id;
    if (!deliveryId) continue;
    const jobId = await enqueueJob({
      type: "webhook",
      userId: input.userId,
      itemId: input.itemId ?? null,
      payload: {
        deliveryId,
        subscriptionId: subscription.id,
      },
      priority: 5,
    });
    if (jobId) {
      jobIds.push(jobId);
      await db.query("UPDATE webhook_deliveries SET job_id = $1 WHERE id = $2", [jobId, deliveryId]);
    }
  }

  return jobIds;
}

export async function deliverWebhookJob(job: ClaimedJob) {
  const deliveryId = String(job.payload?.deliveryId ?? "");
  const subscriptionId = String(job.payload?.subscriptionId ?? "");
  if (!deliveryId || !subscriptionId) throw new Error("Webhook job missing delivery payload");

  const result = await db.query<{
    delivery_id: string;
    subscription_id: string;
    target_url: string;
    secret_encrypted: string;
    event: WebhookEvent;
    payload: Record<string, unknown>;
  }>(
    `SELECT d.id AS delivery_id,
            s.id AS subscription_id,
            s.target_url,
            s.secret_encrypted,
            d.event,
            d.payload
     FROM webhook_deliveries d
     JOIN webhook_subscriptions s ON s.id = d.subscription_id
     WHERE d.id = $1 AND s.id = $2 AND s.enabled = TRUE`,
    [deliveryId, subscriptionId],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Webhook delivery or subscription not found");

  await db.query(
    "UPDATE webhook_deliveries SET status = 'processing', updated_at = NOW() WHERE id = $1",
    [deliveryId],
  );

  const body = JSON.stringify({
    ...row.payload,
    delivery_id: deliveryId,
    subscription_id: subscriptionId,
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const secret = decryptSecret(row.secret_encrypted);
  const signature = signWebhookPayload(secret, timestamp, body);

  try {
    const response = await safeFetch(row.target_url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "RecallQ-Webhooks/1.0",
        "x-recallq-event": row.event,
        "x-recallq-delivery": deliveryId,
        "x-recallq-timestamp": String(timestamp),
        "x-recallq-signature": signature,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Webhook endpoint returned HTTP ${response.status}`);
    }

    await db.query(
      `UPDATE webhook_deliveries
       SET status = 'succeeded',
           attempt_count = attempt_count + 1,
           response_status = $2,
           error = NULL,
           sent_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [deliveryId, response.status],
    );
    await db.query(
      `UPDATE webhook_subscriptions
       SET failure_count = 0,
           last_success_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [subscriptionId],
    );
    return { deliveryId, status: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const nextAttempt = job.attempt_count + 1;
    const terminal = nextAttempt >= job.max_attempts;
    const delaySeconds = Math.min(3600, Math.pow(2, Math.min(nextAttempt, 10)) * 60);
    await db.query(
      `UPDATE webhook_deliveries
       SET status = $2,
           attempt_count = attempt_count + 1,
           error = $3,
           next_attempt_at = CASE WHEN $2 = 'retrying' THEN NOW() + ($4 * INTERVAL '1 second') ELSE next_attempt_at END,
           updated_at = NOW()
       WHERE id = $1`,
      [deliveryId, terminal ? "failed" : "retrying", message.slice(0, 1000), delaySeconds],
    );
    await db.query(
      `UPDATE webhook_subscriptions
       SET failure_count = failure_count + 1,
           last_failure_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [subscriptionId],
    );
    throw error;
  }
}

function encryptionKey() {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "recallq-development-webhook-secret";
  return createHash("sha256").update(secret).digest();
}

function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptSecret(value: string) {
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error("Invalid webhook secret ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
