# Karakeep Audit Task List

> Date: 2026-07-07
> Source report: `docs/plan/2026-07-07-karakeep-comparison-audit.md`
> Scope: Execution backlog generated from the Karakeep comparison audit.
> Status key: Done, Next, Planned, Later

> Implementation note, 2026-07-07: Execution waves completed P0.1-P0.7, P1.1-P1.25, P1.27-P1.31, P2.1-P2.12, P3.1-P3.5, and current docs updates. P1.26 remains partial until device-build/mobile platform acceptance checks are complete.

## Guiding Direction

RecallQ should not clone Karakeep feature-for-feature. The backlog below closes the gaps that matter for trust, durability, migration, automation, and operations while preserving RecallQ's differentiators: RAG chat with citations, canvas recall, reminders, local-first tab offload, and shared REST/Zod clients.

## P0 - Correctness and Security

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P0.1 | Done | Add SSRF protection for server-side URL fetches. | `apps/web/lib/url-safety.ts` exists; enrichment URL scraping and blur image fetching use `safeFetch`; tests cover blocked protocols, private IPs, localhost, redirects, and safe public URLs. |
| P0.2 | Done | Make ingest writes transactional. | Item insert, save count, storage update, inferred folder creation, and reminder insert commit together; failed inserts roll back and remove any saved disk file. |
| P0.3 | Done | Make storage limit enforcement atomic. | User row is locked before quota checks; files are counted once; concurrent uploads cannot bypass plan storage caps. |
| P0.4 | Done | Replace `Infinity` plan caps with explicit unlimited branches. | Pro/self-host paths do not pass `Infinity` into SQL or counters; finite limits are checked in TypeScript before writes. |
| P0.5 | Done | Add idempotent enrichment worker claiming. | Migration 020 adds `enrichment_status`, `enrichment_locked_at`, `enrichment_attempt_count`, `enrichment_last_error`; worker claims with `FOR UPDATE SKIP LOCKED`; failed jobs back off; permanently failing jobs stop hot-looping. |
| P0.6 | Done | Add worker-claim tests. | `apps/web/tests/enrichment-claim.test.ts` covers duplicate-worker prevention, retry increment, terminal failure state, and successful transition to enriched. |
| P0.7 | Done | Add regression tests for unlimited plan branches. | `apps/web/tests/ingest-limits.test.ts` covers free, starter, pro, and self-hosted save/storage/reminder limits without SQL serialization of non-finite values. |

## P1 - Archive Durability

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P1.1 | Done | Design archive asset schema. | Migration 026 adds durable asset records for HTML, screenshot, PDF, original upload, extracted text, and thumbnail metadata; docs define storage ownership and retention. |
| P1.2 | Done | Add opt-in "archive this page" flow. | Users can request durable capture for a URL from item detail and capture flows; job status is visible through item/archive responses; failures are inspectable. |
| P1.3 | Done | Capture archived HTML. | Worker stores sanitized HTML/text snapshot, response metadata, canonical URL, content hash, and fetch timestamp. |
| P1.4 | Done | Capture screenshots/PDFs. | Archive requests accept `asset_kinds`; worker generates screenshot/PDF assets with size and timeout limits when Playwright is installed, applies SSRF-safe main/subresource checks, and records explicit failed asset rows when the renderer is unavailable. |
| P1.5 | Done | Add link health status. | Items track last checked time, HTTP status, broken-link state, and failure reason; feed/detail expose broken or stale links. |
| P1.6 | Done | Add archive retention and cleanup rules. | Item deletion removes owned archive asset files/rows and decrements storage; migration 041 adds retention/deleted metadata; the jobs worker and `admin:jobs archive-retention --apply` clean expired assets with dry-run-first operator control. |
| P1.7 | Done | Add video archival support. | V1 adds the explicit opt-in asset kind, schema allowance, job payload path, and inspectable unsupported asset marker without adding a heavy downloader dependency; full downloader-backed video capture remains a future paid/plan-gated expansion. |

## P1 - Reader, Highlights, and Review

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P1.8 | Done | Add reader mode for enriched article text. | `GET /items/[id]/reader` prefers archived extracted text, falls back to item text/summary, and item detail renders reader text with source metadata. |
| P1.9 | Done | Add highlights. | Migration 037 and highlight APIs support create, edit, delete, item-local search, and global item search over quote/note text. |
| P1.10 | Done | Add reading progress and states. | Migration 036 adds progress, read state, favorite, archived, and read-later fields; item detail updates them and the feed filters them. |
| P1.11 | Done | Add broken-link review queue. | `/items/review/broken-links` lists broken URLs; item detail can re-archive/retry and mark false positives through link-review actions. |

## P1 - Import, Export, and Migration

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P1.12 | Done | Add import session model. | Migration 024 tracks import source, status, progress, errors, duplicate counts, and created item IDs. |
| P1.13 | Done | Import browser bookmarks HTML. | Users can upload Netscape bookmarks HTML; folders/tags map predictably; duplicates are reported. |
| P1.14 | Done | Import Pocket, Omnivore, Linkwarden, and CSV. | Pocket CSV/JSON, Omnivore JSON, Linkwarden JSON, and generic CSV imports have parser tests, dry-run preview, duplicate handling, and import-session status. |
| P1.15 | Done | Export JSON. | Users can export all items, tags, collections, reminders, highlights placeholder, and archive asset references in a documented schema. |
| P1.16 | Done | Export Netscape bookmarks HTML. | URL collections and tags can be exported for browser/read-it-later migration. |

## P1 - Search and Organization

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P1.17 | Done | Add advanced search parser. | Supports `type:`, `tag:`, `folder:`, `source:`, `after:`, `before:`, `has:reminder`, `is:enriched`, `is:broken`, quoted phrases, and boolean `and/or`. |
| P1.18 | Done | Add search pagination. | Exact, semantic, and merged search return stable cursors; feed search can load more without duplicate rows. |
| P1.19 | Done | Add normalized URL host. | Migration 022 adds/backfills `items.url_host`; ingest/enrichment store the host; `(user_id, url_host)` index replaces repeated SQL string extraction for same-domain relations. |
| P1.20 | Done | Add smart saved searches. | Users can save advanced queries as dynamic collections from Feed search, reopen them from the smart-search rail, and delete saved searches without copying items. |
| P1.21 | Done | Add shared/public collections. | Migration 046 and `/collections/[id]/share` add narrow public read links; `/public/collections/[slug]` returns capped read-only collection payloads. Collaboration editing remains out of scope. |

## P1 - Sync and Local-First Clients

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P1.22 | Done | Add server tombstones. | Migration 021 adds `item_tombstones`; single and batch deletes record tombstones; unfiltered delta sync returns `deletedItems` to extension/mobile clients. |
| P1.23 | Done | Add edit propagation. | Bearer `PATCH /items/[id]` supports non-web edits; mobile pushes title, note, tags, folder, and reminder edits; mobile can request URL archive jobs; extension/mobile client models carry folder, reminder, archive, and link-health state. |
| P1.24 | Done | Add sync conflict policy. | Server timestamp last-write-wins is documented and consistently applied: accepted edits update `updated_at`; clean clients apply pull rows; dirty extension rows push before accepting remote overwrites. |
| P1.25 | Done | Finish Expo Go testing loop. | Mobile README includes LAN setup, auth, feed, capture, detail, offline queue, and known Expo Go limitations. |
| P1.26 | Next | Prepare EAS/dev-build path. | Partial: `apps/mobile/eas.json`, dev-client README path, and web `.well-known` placeholders exist. Remaining: real Apple Team ID, Android signing SHA-256, final icon/splash assets, share extension, and device-build verification. |

## P1 - Automation

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P1.27 | Done | Add RSS feed capture. | Users can add RSS feeds; worker creates items idempotently; feed errors and last poll status are visible. |
| P1.28 | Done | Design rule engine schema. | Migration 025 adds rule definitions with event, conditions, actions, enabled flag, priority, last run, and audit logs. |
| P1.29 | Done | Implement capture rules. | Capture/import/RSS rules can skip, add tags, move folder, set reminder, request archive, mark favorite, mark archived, and mark read-later. |
| P1.30 | Done | Add outbound webhooks. | Users can subscribe to item created/updated/deleted/enriched events; delivery jobs sign payloads, retry failures, and track delivery status. |
| P1.31 | Done | Add custom AI prompts. | Migration 047 and `/ai/prompts` store bounded Pro/self-hosted enrichment preferences; the worker applies them inside the existing safe JSON prompt while free/starter users keep defaults. |

## P2 - Performance and Operations

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P2.1 | Done | Add partial enrichment backlog index. | Migration 018 adds `idx_items_pending_enrichment` for `WHERE enriched = false`. |
| P2.2 | Done | Introduce a Postgres job table. | Migration 023 adds `jobs` covering crawl, parse, summarize, embed, relation build, reminder, import, webhook, and archive tasks with status, attempts, locks, payload/result, and errors. |
| P2.3 | Done | Split worker responsibilities by job type. | Generic `worker:jobs` claims RSS/external import, archive, and webhook jobs with operation logs and retry paths; enrichment and reminders remain isolated. |
| P2.4 | Done | Add query embedding cache. | Migration 039 adds `query_embedding_cache`; search/chat use cached normalized query embeddings before calling Gemini. |
| P2.5 | Done | Add AI/crawl cost observability. | Migration 040 adds `operation_logs`; enrichment and generic jobs record provider/model, duration, attempts, token estimates, crawl bytes, and failure reason where available. |
| P2.6 | Done | Add admin/backfill tooling. | `scripts/admin-jobs.mjs` inspects queue depth/failed jobs/operation summaries and supports `--apply`-guarded retry, re-enrichment, and URL-host backfill. |
| P2.7 | Done | Add Docker compose self-host package. | `docker-compose.selfhost.yml` runs web, workers, Postgres + pgvector, and shared file storage; `docs/infra/self-host-docker.md` documents env and volumes. |
| P2.8 | Done | Add Kubernetes/Helm package. | `deploy/helm/recallq` deploys web, enrichment/reminder/jobs workers, service, optional ingress, Secret/ConfigMap, and shared archive-file PVC. |

## P2 - API, Agent, and Ecosystem

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P2.9 | Done | Generate OpenAPI from shared schemas. | `scripts/generate-openapi.mjs` deterministically writes `docs/openapi.json` covering auth tokens, items, ingest, search, chat, reminders, devices, payments, and errors. |
| P2.10 | Done | Add MCP server. | `scripts/recall-mcp-server.mjs` exposes search, read, URL/text capture, update, delete, and chat tools over bearer-authenticated REST. |
| P2.11 | Done | Add CLI. | `scripts/recall-cli.mjs` supports token setup, URL/text/file capture, search, JSON/bookmark export, bookmark import/status, and admin job delegation. |
| P2.12 | Done | Publish SDK/client docs. | `docs/api/sdk-client.md` covers `@recall/api-client`, CLI usage, and generated OpenAPI contract refresh. |

## P3 - Documentation and Product Fit

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P3.1 | Done | Clean stale docs paths. | Current docs point implementation references at `apps/web/app/api/v1/*`, `apps/web/workers/*`, and `docs/modules/search-chat-canvas.md`. |
| P3.2 | Done | Refresh UI component docs. | Canvas, feed cards, modals, settings, mobile, and extension surfaces match current implementation. |
| P3.3 | Done | Refresh deployment docs. | Deployment docs cover monorepo scripts, app-scoped builds, migrations, workers, operator scripts, Docker path, and storage volumes. |
| P3.4 | Done | Add archive feature docs as tasks land. | Archive schema, API, capture flow, data flow, deployment, testing, and task-list docs reflect HTML/text, visual stubs/rendering, link health, retention cleanup, and video opt-in marker behavior. |
| P3.5 | Done | Add i18n plan. | `docs/plan/2026-07-07-i18n-plan.md` defines phased i18n tasks, pseudo-locale testing, and first-locale sequencing. |

## Milestone Order

1. Stability: P0.5-P0.7, P3.1, P3.2.
2. Archive durability: P1.1-P1.7, P3.4.
3. Reader and migration: P1.8-P1.16.
4. Search and sync: P1.17-P1.26.
5. Automation and operations: P1.27-P1.31, P2.2-P2.8.
6. Ecosystem: P2.9-P2.12.
7. Collaboration and i18n: P1.21, P3.5.

AGENT OWNER: docs/plan/
AGENT UPDATE: docs/overview.md
