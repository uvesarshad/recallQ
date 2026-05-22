# REST API Route Handlers

> Scope: Documents all backend REST API endpoints, method signatures, query/payload shapes, authentication guards, and response objects.
> Rendering context: Server-side
> Project tier: 4
> Last updated: 2026-05-22

## Overview
Recall exposes a versioned REST API under `apps/web/app/api/v1/` to handle items capture, search, AI chat, graph indexing, profile editing, and webhook handlers. The web app and the future Chrome extension and mobile apps all consume this API; the web hits it same-origin with NextAuth session cookies, the extension and mobile hit it with bearer tokens issued by `/api/v1/auth/tokens`. NextAuth itself keeps its standard `/api/auth/*` mounting and is not versioned.

A transparent rewrite in `apps/web/next.config.mjs` forwards legacy unversioned paths (`/api/items`, `/api/chat`, `/api/payments/webhook`, etc.) to their `/api/v1/*` equivalents so external webhook configurations and pre-existing internal callers keep working during the migration. The legacy-path rewrite block carries an explicit removal TODO and will be deleted once every caller has been updated.

Input bodies are validated against Zod schemas from `@recall/api-schema` via the `parseBody` helper in `apps/web/lib/api-response.ts`. Errors are returned through `fail(code, message, status, details?)` which renders the `ErrorResponse` envelope `{ error, code, details? }`; successes go through `ok(data, init?)`.

## REST Route Directory

All application routes live under `/api/v1/*`. Paths below are shown without the `/api/v1` prefix for brevity unless the prefix is meaningful (e.g. `/api/auth/*` which sits outside v1 because NextAuth requires the standard path).

### Authentication Endpoints

- `/api/auth/[...nextauth]`: NextAuth v5 catch-all. Standard endpoints for sign-in, callback, sign-out, session, CSRF. Kept at the standard `/api/auth/` path (not under v1) per NextAuth convention; OAuth provider redirect URIs depend on it.
- `/auth/tokens [POST]`: Exchange `{ email, password, device_name }` for a personal access token. Returns `{ token, id, prefix, device_name, created_at }` once; the raw `token` is never returned again. Used by the Chrome extension and the mobile apps. Validates input via `TokenIssueInputSchema` from `@recall/api-schema`. **Rate limited** (Stage 5): 5 attempts/IP/15min plus 10/email/hour. See `docs/security-audit.md`.
- `/auth/tokens [GET]`: Lists the current user's active tokens. Session cookie only (not callable with a bearer token, to prevent stolen-token reconnaissance). Returns `{ tokens: TokenSummary[] }` (no raw values, just metadata).
- `/auth/tokens/[id] [DELETE]`: Revokes a single token. Session cookie only, same rationale.
- `/auth/oauth/token [POST]`: Mobile OAuth → PAT exchange. Body `{ provider: "google" | "apple", id_token, device_name, name? }`. Verifies the ID token signature against the provider's JWKS (`lib/oauth-verify.ts`), validates audience against `OAUTH_ALLOWED_*_AUDIENCES`, finds or creates the user, links the `accounts` row, mints a PAT. Same response shape as `POST /auth/tokens`. Rate limited 10/IP/15min.

### Device + Push Endpoints

- `/devices/push [POST]`: Register the calling device's Expo Push token. Auth via session OR bearer (so the mobile app can register itself with its newly-minted PAT). Idempotent — re-posting the same token updates `last_seen_at` rather than failing on UNIQUE.
- `/devices/push [GET]`: Lists the user's active push devices. Session-only (mobile callers can't enumerate other devices via bearer).
- `/devices/push/[id] [DELETE]`: Soft-revokes a device token (`revoked_at = now()`).

### Health Endpoint

- `/health [GET]`: Liveness check intended for CloudPanel monitoring, uptime probes, and load-balancer health pings. No auth, no rate limit, no logging on success. Pings the database and reads from `worker_heartbeats` (see [docs/api/database.md](file:///e:/Projects/recallQ/docs/api/database.md)). Returns `200 { ok: true, db: "up", workers: { enrichment, reminders } }` when healthy, `503` otherwise. A worker with a heartbeat older than 5 minutes is reported as `down` even though the row exists.

### Ingestion and Capture Endpoints

- `/ingest [POST]`: Gateway for manual captures and extension saves. Accepts a JSON body containing type (url, text, file, note), source, raw text or URL, optional files, and overrides. Authenticates via session or x-internal-ingest-token. Returns an ingestion success object with item ID and a pending enrichment status.
- api/files [POST]: Multipart file capture handler. Validates file MIME types and size limits against user tiers. Saves the file buffer locally and returns the item record.
- api/actions/preview [POST]: Receives draft capture notes. Generates real-time predictions of tags, target folders, and reminders from the text body using Gemini models. Returns predicted properties and extraction confidence.

### Archive Items Endpoints

- api/items [GET]: Queries the user's item list. Accepts query parameters: q (fuzzy keywords search), tag, collection (folder UUID), type, cursor (for pagination), and limit (max 50). Returns items list, nextCursor value, and a boolean indicating if more items exist.
- api/items [POST]: Creates a manual archive item, calling the ingestion engine.
- api/items/[id] [GET]: Fetches metadata for a single item by UUID. Returns the full item object.
- api/items/[id] [PATCH]: Updates item parameters (title, summary, tags, folder, reminders, or canvas positioning coordinates). Evaluates comment actions if note updates contain commands. Returns the updated item.
- api/items/[id] [DELETE]: Permanently deletes an item and cleans up associated files. Returns success.
- api/items/batch [POST]: Processes bulk operations. Accepts a JSON list of item IDs and action strings (archive, delete, tag, move). Implements client-side delay for undo support. Returns success.

### Search and Retrieval Endpoints

- api/search [GET]: Specialized hybrid search endpoint. Performs SQL matches and optional vector cosine similarity queries to return top matches with relevance ranks. If vector support or embeddings are unavailable, hybrid mode falls back to exact/basic SQL results with a successful response.
- api/chat [POST]: AI chat drawer endpoint. Accepts a list of messages. Embeds the last query, retrieves relevant context items, generates answers using Gemini, and streams chunks and citations back to the client drawer as a Server-Sent Event stream.
- api/graph [GET]: Generates map visuals. Accepts minimum connection thresholds and filter types. Queries items and their relationships from item_relations. Returns nodes list and edges list.

### Collections and Billing Endpoints

- api/collections [GET/POST/DELETE]: Lists folders, creates a folder (with custom color and icon), or deletes folders.
- api/payments/create-subscription [POST]: Creates a Razorpay subscription transaction for Starter or Pro plans. Updates the database and returns the Razorpay transaction payload.
- api/payments/cancel-subscription [POST]: Sets user subscription to cancel at the end of the active billing cycle.
- api/payments/webhook [POST]: Listens to payment completions from Razorpay, validates webhook signatures, and updates user limits.
- api/reminders [GET/PATCH]: Lists user reminders or updates due remind dates.

### Integration and User Webhooks

- api/telegram [POST]: Webhook endpoint that parses text/files from the Telegram bot, links Telegram IDs to user profile records, and replies via Telegram.
- api/email [POST]: Inbound email webhook parser. Receives email attachments and text, resolving matching users.
- api/me [GET] / api/user [PATCH]: Returns active profile details or patches name, bio, timezone, and consent options.

## Security Constraints
- AGENT AVOID: Never return raw SQL connection errors or stack traces to the client. Always catch API exceptions and route them through `fail(...)` from `apps/web/lib/api-response.ts` which renders the `ErrorResponse` envelope.
- AGENT NOTE: All external webhooks (such as Razorpay, email, and Telegram) must validate inbound signatures to prevent request spoofing.
- AGENT NOTE: Inputs to any new `/api/v1/*` route must be validated against a Zod schema in `@recall/api-schema` via `parseBody(...)`. Inline `request.json()` without schema validation is not allowed.
- AGENT NOTE: A route reachable from the Chrome extension or mobile app must use `requireUser(req)` (accepts both session cookie and bearer token), not `requireSessionUser()` (cookie only).

### Stripe Billing Endpoints

- `/payments/stripe/checkout [POST]`: Session-authed. Body `{ plan: "starter" | "pro" }`. Returns `{ sessionId, url }`. Client should redirect to `url` (Stripe-hosted Checkout). Rejects with 409 if the user has an active Razorpay subscription. Disabled with 501 if `STRIPE_SECRET_KEY` is not set.
- `/payments/stripe/webhook [POST]`: No auth — Stripe-signed (`stripe-signature` header). Verifies via `STRIPE_WEBHOOK_SECRET`. Handles `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, `invoice.payment_failed`. Idempotent (all DB writes are upserts). Returns 200 on success, 400 on bad signature, 500 on handler error (Stripe retries).
- `/payments/stripe/portal [POST]`: Session-authed. Creates a Stripe Billing Portal session for the user's `stripe_customer_id` (404 if they don't have one — they need to subscribe first). Returns `{ url }` for the client to redirect to. The Portal handles plan upgrades / downgrades, payment method updates, invoice viewing, and cancellation — so for Stripe users we route both "Manage" and "Cancel" into here.
- `/payments/cancel-subscription [POST]`: Now provider-aware. Reads `users.billing_provider` and dispatches to either `cancelHostedSubscription` (Razorpay) or `cancelStripeSubscription`. Returns `{ success, provider }` so the client knows which path ran.

## Update Triggers
- When adding, renaming, or deleting an API route handler under `apps/web/app/api/v1/`.
- When altering the parameters or response shapes of an existing REST route.
- When changing request authentication guards or token headers.
- When the legacy-path rewrite block in `apps/web/next.config.mjs` is modified or removed.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Index of API directories.
- [docs/architecture/data-flow.md](file:///e:/Projects/recallQ/docs/architecture/data-flow.md) — Ingestion pipelines.
- [docs/modules/capture.md](file:///e:/Projects/recallQ/docs/modules/capture.md) — Capture routing details.

AGENT OWNER: apps/web/app/api/v1/
AGENT UPDATE: docs/api/route-handlers.md
