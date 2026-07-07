# REST API Route Handlers

> Scope: Backend REST API endpoints, request shapes, authentication guards, and response conventions.
> Rendering context: Server-side
> Project tier: 4
> Last updated: 2026-07-07

## Overview
Recall exposes versioned REST endpoints under `apps/web/app/api/v1/`. Web uses session cookies; extension and mobile use personal access tokens through `Authorization: Bearer ...`. NextAuth remains mounted at `/api/auth/*`.

Success responses use `apiOk` / `ok`; failures use the shared error envelope. New `/api/v1/*` request bodies should be validated with Zod schemas from `apps/web/lib/validation.ts` or `@recall/api-schema`.

`docs/openapi.json` is the generated OpenAPI 3.1 artifact for the public REST surface. Refresh it with `pnpm openapi:generate` when route contracts change.

## Authentication
- `/api/auth/[...nextauth]`: NextAuth v5 catch-all.
- `POST /api/v1/auth/tokens`: email/password to PAT exchange; rate-limited.
- `GET /api/v1/auth/tokens`: session-only token listing.
- `DELETE /api/v1/auth/tokens/[id]`: session-only token revoke.
- `POST /api/v1/auth/oauth/token`: mobile Google/Apple ID token to PAT exchange.

## Devices and Push
- `POST /api/v1/devices/push`: session or bearer; registers Expo Push tokens.
- `GET /api/v1/devices/push`: session-only device listing.
- `DELETE /api/v1/devices/push/[id]`: session-only soft revoke.
- `POST /api/v1/push-subscription`: web push subscription registration.

## Health
- `GET /api/v1/health`: public liveness endpoint; pings DB and worker heartbeats.

## Ingestion and Capture
- `POST /api/v1/ingest`: JSON single or bulk capture. Accepts `source` values including `extension` and `mobile`. Uses `requireIngestUser`, rate limiting, Zod validation, and transactional `ingestItem` writes.
- `POST /api/v1/ingest/file`: multipart file capture with MIME and hard size validation before `ingestItem`.
- `POST /api/v1/actions/preview`: session-only action prediction for draft notes; rate-limited.
- `POST /api/v1/email/inbound`: Resend-signed inbound email capture.
- `POST /api/v1/telegram/webhook`: Telegram-secret webhook capture.

## Archive Items
- `GET /api/v1/items`: session or bearer; feed list, filters, pagination, and `?since=` delta sync. Unfiltered delta responses include `deletedItems` from server tombstones.
- `POST /api/v1/items`: session/internal ingest item creation path.
- `GET /api/v1/items/[id]`: session or bearer item detail.
- `PATCH /api/v1/items/[id]`: session or bearer item title, summary, tags, note, folder, reminder, and canvas updates; used by extension/mobile edit sync with server timestamp last-write-wins.
- `DELETE /api/v1/items/[id]`: session or bearer item delete; records a tombstone before deletion.
- `GET/POST /api/v1/items/[id]/archive`: session or bearer archive status/read and URL archive request; POST accepts optional `asset_kinds` (`html`, `screenshot`, `pdf`, `video`) and records unsupported visual/video assets as inspectable failed rows when the deployment lacks a renderer/downloader.
- `POST /api/v1/items/batch`: session bulk item operations; bulk deletes record tombstones.
- `GET /api/v1/items/[id]/archive`: session or bearer archive/link health status, asset rows, and recent archive jobs for one item.
- `POST /api/v1/items/[id]/archive`: session or bearer opt-in page archive request/retry for URL items.
- `GET /api/v1/items/[id]/reader`: session or bearer reader payload; returns archived extracted text when available, then item text/summary fallback.
- `PATCH /api/v1/items/[id]/state`: session or bearer reading progress, read/favorite/archive/read-later state updates.
- `GET/POST /api/v1/items/[id]/highlights`: session or bearer list/create highlights; optional `q` searches quote/note text.
- `PATCH/DELETE /api/v1/items/[id]/highlights/[highlightId]`: session or bearer edit/delete highlight with item ownership enforced.
- `GET /api/v1/items/review/broken-links`: session or bearer broken-link review queue.
- `POST /api/v1/items/[id]/link-review`: session or bearer retry/archive link checks, mark resolved, or mark false positive.
- `GET/POST /api/v1/items/[id]/comments`: session comments.
- `GET /api/v1/items/[id]/related`: session related items.
- `GET /api/v1/files/[...path]`: session file serving with path ownership checks.

## Retrieval
- `GET /api/v1/search`: session hybrid/fulltext/semantic search; supports advanced filters, `limit`, `cursor`, max query length 500, and normalized query embedding cache.
- `GET/POST /api/v1/search/saved`: session saved-search list/create.
- `PATCH/DELETE /api/v1/search/saved/[id]`: session saved-search update/delete.
- `POST /api/v1/chat`: session or bearer RAG chat stream; validates `ChatRequestSchema` and uses the normalized query embedding cache for retrieval.
- `GET /api/v1/graph`: session canvas node payload.

## Import, Export, Automation, and RSS
- `POST /api/v1/imports/browser-bookmarks`: session browser/Netscape bookmarks HTML import; records session progress and duplicates.
- `POST /api/v1/imports/pocket`: session Pocket CSV/JSON import with preview mode, duplicate reporting, and session tracking.
- `POST /api/v1/imports/omnivore`: session Omnivore JSON import with label/folder mapping, preview mode, duplicate reporting, and session tracking.
- `POST /api/v1/imports/linkwarden`: session Linkwarden JSON import with collection/tag mapping, preview mode, duplicate reporting, and session tracking.
- `POST /api/v1/imports/csv`: session generic CSV import using URL/title/tag/folder/note column aliases, preview mode, duplicate reporting, and session tracking.
- `GET /api/v1/imports/[id]`: session import session status/details.
- `GET /api/v1/export/json`: session JSON archive export.
- `GET /api/v1/export/bookmarks`: session Netscape bookmarks HTML export.
- `GET/POST /api/v1/rss-feeds`: session or bearer RSS feed list/create; create queues an import job.
- `PATCH/DELETE /api/v1/rss-feeds/[id]`: session or bearer RSS feed update/delete.
- `GET/POST /api/v1/automation/rules`: session or bearer automation rule list/create.
- `PATCH/DELETE /api/v1/automation/rules/[id]`: session or bearer automation rule update/delete.
- `GET/POST /api/v1/webhooks`: session outbound webhook subscription list/create. Create returns the signing secret once; later responses mask it.
- `GET/PATCH/DELETE /api/v1/webhooks/[id]`: session outbound webhook read/update/delete. Subscriptions support item created, updated, deleted, and enriched events.

## Public Sharing and AI Preferences
- `PUT /api/v1/collections/[id]/share`: session or bearer enable/disable/rotate a public collection read link.
- `GET /api/v1/public/collections/[slug]`: public read-only collection payload with capped item list.
- `GET/PUT /api/v1/ai/prompts`: session or bearer custom enrichment prompt preferences; writes are Pro/self-host gated.

## Collections, User, and Reminders
- `GET /api/v1/collections`: session or bearer folder list for web/mobile/extension edit forms.
- `POST /api/v1/collections`: session folder create.
- `PATCH/DELETE /api/v1/collections/[id]`: session folder update/delete.
- `GET /api/v1/me`: session or bearer plan/usage profile; used by extension/mobile.
- `PATCH/DELETE /api/v1/me`: session profile mutations.
- `GET/POST /api/v1/reminders`: session reminder list/create.
- `PATCH/DELETE /api/v1/reminders/[id]`: session reminder update/delete.
- `GET /api/v1/user/telegram-status`, `POST /api/v1/user/telegram-token`, `DELETE /api/v1/user/telegram-link`: session Telegram integration helpers.

## Payments
- `POST /api/v1/payments/create-subscription`: session Razorpay subscription create.
- `POST /api/v1/payments/cancel-subscription`: session provider-aware cancel.
- `POST /api/v1/payments/webhook`: Razorpay-signed webhook.
- `POST /api/v1/payments/stripe/checkout`: session Stripe Checkout.
- `POST /api/v1/payments/stripe/portal`: session Stripe Portal.
- `POST /api/v1/payments/stripe/webhook`: Stripe-signed webhook.

## Security Constraints
- AGENT AVOID: Never return raw SQL errors or stack traces to clients.
- AGENT NOTE: All external webhooks must validate provider signatures/secrets.
- AGENT NOTE: Routes reachable from extension/mobile must use `requireUser(req)` or `requireIngestUser(req)` when bearer access is expected.

## Update Triggers
- When adding, renaming, or deleting an API route under `apps/web/app/api/v1/`.
- When altering endpoint parameters, response shapes, auth guards, or legacy rewrites.

AGENT OWNER: apps/web/app/api/v1/
AGENT UPDATE: docs/api/route-handlers.md
