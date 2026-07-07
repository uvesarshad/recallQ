# Karakeep Comparison and RecallQ Gap Audit

> Date: 2026-07-07
> Scope: Product, architecture, feature, performance, security, ecosystem, and documentation gaps.
> Baseline: RecallQ local workspace plus Karakeep cloned from https://github.com/karakeep-app/karakeep into `tmp/karakeep`.
> Karakeep commit audited: `4af8bb2fd15beff338a791b7a8e0bbf9b72814d6` (`2026-07-06`, `revert: remove --headless=new flag from default chrome docker compose (#2936)`).

## Executive summary

Karakeep is much more mature as a self-hosted bookmark and durable web archive product. It has a broader ecosystem, stronger import/export paths, collaboration, RSS ingestion, rule automation, reader/highlight workflows, archival workers, OCR, video archival, rich search syntax, public lists, API keys, SDK/OpenAPI/MCP/CLI surfaces, Docker/Kubernetes packaging, and much deeper automated tests.

RecallQ is not just a weaker Karakeep clone. Its strongest differentiation is "personal recall": fast multi-surface capture, reminders, semantic search, RAG chat with citations, freeform canvas placement, mobile push reminders, and a local-first browser tab offload model where free users can save unlimited tabs on-device. That positioning is useful, but RecallQ has clear gaps if it wants to compete with mature read-it-later/bookmark managers.

The biggest recommended direction is not to copy all of Karakeep. First close the trust and durability gaps: robust link archiving, import/export, OCR/highlights/reader state, RSS/webhooks/rules, better search filters, queue robustness, SSRF hardening, and deployment packaging.

## Evidence reviewed

- RecallQ docs: `docs/overview.md`, capture/search/extension/billing modules, API/database/deployment/testing/security/performance audits.
- RecallQ code: `apps/web/lib/ingest.ts`, `apps/web/lib/search.ts`, workers, API routes, package manifests, extension/mobile sources.
- Karakeep code: root/app/package manifests, `README.md`, `packages/db/schema.ts`, `packages/trpc/routers/*`, workers, Docker compose, browser/mobile/MCP apps.

## Product positioning

| Area | Karakeep | RecallQ | Audit read |
|---|---|---|---|
| Core job | Self-hosted bookmark/read-it-later/archive manager | AI personal knowledge capture and recall | Different enough to keep RecallQ focused. |
| Durability | Full-page archives, screenshots/PDFs, video archival, assets table | Stores raw URL/text/file plus preview metadata | RecallQ should add durable archive modes. |
| AI | Auto tagging/summarization, custom prompts, Ollama/local model support, embeddings plumbing | Gemini summaries/tags/embeddings, RAG chat, action inference | RecallQ is stronger on conversational recall. |
| Search | Meilisearch, rich query parser, filters, smart lists | Postgres FTS + pgvector semantic search | RecallQ needs power-user query/filter layer. |
| Organization | Lists, nested lists, smart lists, public lists, collaborative lists, tags | Collections/folders, tags, relations, canvas | RecallQ lacks collaboration/public sharing. |
| Automation | Rule engine, RSS feeds, webhooks, import worker | Action extraction from capture text, reminders | RecallQ needs rule/RSS/webhook automation. |
| Clients | Web, mobile, browser extension, CLI, MCP, SDK/OpenAPI | Web, Chrome extension, mobile scaffold, typed REST client | RecallQ should add CLI/MCP/OpenAPI if AI-agent friendliness matters. |
| Deployment | Docker compose, Docker images, Kubernetes/Helm, data volume defaults | CloudPanel/systemd oriented docs | RecallQ needs self-host packaging. |
| Tests | Vitest suites across routers, shared parsers, workers | Lightweight web tests only | RecallQ test depth is thin for Tier 4. |

## Where Karakeep is ahead

1. Durable archiving:
   Karakeep stores multiple asset types including screenshots, HTML content, full-page archives, PDFs, uploaded files, backups, and video downloads. RecallQ currently enriches a link with simple metadata and text extraction but does not preserve the page against link rot.

2. Ingestion breadth:
   Karakeep supports RSS feeds and import sessions from services such as Pocket, Omnivore, Linkwarden, and browser-style exports. RecallQ has strong live capture channels, but lacks migration/import paths for existing user archives.

3. Reader workflow:
   Karakeep has highlights, reading progress, reader settings, broken-link reporting, favorite/archive states, and asset-aware bookmark views. RecallQ item detail is more edit/review oriented and does not yet provide a read-it-later experience.

4. Automation:
   Karakeep has a rule engine with events, nested conditions, and actions such as adding/removing tags, adding/removing lists, archiving, favoriting, and full-page archive download. RecallQ has AI action extraction at capture time, but no persistent user-configured automation.

5. Ecosystem:
   Karakeep ships or tracks browser extension, mobile, CLI, MCP server, SDK/OpenAPI package, and agentic skills. RecallQ has extension/mobile foundations and an API client, but no CLI, MCP, OpenAPI generation, or official agent tools.

6. Operational maturity:
   Karakeep separates queue-backed workers by concern: crawler, low-priority crawler, embeddings, inference, search indexing, feed, import, webhooks, backups, asset preprocessing, video, rule engine, and admin maintenance. RecallQ uses two polling workers, which is simpler but less scalable and less observable.

## Where RecallQ is ahead or differentiated

1. RAG chat is a first-class product surface. Karakeep focuses on bookmark management and AI enrichment; RecallQ exposes conversational retrieval with citations.

2. Canvas is a differentiated recall surface. Karakeep has lists and grids; RecallQ has spatial organization and persisted freeform positions.

3. Reminder workflows are deeper. RecallQ supports reminder records and email/Telegram/web/mobile push fan-out. Karakeep's core flow is archive management, not action reminders.

4. Local-first tab offload is distinctive. RecallQ's extension saves unlimited tabs locally, works signed out/offline, and makes cloud sync the paid layer. Karakeep's extension appears more aligned with bookmark capture and page archival.

5. PostgreSQL + pgvector keeps semantic retrieval in the primary database. Karakeep uses Meilisearch and pluggable vector/search infrastructure. RecallQ's approach is simpler to operate for a smaller SaaS, though it needs better queue/index discipline.

## Priority gaps and recommendations

### P0 - correctness and security

1. Add SSRF protection before any server-side URL fetch.
   `enrichment-worker.ts` fetches user-supplied URLs and `computeBlurDataUrl` fetches remote images. Add URL normalization plus DNS/IP blocking for localhost, RFC1918, link-local, metadata IPs, non-http protocols, redirects to private hosts, and oversized responses.

2. Make ingest writes transactional.
   `ingestItem` increments `saves_this_month` before action inference, file save, item insert, storage accounting, and reminder insert finish. A later failure can burn quota without an item. Move quota increment, item insert, storage update, collection/reminder writes, and rollback behavior into one DB transaction, with file cleanup on failed insert.

3. Make storage limit enforcement atomic.
   Current storage check reads `storage_used_bytes`, then updates later. Concurrent uploads can exceed quota. Use a guarded `UPDATE users SET storage_used_bytes = storage_used_bytes + $delta WHERE ... <= max` or an explicit transaction lock.

4. Replace `Infinity` plan caps with explicit unbounded branches.
   Pro/self-host limits pass `Infinity` through code paths that may become SQL parameters or counters. Use `null`/`undefined` for unlimited and branch explicitly.

5. Add idempotent worker claiming.
   The enrichment worker selects `WHERE enriched = false LIMIT 5` without `FOR UPDATE SKIP LOCKED`, status states, or attempt counters. Multiple workers can duplicate work, and permanently failing items can retry forever. Add `enrichment_status`, `locked_at`, `attempt_count`, `last_error`, and partial indexes.

### P1 - product parity that matters

1. Durable link archive mode:
   Add archived HTML/screenshot/PDF asset records for links. Start with opt-in "archive this page" and later support rules or per-plan defaults. This is the biggest trust gap versus Karakeep.

2. Import/export:
   Add import sessions for browser bookmarks, Pocket, Omnivore, Linkwarden, and generic CSV/HTML. Add export to JSON and Netscape bookmarks HTML. This directly reduces switching friction.

3. Advanced search language:
   Keep semantic search, but add structured filters: `type:`, `tag:`, `folder:`, `source:`, `after:`, `before:`, `has:reminder`, `is:enriched`, `is:broken`, boolean `and/or`, and quoted phrases. Karakeep's parser is a good reference.

4. Reader/highlights/progress:
   Add reader mode for enriched article text, highlight records, reading progress, favorite/archive states, and broken-link status. These strengthen read-it-later use cases without weakening RecallQ's AI positioning.

5. Rules and RSS:
   Add user automation after durable archive basics: RSS feed capture, rule events, conditions, and actions. Minimum useful rule set: on capture, if URL/title/source/tag matches, add tags/folder, set reminder, archive page, or skip.

6. Sync tombstones and edit propagation:
   Extension docs already note server-to-local deletes and synced-item edits are deferred. Add server tombstones/deleted_at and a real update push path so two-way sync is not lossy.

### P2 - performance and operations

1. Move from polling-only workers to a queue or claim table.
   A lightweight Postgres-backed job table is enough. Separate job types for crawl, parse, summarize, embed, relation build, reminder, import, and webhooks. This improves retries, concurrency, backpressure, and observability.

2. Add the partial enrichment index now.
   `CREATE INDEX ... ON items (created_at) WHERE enriched = false` is already documented as deferred. Add it before large imports/backfills.

3. Store normalized URL host.
   Same-domain relation building uses a `split_part(...)` expression over `raw_url`; store `url_host` during ingest/enrichment and index `(user_id, url_host)`.

4. Add query embedding cache.
   Semantic search embeds every query. Cache normalized query embeddings per user or globally with short retention to reduce Gemini latency/cost on repeated searches.

5. Add search pagination.
   `runSearch` returns fixed 20-result sets per mode. Feed search disables load-more. Add cursoring for exact and semantic paths or make search API return stable merged cursors.

6. Add observability tables/logs for AI and crawl cost.
   Track per-item crawl status, AI token/cost estimates, retries, failure reason, and last attempted time. Karakeep's separated status fields are a useful pattern.

### P3 - ecosystem and go-to-market

1. Docker compose for self-hosters:
   Ship a working compose file with web, workers, Postgres + pgvector, persistent file storage, and documented env. CloudPanel docs can stay, but Docker is table stakes for this category.

2. OpenAPI and MCP:
   Generate OpenAPI from `@recall/api-schema`, add an MCP server for search/read/create/update/delete, and add a small CLI. This plays to RecallQ's AI-agent-friendly positioning.

3. Collaboration and public sharing:
   Add shared folders/canvases after core archive durability. Karakeep's collaborative/public lists are useful, but they are not the first gap RecallQ should close.

4. Internationalization:
   Karakeep has a translation workflow. RecallQ currently appears English-only. Add i18n only after product shape stabilizes unless there is an immediate market requirement.

## Documentation gaps found during the audit

- Several docs still reference old paths such as `app/api/ingest/route.ts`, `workers/enrichment-worker.ts`, and `docs/modules/search-chat-graph.md`; current code lives under `apps/web/...` and `docs/modules/search-chat-canvas.md`.
- `docs/ui/component-library.md` still describes the old force-graph/ReactFlow graph implementation even though `react-force-graph-2d` was removed and Canvas is now the only visualization.
- `docs/infra/deployment.md` still describes root-level Next execution and migrations only up to early migration numbers, while the repo is now Turborepo with app-scoped scripts and 17 migrations.
- `docs/api/route-handlers.md` mixes `/api/v1/...` paths with stale `api/...` shorthand and has some route names that do not match the current code layout exactly.

## Recommended roadmap

1. Stability sprint:
   SSRF guard, transactional ingest, storage atomicity, worker claim/status, partial enrichment index, pro/self-host unlimited branch tests.

2. Archive durability sprint:
   Asset table or first-class archive fields, full-page HTML/screenshot/PDF capture, link health status, reader text preservation.

3. Migration and search sprint:
   Import/export sessions, advanced query parser, search pagination, normalized host column, query embedding cache.

4. Automation sprint:
   RSS feeds, rule engine, webhook subscriptions, MCP/CLI/OpenAPI.

5. Collaboration sprint:
   Shared folders/canvas/public read links only after the single-user archive is durable and importable.

## Do not copy blindly

Karakeep's breadth is useful, but RecallQ should not become a generic clone. Preserve these differentiators:

- RAG chat with citations.
- Canvas-based spatial recall.
- Reminder and notification workflow.
- Local-first tab offload in the extension.
- REST and shared Zod schemas for external clients.

The product gap is not "Karakeep has more features." The actionable gap is that RecallQ currently captures knowledge well but does not yet preserve, migrate, automate, inspect, and operate that archive at the maturity users expect from a serious bookmark/read-it-later system.
