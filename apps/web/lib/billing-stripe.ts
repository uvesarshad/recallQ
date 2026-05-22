// Stripe-specific billing helpers. Lives alongside `lib/billing.ts` (which
// remains Razorpay-specific) rather than as a generic adapter interface —
// each provider's API shape is different enough that a single abstraction
// would obscure more than it shares. The discriminator is the new
// `users.billing_provider` column (see migration 015); endpoints read it
// to decide which set of helpers to call for cancel / sync paths.

import Stripe from "stripe";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { BillingPlan, BillingStatus } from "@/lib/billing";
import { isBillingEnabled } from "@/lib/billing";
import type { Plan } from "@/lib/plan-limits";

let cachedStripe: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (cachedStripe) return cachedStripe;
  const key = env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env or configure the systemd EnvironmentFile.",
    );
  }
  cachedStripe = new Stripe(key, {
    // Pinning the API version keeps Stripe's behavior stable across
    // dashboard-side upgrades; bump deliberately when migrating.
    apiVersion: "2025-10-29.acacia" as Stripe.LatestApiVersion,
    typescript: true,
    appInfo: { name: "RecallQ", version: "0.1.0", url: "https://recallq.xyz" },
  });
  return cachedStripe;
}

export function isStripeEnabled(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

export function getStripePriceId(plan: BillingPlan): string | undefined {
  return plan === "starter"
    ? env.STRIPE_PRICE_STARTER_YEARLY_ID
    : env.STRIPE_PRICE_PRO_YEARLY_ID;
}

// ── Checkout ──────────────────────────────────────────────────────────────

export type CreateCheckoutInput = {
  userId: string;
  email: string;
  plan: BillingPlan;
  successUrl: string;
  cancelUrl: string;
};

export async function createStripeCheckoutSession(input: CreateCheckoutInput): Promise<{
  sessionId: string;
  url: string;
}> {
  if (!isBillingEnabled()) {
    throw new Error("Billing is disabled in self-hosted mode");
  }
  const priceId = getStripePriceId(input.plan);
  if (!priceId) {
    throw new Error(`Missing Stripe price id for plan ${input.plan}`);
  }

  // Look up an existing Stripe customer for this user. We don't pre-create
  // customers — Checkout will create one if `customer_email` is provided and
  // we capture the id from the webhook on `checkout.session.completed`.
  const existing = await db.query<{ stripe_customer_id: string | null }>(
    `SELECT stripe_customer_id FROM users WHERE id = $1`,
    [input.userId],
  );
  const stripeCustomerId = existing.rows[0]?.stripe_customer_id ?? undefined;

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    ...(stripeCustomerId
      ? { customer: stripeCustomerId }
      : { customer_email: input.email }),
    client_reference_id: input.userId,
    metadata: { userId: input.userId, plan: input.plan },
    subscription_data: {
      metadata: { userId: input.userId, plan: input.plan },
    },
    allow_promotion_codes: true,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }
  return { sessionId: session.id, url: session.url };
}

// ── Cancel ────────────────────────────────────────────────────────────────

// Schedules cancellation at the end of the current billing period (matches
// the Razorpay adapter behavior: don't refund mid-period).
export async function cancelStripeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  const stripe = getStripeClient();
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

// ── Webhook ───────────────────────────────────────────────────────────────

export function verifyStripeWebhook(rawBody: string, signature: string | null): Stripe.Event | null {
  if (!signature) return null;
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return null;
  try {
    return getStripeClient().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return null;
  }
}

// ── State sync ────────────────────────────────────────────────────────────

function planFromStripePriceId(priceId: string | null | undefined): BillingPlan | null {
  if (!priceId) return null;
  if (priceId === env.STRIPE_PRICE_STARTER_YEARLY_ID) return "starter";
  if (priceId === env.STRIPE_PRICE_PRO_YEARLY_ID) return "pro";
  return null;
}

function planFromStripeMetadata(metadata: Stripe.Metadata | null | undefined): BillingPlan | null {
  const value = metadata?.plan;
  if (value === "starter" || value === "pro") return value;
  return null;
}

function statusFromStripe(status: Stripe.Subscription.Status): BillingStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "halted";
    case "canceled":
      return "cancelled";
    case "incomplete":
    case "incomplete_expired":
      return "pending";
    case "paused":
      return "halted";
    default:
      return "unknown";
  }
}

function shouldKeepAccess(status: BillingStatus, currentEndIso: string | null): boolean {
  if (status === "active") return true;
  if (status === "cancelled" && currentEndIso) {
    return new Date(currentEndIso).getTime() > Date.now();
  }
  return false;
}

function periodEndIso(subscription: Stripe.Subscription): string | null {
  const candidate =
    (subscription as unknown as { current_period_end?: number | null }).current_period_end ??
    subscription.items.data[0]?.current_period_end ??
    null;
  return candidate ? new Date(candidate * 1000).toISOString() : null;
}

function periodStartIso(subscription: Stripe.Subscription): string | null {
  const candidate =
    (subscription as unknown as { current_period_start?: number | null }).current_period_start ??
    subscription.items.data[0]?.current_period_start ??
    null;
  return candidate ? new Date(candidate * 1000).toISOString() : null;
}

// Mirrors `syncUserSubscriptionFromEntity` in lib/billing.ts but for Stripe.
// Resolves the user via `metadata.userId` if set (Checkout always sets it),
// else falls back to `stripe_customer_id` lookup.
export async function syncUserSubscriptionFromStripe(subscription: Stripe.Subscription): Promise<boolean> {
  const status = statusFromStripe(subscription.status);
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const plan =
    planFromStripeMetadata(subscription.metadata) ??
    planFromStripePriceId(priceId);
  const currentEndIso = periodEndIso(subscription);
  const nextPlan: Plan = plan && shouldKeepAccess(status, currentEndIso) ? plan : "free";

  const userId = subscription.metadata?.userId;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

  const updateByUser = userId
    ? await db.query(
        `UPDATE users
            SET plan = $1,
                billing_provider = 'stripe',
                stripe_customer_id = COALESCE($2, stripe_customer_id),
                stripe_subscription_id = $3,
                stripe_price_id = $4,
                subscription_plan = $5,
                subscription_status = $6,
                subscription_current_start = $7,
                subscription_current_end = $8,
                subscription_cancel_at_cycle_end = $9,
                updated_at = NOW()
          WHERE id = $10
          RETURNING id`,
        [
          nextPlan,
          customerId,
          subscription.id,
          priceId,
          plan,
          status,
          periodStartIso(subscription),
          currentEndIso,
          subscription.cancel_at_period_end || status === "cancelled",
          userId,
        ],
      )
    : null;

  if ((updateByUser?.rowCount ?? 0) > 0) return true;

  // Fallback: match by stripe_customer_id (the user closed the Checkout tab
  // but Stripe still fired `checkout.session.completed`).
  if (!customerId) return false;
  const updateByCustomer = await db.query(
    `UPDATE users
        SET plan = $1,
            billing_provider = 'stripe',
            stripe_subscription_id = $2,
            stripe_price_id = $3,
            subscription_plan = $4,
            subscription_status = $5,
            subscription_current_start = $6,
            subscription_current_end = $7,
            subscription_cancel_at_cycle_end = $8,
            updated_at = NOW()
      WHERE stripe_customer_id = $9
      RETURNING id`,
    [
      nextPlan,
      subscription.id,
      priceId,
      plan,
      status,
      periodStartIso(subscription),
      currentEndIso,
      subscription.cancel_at_period_end || status === "cancelled",
      customerId,
    ],
  );
  return (updateByCustomer.rowCount ?? 0) > 0;
}

// Webhook-side helper: persist the Stripe customer id from
// `checkout.session.completed` so future events can be matched by customer.
export async function attachStripeCustomerToUser(
  userId: string,
  customerId: string,
): Promise<void> {
  await db.query(
    `UPDATE users
        SET stripe_customer_id = $1,
            billing_provider = 'stripe',
            updated_at = NOW()
      WHERE id = $2 AND (stripe_customer_id IS NULL OR stripe_customer_id <> $1)`,
    [customerId, userId],
  );
}
