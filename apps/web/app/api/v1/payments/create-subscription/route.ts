import { apiError, apiOk } from "@/lib/api";
import { BILLING_PLANS, createHostedSubscription, isBillingEnabled } from "@/lib/billing";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireSessionUser } from "@/lib/request-auth";
import { z } from "zod";

const requestSchema = z.object({
  plan: z.enum(["starter", "pro"]),
});

export async function POST(req: Request) {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  if (!isBillingEnabled()) {
    return apiError("Billing is disabled for self-hosted deployments", 400);
  }

  const data = requestSchema.parse(await req.json());
  const existingUserResult = await db.query(
    `SELECT email, name, plan, subscription_plan, subscription_status, razorpay_subscription_id
     FROM users
     WHERE id = $1`,
    [user.id],
  );

  if (existingUserResult.rowCount === 0) {
    return apiError("User not found", 404);
  }

  const account = existingUserResult.rows[0];
  const activeStatuses = new Set(["created", "authenticated", "active", "pending"]);

  if (
    account.razorpay_subscription_id &&
    activeStatuses.has(account.subscription_status) &&
    account.subscription_plan === data.plan
  ) {
    return apiOk({
      subscriptionId: account.razorpay_subscription_id,
      key: env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? env.RAZORPAY_KEY_ID,
      plan: data.plan,
      planLabel: BILLING_PLANS[data.plan].label,
      reused: true,
    });
  }

  if (account.razorpay_subscription_id && activeStatuses.has(account.subscription_status)) {
    return apiError("Cancel the current subscription before changing plans", 409);
  }

  try {
    const subscription = await createHostedSubscription({
      userId: user.id,
      email: account.email,
      name: account.name,
      plan: data.plan,
    });

    return apiOk({
      subscriptionId: subscription.id,
      key: env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? env.RAZORPAY_KEY_ID,
      plan: data.plan,
      planLabel: BILLING_PLANS[data.plan].label,
      reused: false,
    });
  } catch (error) {
    console.error("Failed to create Razorpay subscription", error);
    return apiError("Unable to create subscription", 500);
  }
}
