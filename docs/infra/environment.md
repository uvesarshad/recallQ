# Environment Variables Configuration

> Scope: Lists and describes all environment variables used by the Recall application, their visibility, validation, and consuming modules.
> Rendering context: Isomorphic
> Project tier: 4
> Last updated: 2026-05-17

## Overview
Recall utilizes a Zod validation schema inside lib/env.ts to enforce exact types, defaults, and optional flags for all environment variables at startup. If any required variable is missing or formatted incorrectly in the local environment, the application throws a configuration error on boot.

## Environment Variables List

- NODE_ENV: Server-side runtime mode. Accepts values: development, test, or production. Defaults to development. Consumed across build pipelines and conditional development features.
- DATABASE_URL: Server-side PostgreSQL connection string. Required for database client Pool initialization in lib/db.ts.
- AUTH_SECRET: Server-side cryptographic key used by NextAuth to sign session tokens and JWTs. Required.
- AUTH_URL: Server-side canonical Auth.js origin. Optional. Use in production or fixed-origin development deployments when OAuth callbacks must be generated for a specific host.
- NEXTAUTH_URL: Legacy NextAuth canonical origin. Optional. Supported for compatibility, but local localhost values are ignored in development when AUTH_URL is absent so auth redirects use the active dev server port.
- APP_URL: Isomorphic base URL of the deployed application. Optional.
- APP_DOMAIN: Isomorphic domain string (e.g. localhost or recall.app) used to construct sender email addresses. Optional.
- SELF_HOSTED: Isomorphic toggle to switch off SaaS billing limits. Accepts: true or false. Optional.
- FILES_BASE_PATH: Server-side directory path where uploaded archive files are stored. Defaults to /tmp/recall/files. Consumed in lib/storage.ts.
- INTERNAL_INGEST_TOKEN: Server-side secret key used to validate automated capture requests from extensions, webhooks, or Telegram bots. Optional.
- TELEGRAM_BOT_TOKEN: Server-side bot token from Telegram. Consumed in lib/telegram.ts to verify webhook signatures and post messages. Optional.
- TELEGRAM_WEBHOOK_SECRET: Server-side secret used to secure Telegram webhook callbacks. Optional.
- TELEGRAM_BOT_USERNAME: Server-side username of the registered bot. Defaults to RecallBot. Optional.
- RESEND_API_KEY: Server-side API key for the Resend mailer. Consumed in workers/reminder-worker.ts, email route handlers, and auth reset actions to deliver email reminders, transactional messages, and password reset links. Optional.
- RESEND_INBOUND_SECRET: Server-side key used to secure inbound email ingestion webhooks. Optional.
- RESEND_WEBHOOK_SECRET: Server-side webhook authentication secret from Resend. Optional.
- RESEND_FROM_EMAIL: Server-side default sender email address for Resend notifications and password reset emails. Optional.
- EMAIL_FROM: Server-side fallback sender address for notifications and password reset emails. Optional.
- GOOGLE_CLIENT_ID: Server-side OAuth client identifier for Google Sign-in. Consumed in lib/auth.ts. Optional.
- GOOGLE_CLIENT_SECRET: Server-side OAuth secret for Google Sign-in. Consumed in lib/auth.ts. Optional.
- GEMINI_API_KEY: Server-side access key for the Google Generative AI API. Required for content enrichment and semantic search vectors. Consumed in lib/gemini.ts. Optional.
- GEMINI_MODEL: Server-side string indicating the model used for tag and summary generation. Defaults to gemini-2.5-flash-lite. Consumed in lib/gemini.ts. Optional.
- RAZORPAY_KEY_ID: Server-side Razorpay merchant key ID. Optional.
- NEXT_PUBLIC_RAZORPAY_KEY_ID: Client-side Razorpay key ID, exposed in the browser to load Razorpay payment frames. Optional.
- RAZORPAY_KEY_SECRET: Server-side Razorpay merchant secret key. Consumed in lib/billing.ts to verify webhook signatures and issue subscription requests. Optional.
- RAZORPAY_WEBHOOK_SECRET: Server-side secret to authenticate payment webhooks. Optional.
- RAZORPAY_PLAN_STARTER_YEARLY_ID: Server-side Razorpay subscription plan identifier for the Starter plan. Optional.
- RAZORPAY_PLAN_PRO_YEARLY_ID: Server-side Razorpay subscription plan identifier for the Pro plan. Optional.
- DEV_BYPASS_LOGIN: Server-side development flag. Accepts: true or false. When true, bypasses NextAuth and creates a mock developer session automatically. Optional.

## Security Constraints
- AGENT AVOID: Never expose secret keys to the browser. Only NEXT_PUBLIC_RAZORPAY_KEY_ID is public-safe. All other secrets are strictly server-side.
- AGENT NOTE: If adding a new environment variable, it must be declared in both the Zod schema in lib/env.ts and documented in this file.

## Update Triggers
- When a new environment variable is added to lib/env.ts.
- When an existing environment variable is removed, renamed, or its Zod schema type changes.
- When the exposure level of a variable changes (e.g. adding NEXT_PUBLIC_).

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Connects tech stack variables.
- [docs/auth/auth-flow.md](file:///e:/Projects/recallQ/docs/auth/auth-flow.md) — Uses client and auth keys.
- [docs/modules/billing-settings.md](file:///e:/Projects/recallQ/docs/modules/billing-settings.md) — Uses Razorpay keys.

AGENT OWNER: lib/env.ts
AGENT UPDATE: docs/infra/environment.md
