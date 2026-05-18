# External Services and Third-Party Integrations

> Scope: Documents third-party APIs, merchant payment gateways, email systems, chatbot services, and local document parsing libraries.
> Rendering context: Server-side
> Project tier: 4
> Last updated: 2026-05-17

## Overview
Recall relies on several external APIs and specialized utility libraries to perform core SaaS functions like AI synthesis, payments processing, transactional emails, Telegram chatbot captures, and text extractions from diverse uploaded file types.

## AI and Generative Services

### Google Generative AI API
- Role: Drives the semantic second-brain capabilities, RAG chat answering, and automated metadata generation.
- SDK: Interacted with via the official Google Generative AI npm package.
- Models: Uses gemini-2.5-flash-lite (by default, or configured in GEMINI_MODEL) for tagging and summaries. Uses text-embedding-004 to calculate 768-dimensional text vectors for search and RAG matches.
- Consumer: Consumed by lib/gemini.ts, workers/enrichment-worker.ts, lib/archive-chat.ts, and lib/comment-actions.ts.
- Credentials: GEMINI_API_KEY.
- Fallback: Throws configuration errors if missing. Bypasses vector relationships and RAG queries if vector support is disabled.

## SaaS and Platform Integrations

### Razorpay API
- Role: Payment processing and subscription tier management (Starter vs. Pro).
- Integration Pattern: Custom fetch-based wrappers (razorpayRequest) targeting Razorpay endpoint routes.
- Credentials: RAZORPAY_KEY_ID, NEXT_PUBLIC_RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET.
- Webhooks: Validates payment completions and syncs limits through syncUserSubscriptionFromEntity in lib/billing.ts.
- Fallback: Disabled in self-hosted configurations (SELF_HOSTED is true), giving all users access to unlimited limits.

### Resend API
- Role: Sends transactional emails, reminder alerts, and password reset emails for local email/password accounts.
- Integration Pattern: Interacts via the official Resend SDK.
- Credentials: RESEND_API_KEY.
- Fallback: Optional. Email reminder delivery is skipped or limited where the API key is not configured. Password reset links are logged to the server console in local development when the API key or sender address is missing.

### Telegram Bot API
- Role: Handles remote chat bot capture and posts reminders back to users.
- Integration Pattern: Invokes standard fetch requests to Telegram API endpoints.
- Credentials: TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, and TELEGRAM_WEBHOOK_SECRET.
- Helpers: Manages sendMessage, setWebhook, and getFile (downloading buffers directly from Telegram hosts) in lib/telegram.ts.

## Content Parsing Libraries
Recall extracts text from files locally inside the enrichment worker, bypassing external API parsing overhead:
- Cheerio: Parses raw HTML strings from URLs to scrape og:title, og:description, and og:image tags.
- PDF Parse: Reads raw PDF buffers and returns stripped page content.
- Mammoth: Asynchronously extracts plain text from Word files (.docx).
- SheetJS (XLSX): Extracts sheets and outputs textual representations from Excel sheets (.xls, .xlsx).

## Security Constraints
- AGENT AVOID: Never hardcode Razorpay merchant keys or Gemini API keys. They must strictly be retrieved from the environment schema in lib/env.ts.
- AGENT NOTE: Always verify webhooks via sha256 crypt hmac signatures inside lib/billing.ts to defend against payment fraud.

## Update Triggers
- When adding, updating, or deleting third-party APIs or npm parsers.
- When changing the model names or endpoints of a registered AI service.
- When changing signature validation or webhook patterns for Resend, Razorpay, or Telegram.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Tech stack context.
- [docs/infra/environment.md](file:///e:/Projects/recallQ/docs/infra/environment.md) — Connects env parameters.
- [docs/api/database.md](file:///e:/Projects/recallQ/docs/api/database.md) — Details the vector storage.

AGENT OWNER: lib/gemini.ts
AGENT UPDATE: docs/api/external-services.md
