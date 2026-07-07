# Billing and Settings Module

> Scope: Documents subscription plan tiers, Razorpay integrations, subscription webhooks, settings routing, and user profiles.
> Rendering context: Isomorphic
> Project tier: 4
> Last updated: 2026-07-07

## Overview
The Billing and Settings module regulates Recall's subscription lifecycle, settings panel routing, and user preference profiles. It handles commercial plan tier allocations, Razorpay payments widgets, payment webhook verifications, and links external channels like Telegram bots inside user integration pages.

## Feature Architectures

### Subscription Plans and Allocations
Recall structures operations around three user levels configured in lib/plan-limits.ts:
- Free Plan: Defaults to new profiles. Limits saves to 50 per month, file uploads to 10MB, and reminder alerts to 2. Disables inbound email captures.
- Starter Plan: Code starter_29_year ($29/year). Limits saves to 100 per month, file uploads to 10MB, and reminders to 30. Enables email captures.
- Pro Plan: Code pro_99_year ($99/year). Provides unlimited saves, 50MB file uploads, and unlimited reminder alerts. Enables email captures.
- Self-Hosted Bypass: If SELF_HOSTED is set to true, all active plan limits checks bypass commercial restrictions and assign infinite bounds, hiding payment controls.

### Razorpay Payments Integration (lib/billing.ts)
- Creating Subscriptions: Handled in `apps/web/app/api/v1/payments/create-subscription/route.ts`. Initiates Razorpay subscription payloads and returns checkout data.
- Cancelling Subscriptions: Handled in `apps/web/app/api/v1/payments/cancel-subscription/route.ts`. Cancels the active Razorpay or Stripe subscription at the provider.
- Razorpay Webhook Listener: Handled in `apps/web/app/api/v1/payments/webhook/route.ts`. Validates signatures with `RAZORPAY_WEBHOOK_SECRET`, updates plan fields, and maps renewal timestamps inside the users table.
- Stripe Endpoints: `apps/web/app/api/v1/payments/stripe/checkout/route.ts`, `portal/route.ts`, and `webhook/route.ts` cover Checkout, customer portal, and signature-verified Stripe subscription events.

### Settings Routing and Workspace Views
Settings are grouped into a clean multi-tab layout using the components/SettingsNav.tsx control sidebar:
- Settings Redirects: `/app/settings` resolves to `/app/settings/profile`; legacy root settings URLs are redirected in `apps/web/next.config.mjs`.
- Profile Settings (`/app/settings/profile`): Allows updating profile fields via versioned user routes.
- Folders Settings (`/app/settings/folders`): Owns folder listing, inline edits, colors/icons, and deletion.
- Integrations Settings (`/app/settings/integrations`): Lists the inbound capture email address, Telegram connection state, and setup actions.
- Billing Settings (`/app/settings/billing`): Displays save usage, active subscription status, renewal dates, and payment actions.
- Appearance Settings (`/app/settings/appearance`): Provides the richer three-option theme picker.

## Security Constraints
- AGENT AVOID: Never rely on client-supplied plan levels or saves counts. Usage audits must strictly query verified Postgres data before allowing ingestion writes.
- AGENT NOTE: Always verify Razorpay hmac signatures on payment callbacks to protect the platform against subscription forgery.

## Update Triggers
- When plan prices, names, limits, or configurations are updated.
- When changing Razorpay endpoints, callbacks, or webhook decoders in lib/billing.ts.
- When adding settings sub-menus or changing redirects for settings tabs.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Tech stack context.
- [docs/infra/environment.md](file:///e:/Projects/recallQ/docs/infra/environment.md) — Environment keys.
- [docs/auth/authorization.md](file:///e:/Projects/recallQ/docs/auth/authorization.md) — Limit checks.

AGENT OWNER: apps/web/lib/billing.ts
AGENT UPDATE: docs/modules/billing-settings.md
