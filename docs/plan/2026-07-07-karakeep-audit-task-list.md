# Karakeep Audit Task List

> Date: 2026-07-07
> Source report: `docs/plan/2026-07-07-karakeep-comparison-audit.md`
> Scope: Execution backlog generated from the Karakeep comparison audit.
> Status key: Done, Next, Planned, Later

## Guiding Direction

RecallQ should not clone Karakeep feature-for-feature. The backlog below closes the gaps that matter for trust, durability, migration, automation, and operations while preserving RecallQ's differentiators: RAG chat with citations, canvas recall, reminders, local-first tab offload, and shared REST/Zod clients.

## P0 - Correctness and Security

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P0.1 | Done | Add SSRF protection for server-side URL fetches. | `apps/web/lib/url-safety.ts` exists; enrichment URL scraping and blur image fetching use `safeFetch`; tests cover blocked protocols, private IPs, localhost, redirects, and safe public URLs. |
| P0.2 | Done | Make ingest writes transactional. | Item insert, save count, storage update, inferred folder creation, and reminder insert commit together; failed inserts roll back and remove any saved disk file. |
| P0.3 | Done | Make storage limit enforcement atomic. | User row is locked before quota checks; files are counted once; concurrent uploads cannot bypass plan storage caps. |
| P0.4 | Done | Replace `Infinity` plan caps with explicit unlimited branches. | Pro/self-host paths do not pass `Infinity` into SQL or counters; finite limits are checked in TypeScript before writes. |
| P0.5 | Next | Add idempotent enrichment worker claiming. | Migration adds `enrichment_status`, `enrichment_locked_at`, `enrichment_attempt_count`, `enrichment_last_error`; worker claims with `FOR UPDATE SKIP LOCKED`; failed jobs back off; permanently failing jobs stop hot-looping. |
| P0.6 | Next | Add worker-claim tests. | Tests cover duplicate-worker claim prevention, retry increment, terminal failure state, and successful transition to enriched. |
| P0.7 | Next | Add regression tests for unlimited plan branches. | Tests cover free, starter, pro, and self-hosted save/storage/reminder limits without SQL serialization of non-finite values. |

## P1 - Archive Durability

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P1.1 | Next | Design archive asset schema. | Migration adds durable asset records for HTML, screenshot, PDF, original upload, extracted text, and thumbnail metadata; docs define storage ownership and retention. |
| P1.2 | Next | Add opt-in "archive this page" flow. | Users can request durable capture for a URL from item detail and capture flows; job status is visible; failures are inspectable. |
| P1.3 | Planned | Capture archived HTML. | Worker stores sanitized HTML/text snapshot, response metadata, canonical URL, content hash, and fetch timestamp. |
| P1.4 | Planned | Capture screenshots/PDFs. | Worker can generate screenshot and/or PDF assets with size limits, timeout limits, and SSRF-safe navigation. |
| P1.5 | Planned | Add link health status. | Items track last checked time, HTTP status, broken-link state, and failure reason; feed/detail expose broken or stale links. |
| P1.6 | Planned | Add archive retention and cleanup rules. | Deleting an item removes owned assets; plan storage includes archive assets; cleanup is documented and tested. |
| P1.7 | Later | Add video archival support. | If adopted, video archival is isolated behind a job type, plan limit, and explicit opt-in due storage/cost risk. |

## P1 - Reader, Highlights, and Review

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P1.8 | Next | Add reader mode for enriched article text. | Item detail can render preserved readable text with stable typography, source metadata, and fallback to original URL. |
| P1.9 | Planned | Add highlights. | Users can create, edit, delete, and search highlights attached to an item and text range or quote. |
| P1.10 | Planned | Add reading progress and states. | Items support progress, favorite, archived/read-later state, and filters for those states. |
| P1.11 | Planned | Add broken-link review queue. | Users can filter broken links, retry checks, archive page content, or mark false positives. |

## P1 - Import, Export, and Migration

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P1.12 | Next | Add import session model. | Migration tracks import source, status, progress, errors, duplicate counts, and created item IDs. |
| P1.13 | Next | Import browser bookmarks HTML. | Users can upload Netscape bookmarks HTML; folders/tags map predictably; duplicates are reported. |
| P1.14 | Planned | Import Pocket, Omnivore, Linkwarden, and CSV. | Each importer has parser tests, dry-run preview, duplicate handling, and resumable session status. |
| P1.15 | Planned | Export JSON. | Users can export all items, tags, collections, reminders, highlights, and archive asset references in a documented schema. |
| P1.16 | Planned | Export Netscape bookmarks HTML. | URL collections and tags can be exported for browser/read-it-later migration. |

## P1 - Search and Organization

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P1.17 | Next | Add advanced search parser. | Supports `type:`, `tag:`, `folder:`, `source:`, `after:`, `before:`, `has:reminder`, `is:enriched`, `is:broken`, quoted phrases, and boolean `and/or`. |
| P1.18 | Next | Add search pagination. | Exact, semantic, and merged search return stable cursors; feed search can load more without duplicate rows. |
| P1.19 | Planned | Add normalized URL host. | Ingest/enrichment stores `url_host`; migration backfills existing links; `(user_id, url_host)` index replaces repeated SQL string extraction. |
| P1.20 | Planned | Add smart saved searches. | Users can save advanced queries as dynamic collections without copying items. |
| P1.21 | Later | Add shared/public collections. | Public read links and collaboration are added only after archive durability and import/export are stable. |

## P1 - Sync and Local-First Clients

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P1.22 | Next | Add server tombstones. | Delete propagation uses `deleted_at` or tombstone records; delta sync returns deletes to extension/mobile clients. |
| P1.23 | Next | Add edit propagation. | Extension/mobile can push edits to title, summary, tags, folder, reminder, and archive state with conflict handling. |
| P1.24 | Planned | Add sync conflict policy. | Last-write-wins or field-level merge is documented and consistently enforced across API client, extension, and mobile. |
| P1.25 | Planned | Finish Expo Go testing loop. | Mobile README includes LAN setup, auth, feed, capture, detail, offline queue, and known Expo Go limitations. |
| P1.26 | Planned | Prepare EAS/dev-build path. | Push notifications, universal links, share extension, icon/splash assets, and platform config are ready for device builds. |

## P1 - Automation

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P1.27 | Next | Add RSS feed capture. | Users can add RSS feeds; worker creates items idempotently; feed errors and last poll status are visible. |
| P1.28 | Next | Design rule engine schema. | Rules support event, conditions, actions, enabled flag, priority, last run, and audit logs. |
| P1.29 | Planned | Implement capture rules. | On capture/import/RSS, rules can add tags, move folder, set reminder, request archive, mark favorite/archive, or skip. |
| P1.30 | Planned | Add outbound webhooks. | Users can subscribe to item created/updated/deleted/enriched events with retry and signing. |
| P1.31 | Later | Add custom AI prompts. | User-defined enrichment prompts are gated by plan and have safe defaults, token budgets, and rollback behavior. |

## P2 - Performance and Operations

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P2.1 | Done | Add partial enrichment backlog index. | Migration 018 adds `idx_items_pending_enrichment` for `WHERE enriched = false`. |
| P2.2 | Next | Introduce a Postgres job table. | Job records cover crawl, parse, summarize, embed, relation build, reminder, import, webhook, and archive tasks with status, attempts, locks, and errors. |
| P2.3 | Planned | Split worker responsibilities by job type. | Workers claim jobs by type; high-cost archive/import work cannot starve reminders or core enrichment. |
| P2.4 | Planned | Add query embedding cache. | Repeated normalized queries reuse recent embeddings and reduce Gemini latency/cost. |
| P2.5 | Planned | Add AI/crawl cost observability. | Per-item logs include token estimates, provider, duration, retries, crawl bytes, and failure reason. |
| P2.6 | Planned | Add admin/backfill tooling. | Operators can retry failed jobs, re-enrich stale items, backfill hosts, and inspect queue depth safely. |
| P2.7 | Planned | Add Docker compose self-host package. | Compose runs web, workers, Postgres + pgvector, and file storage with documented env and volumes. |
| P2.8 | Later | Add Kubernetes/Helm package. | Only after Docker compose and worker job model are stable. |

## P2 - API, Agent, and Ecosystem

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P2.9 | Next | Generate OpenAPI from shared schemas. | OpenAPI covers auth tokens, items, ingest, search, chat, reminders, devices, payments, and errors. |
| P2.10 | Planned | Add MCP server. | MCP tools can search, read, create, update, delete, and chat over the user's archive with bearer auth. |
| P2.11 | Planned | Add CLI. | CLI supports login/token setup, capture URL/text/file, search, export, import status, and job retry/admin commands where appropriate. |
| P2.12 | Planned | Publish SDK/client docs. | `@recall/api-client` examples cover web extension, mobile, CLI, and third-party automation use cases. |

## P3 - Documentation and Product Fit

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P3.1 | Next | Clean stale docs paths. | Docs no longer reference old root `app/api/*`, root `workers/*`, or `search-chat-graph.md` paths. |
| P3.2 | Next | Refresh UI component docs. | Canvas, feed cards, modals, settings, mobile, and extension surfaces match current implementation. |
| P3.3 | Planned | Refresh deployment docs. | Deployment docs cover monorepo scripts, app-scoped builds, migrations 001-019+, workers, systemd, Docker path, and storage volumes. |
| P3.4 | Planned | Add archive feature docs as tasks land. | Database, data-flow, external-services, security, performance, and module docs update with each archive/import/search change. |
| P3.5 | Later | Add i18n plan. | Internationalization waits until core archive durability and migration flows stabilize unless market needs change. |

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
