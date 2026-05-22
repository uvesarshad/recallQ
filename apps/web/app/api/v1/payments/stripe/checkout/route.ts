import { z } from "zod";
import { apiError, apiOk } from "@/lib/api";
import { isBillingEnabled } from "@/lib/billing";
import {
  createStripeCheckoutSession,
  isStripeEnabled,
} from "@/lib/billing-stripe";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/request-auth";

const requestSchema = z.object({
  plan: z.enum(["starter", "pro"]),
});

// POST /api/v1/payments/stripe/checkout
// Returns `{ url }` — the client should `window.location.assign(url)` to
// redirect to Stripe's hosted Checkout. The success_url comes back to
// /app/settings/billing?stripe=success; the webhook is what actually
// upgrades the user's plan.
export async function POST(req: Request) {
  const user = await requireSessionUser();
  if (!user) return apiError("Unauthorized", 401);

  // Checkout sessions are cheap on our side but each creates a Stripe
  // customer record and consumes API budget. Cap per-user to prevent a
  // misbehaving client from creating hundreds of sessions.
  const limit = await rateLimit({
    key: `stripe-checkout:user:${user.id}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return apiError("Too many checkout attempts. Wait an hour and try again.", 429);
  }

  if (!isBillingEnabled()) {
    return apiError("Billing is disabled for self-hosted deployments", 400);
  }
  if (!isStripeEnabled()) {
    return apiError("Stripe is not configured on this deployment", 501);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid request body", 400, { issues: parsed.error.issues });
  }

  const userResult = await db.query<{
    email: string | null;
    subscription_status: string | null;
    billing_provider: string | null;
  }>(
    `SELECT email, subscription_status, billing_provider FROM users WHERE id = $1`,
    [user.id],
  );
  const account = userResult.rows[0];
  if (!account || !account.email) {
    return apiError("User has no email on file", 400);
  }

  // Block cross-provider switch attempts. Razorpay-active users must cancel
  // there before subscribing via Stripe; the reverse is also true for
  // Razorpay checkout. Avoids dual billing.
  const activeStatuses = new Set(["created", "authenticated", "active", "pending"]);
  if (
    account.billing_provider === "razorpay" &&
    account.subscription_status &&
    activeStatuses.has(account.subscription_status)
  ) {
    return apiError(
      "An active Razorpay subscription exists. Cancel it before switching to Stripe.",
      409,
    );
  }

  const origin =
    env.APP_URL ?? req.headers.get("origin") ?? "http://localhost:3008";

  try {
    const session = await createStripeCheckoutSession({
      userId: user.id,
      email: account.email,
      plan: parsed.data.plan,
      successUrl: `${origin}/app/settings/billing?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/app/settings/billing?stripe=cancelled`,
    });
    return apiOk({ sessionId: session.sessionId, url: session.url });
  } catch (error) {
    console.error("Failed to create Stripe checkout session", error);
    return apiError(
      error instanceof Error ? error.message : "Unable to create checkout session",
      500,
    );
  }
}
