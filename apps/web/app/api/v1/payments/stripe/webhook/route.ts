import type Stripe from "stripe";
import { logger } from "@/lib/logger";
import {
  attachStripeCustomerToUser,
  getStripeClient,
  syncUserSubscriptionFromStripe,
  verifyStripeWebhook,
} from "@/lib/billing-stripe";

export const dynamic = "force-dynamic";

// POST /api/v1/payments/stripe/webhook
// Stripe dashboard → Developers → Webhooks → add this URL:
//   https://recallq.xyz/api/v1/payments/stripe/webhook
// Subscribe to (at least):
//   - checkout.session.completed
//   - customer.subscription.created
//   - customer.subscription.updated
//   - customer.subscription.deleted
//   - invoice.payment_failed
// Copy the signing secret into STRIPE_WEBHOOK_SECRET.
//
// Stripe requires the RAW request body for signature verification. We read
// `req.text()` (not `req.json()`) and pass the string verbatim to
// `verifyStripeWebhook`.
export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  const event = verifyStripeWebhook(rawBody, signature);
  if (!event) {
    logger.warn("stripe-webhook", "Invalid signature or webhook secret missing");
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    await handleEvent(event);
  } catch (error) {
    logger.error("stripe-webhook", "Event handler failed", {
      type: event.type,
      id: event.id,
      error: error instanceof Error ? error.message : String(error),
    });
    // Return 500 so Stripe retries. Idempotency: our handlers are upserts.
    return new Response("Handler error", { status: 500 });
  }

  return new Response(null, { status: 200 });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId =
        session.client_reference_id ?? session.metadata?.userId ?? null;
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id ?? null;
      if (userId && customerId) {
        await attachStripeCustomerToUser(userId, customerId);
      }
      // The subscription itself is created via the customer.subscription.*
      // events that fire right after. We don't need to do anything more here
      // — the next event in the sequence will sync the full state.
      if (session.subscription) {
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
        await syncUserSubscriptionFromStripe(subscription);
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncUserSubscriptionFromStripe(subscription);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        typeof (invoice as unknown as { subscription?: string | null }).subscription === "string"
          ? ((invoice as unknown as { subscription: string }).subscription)
          : null;
      if (subscriptionId) {
        const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
        await syncUserSubscriptionFromStripe(subscription);
      }
      logger.warn("stripe-webhook", "invoice.payment_failed", {
        invoiceId: invoice.id,
        amount: invoice.amount_due,
      });
      break;
    }

    default:
      logger.debug("stripe-webhook", "Unhandled event", { type: event.type });
  }
}
