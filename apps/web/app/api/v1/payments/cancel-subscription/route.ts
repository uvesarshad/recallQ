import { apiError, apiOk } from "@/lib/api";
import { cancelHostedSubscription, isBillingEnabled, syncUserSubscriptionFromEntity } from "@/lib/billing";
import { db } from "@/lib/db";
import { requireSessionUser } from "@/lib/request-auth";

export async function POST() {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  if (!isBillingEnabled()) {
    return apiError("Billing is disabled for self-hosted deployments", 400);
  }

  const result = await db.query(
    `SELECT razorpay_subscription_id
     FROM users
     WHERE id = $1`,
    [user.id],
  );

  const subscriptionId = result.rows[0]?.razorpay_subscription_id as string | undefined;
  if (!subscriptionId) {
    return apiError("No active subscription found", 404);
  }

  try {
    const subscription = await cancelHostedSubscription(subscriptionId);
    await syncUserSubscriptionFromEntity(subscription);
    return apiOk({ success: true });
  } catch (error) {
    console.error("Failed to cancel Razorpay subscription", error);
    return apiError("Unable to cancel subscription", 500);
  }
}
