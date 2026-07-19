# RecallQ App Performance, Security, and Feature Audit

> Date: 2026-07-07
> Scope: Current RecallQ monorepo app surface: Next.js web app, REST API, workers, PostgreSQL migrations, Chrome extension, Expo mobile app, shared API client, and operational docs.
> Method: Static code and documentation audit. No live production traffic, database query plans, dependency advisory feed, or runtime profiling data was available.

## Executive Summary

RecallQ has a strong core shape: asynchronous enrichment, pgvector-backed retrieval, local-first extension capture, mobile offline capture, durable archive jobs, OpenAPI/CLI/MCP surfaces, and a mostly user-scoped REST API. The largest risks are not in the headline architecture. They are in bypass paths and operational gaps that appeared as the product surface expanded.

The highest-priority issues are:
- Production can still boot with `DEV_BYPASS_LOGIN=true`, which turns every auth check into the static dev user.
- Reminder plan limits are enforced during ingest, but direct reminder/item update paths can create reminders without the same cap.
- The health endpoint ignores the generic jobs worker even though that worker now owns imports, RSS, archive jobs, webhooks, and retention cleanup.
- Imports and exports still do heavy work inside HTTP requests, while the jobs table already exists.
- Feed and sync growth need better composite indexes and server-side filtering.

## Evidence Reviewed

- Docs: `docs/overview.md`, `docs/security-audit.md`, `docs/performance-audit.md`, API/database/auth/deployment/testing docs, and capture/search/billing/extension module docs.
- Web/API code: `apps/web/app/api/v1/*`, `apps/web/lib/*`, `apps/web/components/*`, `apps/web/proxy.ts`, `apps/web/next.config.mjs`.
- Workers: `apps/web/workers/enrichment-worker.ts`, `reminder-worker.ts`, `job-worker.ts`.
- Clients: `apps/extension/*`, `apps/mobile/*`, `packages/api-client/src/index.ts`.
- Migrations and scripts: `migrations/*.sql`, `scripts/migrate*.js`, `scripts/admin-jobs.mjs`.

## P0 Security and Correctness

1. Block dev auth bypass in production.
   `apps/web/lib/auth.ts` enables a static dev session whenever `DEV_BYPASS_LOGIN=true`; `apps/web/lib/env.ts` does not reject that in production. Add a production boot check that throws when `NODE_ENV=production && DEV_BYPASS_LOGIN=true`, and add a focused env test or startup smoke check.

2. Reuse reminder cap enforcement outside ingest.
   `apps/web/lib/ingest.ts` checks `getMaxReminders(plan)`, but `/api/v1/reminders`, `/api/v1/items/[id] PATCH`, `/api/v1/items/batch`, automation `set_reminder`, and comment-action reminder updates insert or update reminders without the same cap. Centralize reminder creation in a helper that locks the user row, checks active unsent reminders, validates ownership, and keeps item/reminder rows consistent.

3. Add the jobs worker to health and alerting.
   `apps/web/workers/job-worker.ts` writes a `jobs` heartbeat, but `apps/web/app/api/v1/health/route.ts` only evaluates `enrichment` and `reminders`. A deployment can look healthy while imports, RSS, archive jobs, webhooks, and retention cleanup are stopped. Health should include `jobs` and fail 503 when any required worker is down.

## P1 Security Hardening

1. Move CSP from report-only to enforce after report review.
   `apps/web/proxy.ts` still emits `Content-Security-Policy-Report-Only` and keeps a broad fallback `script-src` with `https:` and `unsafe-inline`. Keep Razorpay support, but set a deadline to enforce CSP and add a report URI/report-to endpoint.

2. Replace permissive API CORS with an allow-list.
   `/api/v1/*` currently returns `Access-Control-Allow-Origin: *`. This is mostly protected by bearer/session behavior, but production should allow the stable extension origin, first-party app origins, and explicit development origins.

3. Reduce global internal-ingest-token blast radius.
   `requireIngestUser(req)` accepts a single `INTERNAL_INGEST_TOKEN` plus any `x-recall-user-id` that exists. If the token leaks, it can ingest for every user. Prefer per-channel scoped tokens, HMAC body signatures, or integration rows tied to one user/channel.

4. Add hard byte caps to all untrusted remote/file capture paths before buffering.
   Web file ingest caps multipart uploads at 50 MB before buffering, but Telegram downloads the full file in `apps/web/lib/telegram.ts`, email inbound decodes attachment payloads after reading the webhook body, and URL enrichment reads fetched HTML with `res.text()` in `enrichment-worker.ts`. Add capped streaming readers and per-channel attachment count/total limits.

5. Pin dependency versions.
   `apps/web/package.json` and root `package.json` use many `latest` ranges plus `next-auth` beta. For a Tier 4 app, pin exact production dependency versions and use Renovate/Dependabot with CI instead of implicit major upgrades.

## P1 Performance and Reliability

1. Add composite indexes for feed and delta sync.
   Current migrations include `idx_items_user_id` and global `idx_items_created_at`, but hot paths query `WHERE user_id = $1 ORDER BY created_at DESC` and `WHERE user_id = $1 AND updated_at > $2 ORDER BY updated_at ASC`. Add `items(user_id, created_at DESC, id DESC)` and `items(user_id, updated_at ASC, id ASC)`. Re-check search/filter indexes after server-side filters move out of the client.

2. Queue imports instead of processing them in request handlers.
   `POST /api/v1/imports/*` accepts up to 15 MB and calls `importExternalRecords` synchronously, which parses records, writes import-session rows, calls `ingestItem` per record, and updates progress repeatedly before responding. Use the existing `jobs` table for non-preview imports and return `202 Accepted` plus an import-session ID.

3. Stream or queue full exports.
   `/api/v1/export/json` builds all items, collections, reminders, and archive assets into one JSON response. For large archives, move to streaming NDJSON/zip or a queued export artifact with expiry.

4. Push feed filters to the server.
   `FeedPageClient` applies type/source/folder/tag/state filters over the currently loaded item slice, while load-more requests ignore those filters. Large archives can show incomplete filtered results. Move filters into query params, reuse `/api/v1/items` validation, and return accurate counts/cursors.

5. Reduce bearer-token write amplification.
   `requireBearerUser` updates `personal_access_tokens.last_used_at` on every bearer request. Extension/mobile sync can turn reads into constant writes. Throttle this update, for example only when `last_used_at < now() - interval '15 minutes'`, or write asynchronously.

6. Make PostgreSQL pool sizing configurable.
   Each web/worker process uses a pool max of 20. Web plus enrichment, reminders, and jobs can reserve up to roughly 80 connections before admin scripts. Add `PGPOOL_MAX`, document worker/process sizing, and consider PgBouncer for hosted deployments.

7. Add retention for cache and observability tables.
   `query_embedding_cache` has expiry timestamps but no cleanup path found. `operation_logs`, `import_sessions`, `webhook_deliveries`, and tombstones also need explicit retention policies once sync windows and audit needs are decided.

8. Replace idempotency-by-error migrations with tracked migrations.
   `scripts/migrate.js` reruns every SQL file and skips only selected duplicate-object errors. Add a `schema_migrations` table, transactional migration recording, and a CI check that new migrations are monotonic and idempotent where intended.

## P2 API and Validation Consistency

1. Normalize all `/api/v1/*` responses through shared helpers.
   Several reminder routes still return raw `NextResponse.json` errors instead of `apiOk`/`apiError` envelopes. Align them with the documented `/api/v1` contract.

2. Use `safeParse` plus bounded schemas on update routes.
   Some routes call `schema.parse(await req.json())` directly. Invalid JSON or schema failures should return the shared 400 envelope, not route-level exceptions.

3. Keep generated OpenAPI in CI.
   The generated `docs/openapi.json` exists, but route drift is likely as handlers are hand-written. Add a CI check that `pnpm openapi:generate` produces no diff.

4. Refresh environment documentation.
   `apps/web/lib/env.ts` includes `LLM_PROVIDER`, `LLM_MODEL`, `LLM_BASE_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, but `docs/infra/environment.md` does not list them.

## Feature Enhancement Backlog

1. Server-backed feed filtering and saved views.
   Make filters shareable via URL, support accurate counts, and let saved searches include filter state. This also fixes large-archive correctness.

2. Mobile search, filtering, and pagination.
   The mobile feed loads the first 50 server items and pending local captures. Add search, pull-to-load-more, folder/tag/state filters, and saved searches.

3. Mobile reader/highlights/link-review parity.
   The APIs exist, but the mobile detail surface exposes only basic editing and archive request. Add reader mode, highlights, reading progress, favorite/archive/read-later, and broken-link review actions.

4. Extension conflict and edit UX.
   Extension sync uses last-write-wins and no conflict UI. Add a conflict banner for dirty local rows, manual retry visibility, folder/tag edit controls, and a way to inspect sync errors beyond a generic "Sync failed."

5. Public collection UX.
   Public collection sharing currently exposes an API payload. Add a branded read-only public page, share preview metadata, optional expiry/revoke controls, and basic view counters.

6. Operations dashboard.
   Add a session-authenticated admin/settings surface for worker status, queue depth, failed jobs, operation-log summaries, archive-retention candidates, and import/webhook failures. `scripts/admin-jobs.mjs` already has much of the backend logic.

7. Better AI provider operations.
   The unified LLM interface is useful, but provider selection needs settings docs, startup validation for the selected key, operation-log provider/model reporting everywhere, and a fallback policy when the selected provider is unavailable.

## Recommended Execution Order

1. P0 hardening sprint:
   production dev-bypass fail-closed, centralized reminder cap helper, health check for jobs worker, shared response validation cleanup.

2. Growth performance sprint:
   composite feed/sync indexes, server-side feed filters, throttled PAT `last_used_at`, queued imports, export streaming/queueing.

3. Edge ingestion sprint:
   capped streaming readers for URL HTML, Telegram files, and email attachments; per-channel rate limits; import route rate limits.

4. Ops maturity sprint:
   migration tracking, retention jobs for cache/log/session/tombstone tables, pool sizing docs/env, dashboard for queue and worker state.

5. Product parity sprint:
   mobile search/reader/highlights, extension conflict UX, public collection page, richer saved views.

## Documentation Follow-Ups

- Update `docs/infra/environment.md` for the LLM and VAPID variables already present in `apps/web/lib/env.ts`.
- Update `docs/security-audit.md` after fixing dev bypass, reminder cap bypass, CSP enforcement, and CORS allow-listing.
- Update `docs/performance-audit.md` after adding composite indexes, queued imports, export streaming/queueing, and cache/log retention.
- Update `docs/infra/deployment.md` when `PGPOOL_MAX`, migration tracking, and health-check semantics change.

AGENT OWNER: docs/plan/
AGENT UPDATE: docs/overview.md
