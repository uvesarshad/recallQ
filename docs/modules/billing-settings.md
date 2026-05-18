# Billing and Settings Module

> Scope: Documents subscription plan tiers, Razorpay integrations, subscription webhooks, settings routing, and user profiles.
> Rendering context: Isomorphic
> Project tier: 4
> Last updated: 2026-05-17

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
- Creating Subscriptions: Handled in app/api/payments/create-subscription/route.ts. Initiates transactional subscription payloads using standard merchant endpoint fetches, returning Razorpay transaction tokens.
- Cancelling Subscriptions: Handled in app/api/payments/cancel-subscription/route.ts. Submits cancellation requests to stop payments at the active cycle's close.
- Webhook Listener: Handled in app/api/payments/webhook/route.ts. Validates signatures using verifyHostedWebhook against the secret in RAZORPAY_WEBHOOK_SECRET. It then parses Razorpay payloads, updates plan limits, and maps renewal timestamps inside the users table.

### Settings Routing and Workspace Views
Settings are grouped into a clean multi-tab layout using the components/SettingsNav.tsx control sidebar:
- Settings Redirects: General alias links (such as /settings or /app/settings) are caught and redirected server-side to canonical tab layouts to prevent broken route flows.
- Profile Settings (/app/settings/profile): Allows updating names, biographies, default timezone parameters, and user marketing consents via PATCH calls to api/user.
- Billing Settings (/app/settings/billing): Displays current monthly save usage counters, active subscription statuses, billing renewal dates, and mounts Razorpay payment widgets.
- Integrations Settings (/app/settings/integrations): Lists the custom inbound capture email address, generates unique Telegram bot pairing tokens, displays linking instructions, and registers bot webhooks.

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

AGENT OWNER: lib/billing.ts
AGENT UPDATE: docs/modules/billing-settings.md
