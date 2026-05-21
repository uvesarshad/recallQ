import { db } from "@/lib/db";
import { env } from "@/lib/env";
import crypto from "crypto";
import { Plan } from "@/lib/plan-limits";

export type BillingPlan = Exclude<Plan, "free">;

export type BillingStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "expired"
  | "unknown";

type RazorpaySubscriptionEntity = {
  id: string;
  status?: string;
  plan_id?: string;
  notes?: Record<string, string | undefined>;
  current_start?: number | null;
  current_end?: number | null;
  charge_at?: number | null;
  start_at?: number | null;
  end_at?: number | null;
};

const ACTIVE_STATUSES = new Set<BillingStatus>(["authenticated", "active"]);
const TERMINAL_STATUSES = new Set<BillingStatus>(["cancelled", "completed", "expired", "halted"]);

export const BILLING_PLANS: Record<BillingPlan, {
  label: string;
  priceDisplay: string;
  yearlyPrice: number;
  planCode: string;
}> = {
  starter: {
    label: "Starter",
    priceDisplay: "$29/year",
    yearlyPrice: 29,
    planCode: "starter_29_year",
  },
  pro: {
    label: "Pro",
    priceDisplay: "$99/year",
    yearlyPrice: 99,
    planCode: "pro_99_year",
  },
};

export function isSelfHosted() {
  return env.SELF_HOSTED === "true";
}

export function isBillingEnabled() {
  return !isSelfHosted();
}

export function getHostedBillingConfig() {
  if (!isBillingEnabled()) {
    throw new Error("Billing is disabled in self-hosted mode");
  }

  if (!env.RAZORPAY_KEY_ID && env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
    return {
      keyId: env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      keySecret: env.RAZORPAY_KEY_SECRET,
      webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
    };
  }

  return {
    keyId: env.RAZORPAY_KEY_ID ?? env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  };
}

export function getHostedPlanId(plan: BillingPlan) {
  if (plan === "starter") {
    return env.RAZORPAY_PLAN_STARTER_YEARLY_ID;
  }

  return env.RAZORPAY_PLAN_PRO_YEARLY_ID;
}

function requireHostedBillingConfig() {
  const config = getHostedBillingConfig();

  if (!config.keyId || !config.keySecret) {
    throw new Error("Razorpay credentials are not configured");
  }

  return config;
}

function toIsoDate(timestamp?: number | null) {
  if (!timestamp) {
    return null;
  }

  return new Date(timestamp * 1000).toISOString();
}

function normalizeStatus(status?: string | null): BillingStatus {
  switch (status) {
    case "created":
    case "authenticated":
    case "active":
    case "pending":
    case "halted":
    case "cancelled":
    case "completed":
    case "expired":
      return status;
    default:
      return "unknown";
  }
}

function resolvePlanFromEntity(entity: RazorpaySubscriptionEntity): BillingPlan | null {
  const notePlan = entity.notes?.plan;
  if (notePlan === "starter" || notePlan === "pro") {
    return notePlan;
  }

  if (entity.plan_id === env.RAZORPAY_PLAN_STARTER_YEARLY_ID) {
    return "starter";
  }

  if (entity.plan_id === env.RAZORPAY_PLAN_PRO_YEARLY_ID) {
    return "pro";
  }

  return null;
}

function shouldKeepAccess(status: BillingStatus, currentEnd: number | null | undefined) {
  if (ACTIVE_STATUSES.has(status)) {
    return true;
  }

  if (!TERMINAL_STATUSES.has(status) || !currentEnd) {
    return false;
  }

  return currentEnd * 1000 > Date.now();
}

export async function razorpayRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { keyId, keySecret } = requireHostedBillingConfig();
  const authorization = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Razorpay request failed (${response.status}): ${message}`);
  }

  return response.json() as Promise<T>;
}

export async function createHostedSubscription(params: {
  userId: string;
  email?: string | null;
  name?: string | null;
  plan: BillingPlan;
}) {
  const planId = getHostedPlanId(params.plan);
  if (!planId) {
    throw new Error(`Missing Razorpay plan id for ${params.plan}`);
  }

  const subscription = await razorpayRequest<RazorpaySubscriptionEntity>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: planId,
      total_count: 100,
      quantity: 1,
      customer_notify: 1,
      notes: {
        userId: params.userId,
        plan: params.plan,
        email: params.email ?? "",
        name: params.name ?? "",
      },
    }),
  });

  await db.query(
    `UPDATE users
     SET razorpay_subscription_id = $1,
         razorpay_plan_id = $2,
         subscription_plan = $3,
         subscription_status = $4,
         subscription_cancel_at_cycle_end = FALSE,
         updated_at = NOW()
     WHERE id = $5`,
    [
      subscription.id,
      planId,
      params.plan,
      normalizeStatus(subscription.status),
      params.userId,
    ],
  );

  return subscription;
}

export async function cancelHostedSubscription(subscriptionId: string) {
  return razorpayRequest<RazorpaySubscriptionEntity>(`/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({
      cancel_at_cycle_end: 1,
    }),
  });
}

export function verifyHostedWebhook(rawBody: string, signature: string | null) {
  const secret = getHostedBillingConfig().webhookSecret;
  if (!secret || !signature) {
    return false;
  }

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function syncUserSubscriptionFromEntity(entity: RazorpaySubscriptionEntity) {
  const status = normalizeStatus(entity.status);
  const plan = resolvePlanFromEntity(entity);
  const currentEnd = entity.current_end ?? entity.end_at ?? null;
  const nextPlan: Plan = plan && shouldKeepAccess(status, currentEnd) ? plan : "free";
  const userIdFromNotes = entity.notes?.userId;

  const result = await db.query(
    userIdFromNotes
      ? `UPDATE users
         SET plan = $1,
             razorpay_subscription_id = $2,
             razorpay_plan_id = $3,
             subscription_plan = $4,
             subscription_status = $5,
             subscription_current_start = $6,
             subscription_current_end = $7,
             subscription_cancel_at_cycle_end = $8,
             updated_at = NOW()
         WHERE id = $9
         RETURNING id`
      : `UPDATE users
         SET plan = $1,
             razorpay_plan_id = $2,
             subscription_plan = $3,
             subscription_status = $4,
             subscription_current_start = $5,
             subscription_current_end = $6,
             subscription_cancel_at_cycle_end = $7,
             updated_at = NOW()
         WHERE razorpay_subscription_id = $8
         RETURNING id`,
    userIdFromNotes
      ? [
          nextPlan,
          entity.id,
          entity.plan_id ?? getHostedPlanId(plan ?? "starter") ?? null,
          plan,
          status,
          toIsoDate(entity.current_start ?? entity.start_at ?? entity.charge_at ?? null),
          toIsoDate(currentEnd),
          status === "cancelled" || status === "completed" || status === "expired",
          userIdFromNotes,
        ]
      : [
          nextPlan,
          entity.plan_id ?? getHostedPlanId(plan ?? "starter") ?? null,
          plan,
          status,
          toIsoDate(entity.current_start ?? entity.start_at ?? entity.charge_at ?? null),
          toIsoDate(currentEnd),
          status === "cancelled" || status === "completed" || status === "expired",
          entity.id,
        ],
  );

  return (result.rowCount ?? 0) > 0;
}
