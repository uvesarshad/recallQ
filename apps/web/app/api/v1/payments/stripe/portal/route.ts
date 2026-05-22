import { apiError, apiOk } from "@/lib/api";
import { isBillingEnabled } from "@/lib/billing";
import { getStripeClient, isStripeEnabled } from "@/lib/billing-stripe";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { requireSessionUser } from "@/lib/request-auth";

// POST /api/v1/payments/stripe/portal
// Creates a Stripe Billing Portal session so the user can self-serve their
// subscription: update payment method, view invoices, switch plans, cancel.
// Returns `{ url }`; the client should redirect via `window.location.assign`.
//
// Stripe's Portal handles cancel/upgrade flows out of the box, so for Stripe
// users we route both "Manage" and "Cancel" into here. Razorpay users
// continue to hit `/api/v1/payments/cancel-subscription` (Razorpay has no
// equivalent hosted portal).
export async function POST(req: Request) {
  const user = await requireSessionUser();
  if (!user) return apiError("Unauthorized", 401);

  if (!isBillingEnabled()) {
    return apiError("Billing is disabled for self-hosted deployments", 400);
  }
  if (!isStripeEnabled()) {
    return apiError("Stripe is not configured on this deployment", 501);
  }

  const result = await db.query<{ stripe_customer_id: string | null }>(
    `SELECT stripe_customer_id FROM users WHERE id = $1`,
    [user.id],
  );
  const customerId = result.rows[0]?.stripe_customer_id;
  if (!customerId) {
    return apiError(
      "No Stripe customer record. Start a subscription first to manage it from the portal.",
      404,
    );
  }

  const origin =
    env.APP_URL ?? req.headers.get("origin") ?? "http://localhost:3008";

  try {
    const session = await getStripeClient().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/app/settings/billing`,
    });
    return apiOk({ url: session.url });
  } catch (error) {
    logger.error("stripe-portal", "Failed to create portal session", {
      customerId,
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError("Unable to open billing portal", 500);
  }
}
