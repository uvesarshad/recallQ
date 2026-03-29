# Billing Setup

Hosted Recall uses annual Razorpay subscriptions.

## Required env vars

```bash
SELF_HOSTED=false
APP_URL=https://recall.yourdomain.com
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
RAZORPAY_PLAN_STARTER_YEARLY_ID=plan_xxxxx
RAZORPAY_PLAN_PRO_YEARLY_ID=plan_yyyyy
```

## Required Razorpay config

1. Create two annual plans in Razorpay:
   `starter_29_year`
   `pro_99_year`
2. Point the webhook to:
   `https://your-domain.com/api/payments/webhook`
3. Subscribe to subscription lifecycle events at minimum:
   `subscription.authenticated`
   `subscription.activated`
   `subscription.charged`
   `subscription.cancelled`
   `subscription.completed`
   `subscription.halted`
4. Keep Razorpay plan IDs in the env vars above.

## Self-hosted mode

Set `SELF_HOSTED=true` to disable hosted billing UI and bypass freemium limits.
