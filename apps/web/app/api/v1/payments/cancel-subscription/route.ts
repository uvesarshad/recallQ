import { apiError, apiOk } from "@/lib/api";
import {
  cancelHostedSubscription,
  isBillingEnabled,
  syncUserSubscriptionFromEntity,
} from "@/lib/billing";
import {
  cancelStripeSubscription,
  syncUserSubscriptionFromStripe,
} from "@/lib/billing-stripe";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { requireSessionUser } from "@/lib/request-auth";

// POST /api/v1/payments/cancel-subscription
// Provider-aware. Reads `users.billing_provider` to decide whether to cancel
// the Razorpay or the Stripe subscription. Falls back to whichever sub id is
// non-null if `billing_provider` was never set (legacy data).
export async function POST() {
  const user = await requireSessionUser();
  if (!user) return apiError("Unauthorized", 401);

  if (!isBillingEnabled()) {
    return apiError("Billing is disabled for self-hosted deployments", 400);
  }

  const result = await db.query<{
    billing_provider: string | null;
    razorpay_subscription_id: string | null;
    stripe_subscription_id: string | null;
  }>(
    `SELECT billing_provider, razorpay_subscription_id, stripe_subscription_id
       FROM users
      WHERE id = $1`,
    [user.id],
  );

  const account = result.rows[0];
  if (!account) return apiError("User not found", 404);

  const provider =
    account.billing_provider ??
    (account.stripe_subscription_id
      ? "stripe"
      : account.razorpay_subscription_id
        ? "razorpay"
        : null);

  if (!provider) return apiError("No active subscription found", 404);

  try {
    if (provider === "stripe") {
      if (!account.stripe_subscription_id) {
        return apiError("No active Stripe subscription found", 404);
      }
      const subscription = await cancelStripeSubscription(account.stripe_subscription_id);
      await syncUserSubscriptionFromStripe(subscription);
      return apiOk({ success: true, provider });
    }

    if (!account.razorpay_subscription_id) {
      return apiError("No active Razorpay subscription found", 404);
    }
    const subscription = await cancelHostedSubscription(account.razorpay_subscription_id);
    await syncUserSubscriptionFromEntity(subscription);
    return apiOk({ success: true, provider });
  } catch (error) {
    logger.error("cancel-subscription", "Failed to cancel", {
      provider,
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError("Unable to cancel subscription", 500);
  }
}
