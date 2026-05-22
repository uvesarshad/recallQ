-- Adds Stripe-specific subscription columns alongside the existing Razorpay
-- columns (migration 005). A user can be on at most one provider at a time;
-- `billing_provider` is the discriminator that endpoints and the webhook
-- handlers consult to route correctly.
--
-- Razorpay continues to own `razorpay_*` columns; Stripe owns `stripe_*`.
-- The shared subscription state (`subscription_plan`, `subscription_status`,
-- `subscription_current_*`, `subscription_cancel_at_cycle_end`) is provider-
-- agnostic — both adapters write the same shape so plan-limit checks don't
-- care which billing system the user is on.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id      TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_price_id         TEXT,
  ADD COLUMN IF NOT EXISTS billing_provider        TEXT
    CHECK (billing_provider IS NULL OR billing_provider IN ('razorpay', 'stripe'));

CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription
  ON users (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer
  ON users (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
