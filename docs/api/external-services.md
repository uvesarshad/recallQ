# External Services and Third-Party Integrations

> Scope: Third-party APIs, payment gateways, email systems, chatbots, safe remote fetching, and local parsing libraries.
> Rendering context: Server-side
> Project tier: 4
> Last updated: 2026-07-07

## Overview
Recall uses external APIs for AI, payments, email, Telegram capture, and push delivery. Local worker libraries handle document parsing and image placeholder generation.

## AI and Generative Services

### Google Generative AI API
- Role: metadata generation, action extraction, semantic embeddings, and RAG chat answering.
- SDK: `@google/generative-ai`.
- Models: `gemini-2.5-flash-lite` by default for tagging/summaries; `text-embedding-004` for 768-dimensional embeddings.
- Consumers: `apps/web/lib/gemini.ts`, `apps/web/lib/comment-actions.ts`, `apps/web/lib/archive-chat.ts`, and `apps/web/workers/enrichment-worker.ts`.
- Credentials: `GEMINI_API_KEY`; optional `GEMINI_MODEL`.

## SaaS and Platform Integrations

### Razorpay API
- Role: Starter/Pro subscription processing.
- Credentials: `RAZORPAY_KEY_ID`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, plan IDs.
- Webhooks: `apps/web/app/api/v1/payments/webhook/route.ts` validates Razorpay signatures.

### Stripe API
- Role: Optional Stripe checkout, portal, and webhook billing path.
- Credentials: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, Stripe price IDs, optional publishable keys.
- Webhooks: `apps/web/app/api/v1/payments/stripe/webhook/route.ts` validates Stripe signatures.

### Resend API
- Role: password reset mail, transactional email, inbound email ingestion, and email reminders.
- Credentials: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` or `EMAIL_FROM`, inbound/webhook secrets.
- Fallback: local development can log reset links; reminder email is skipped when Resend is not configured.

### Telegram Bot API
- Role: Telegram capture, linking, and reminder delivery.
- Credentials: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`.
- Helpers: `apps/web/lib/telegram.ts`.

### Expo Push API
- Role: mobile reminder delivery.
- Endpoint: `https://exp.host/--/api/v2/push/send` via `apps/web/lib/expo-push.ts`.
- Registry: `/api/v1/devices/push` stores per-device Expo tokens.

## Safe Remote Fetching
User-supplied link URLs and scraped image URLs must go through `apps/web/lib/url-safety.ts`. `safeFetch` allows only HTTP/HTTPS, rejects embedded credentials, blocks localhost/private/link-local/reserved IP ranges, validates DNS results, and revalidates redirects. `apps/web/lib/blur.ts` still enforces image byte caps before Sharp decodes a thumbnail.

## Content Parsing Libraries
- Cheerio: Parses fetched HTML for metadata and text.
- PDF Parse: Extracts PDF text.
- Mammoth: Extracts DOCX text.
- SheetJS (XLSX): Extracts spreadsheet text.
- Sharp: Builds tiny blur placeholders for scraped images after safe fetch and byte caps.

## Security Constraints
- AGENT AVOID: Never hardcode API keys or webhook secrets.
- AGENT NOTE: Verify webhook signatures for Razorpay, Stripe, Resend, and Telegram.
- AGENT NOTE: Never call `fetch` directly for user-supplied URLs or scraped image URLs. Use `safeFetch`.

## Update Triggers
- When adding, updating, or deleting third-party APIs or parser libraries.
- When model names, remote fetch policy, webhook validation, or push behavior changes.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) - Tech stack context.
- [docs/infra/environment.md](file:///e:/Projects/recallQ/docs/infra/environment.md) - Environment variables.
- [docs/api/database.md](file:///e:/Projects/recallQ/docs/api/database.md) - Vector and device-token storage.

AGENT OWNER: apps/web/lib/gemini.ts
AGENT UPDATE: docs/api/external-services.md
