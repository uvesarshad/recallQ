# REST API Route Handlers

> Scope: Backend REST API endpoints, request shapes, authentication guards, and response conventions.
> Rendering context: Server-side
> Project tier: 4
> Last updated: 2026-07-07

## Overview
Recall exposes versioned REST endpoints under `apps/web/app/api/v1/`. Web uses session cookies; extension and mobile use personal access tokens through `Authorization: Bearer ...`. NextAuth remains mounted at `/api/auth/*`.

Success responses use `apiOk` / `ok`; failures use the shared error envelope. New `/api/v1/*` request bodies should be validated with Zod schemas from `apps/web/lib/validation.ts` or `@recall/api-schema`.

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
- `GET /api/v1/items`: session or bearer; feed list, filters, pagination, and `?since=` delta sync.
- `POST /api/v1/items`: session/internal ingest item creation path.
- `GET /api/v1/items/[id]`: session item detail.
- `PATCH /api/v1/items/[id]`: session item metadata/canvas updates.
- `DELETE /api/v1/items/[id]`: session or bearer item delete.
- `POST /api/v1/items/batch`: session bulk item operations.
- `GET/POST /api/v1/items/[id]/comments`: session comments.
- `GET /api/v1/items/[id]/related`: session related items.
- `GET /api/v1/files/[...path]`: session file serving with path ownership checks.

## Retrieval
- `GET /api/v1/search`: session hybrid/fulltext/semantic search; max query length 500.
- `POST /api/v1/chat`: session RAG chat stream; validates `ChatRequestSchema`.
- `GET /api/v1/graph`: session canvas node payload.

## Collections, User, and Reminders
- `GET/POST /api/v1/collections`: session folder list/create.
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
