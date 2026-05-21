import { apiError, apiOk } from "@/lib/api";
import { isBillingEnabled, syncUserSubscriptionFromEntity, verifyHostedWebhook } from "@/lib/billing";

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    subscription?: {
      entity?: {
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
    };
  };
};

export async function POST(req: Request) {
  if (!isBillingEnabled()) {
    return apiOk({ ignored: true });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!verifyHostedWebhook(rawBody, signature)) {
    return apiError("Unauthorized", 401);
  }

  const body = JSON.parse(rawBody) as RazorpayWebhookPayload;
  const subscription = body.payload?.subscription?.entity;
  if (!subscription?.id) {
    return apiOk({ ignored: true });
  }

  await syncUserSubscriptionFromEntity(subscription);

  return apiOk({
    ok: true,
    event: body.event ?? null,
    subscriptionId: subscription.id,
  });
}
