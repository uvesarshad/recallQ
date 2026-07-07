# Application Data Flow

> Scope: End-to-end data pipelines: capture ingestion, AI background enrichment, vector relationship building, and RAG chat retrieval.
> Rendering context: Isomorphic
> Project tier: 4
> Last updated: 2026-07-07

## Overview
Recall uses a unidirectional data architecture: immediate validated writes during capture, asynchronous enrichment in workers, and hybrid exact-semantic retrieval during search and chat.

## Data Lifecycles

### Capture and Ingestion Lifecycle
- Trigger: A user captures content through the web app, REST API, Chrome extension, Expo mobile app, Telegram, email, or PWA share target.
- Authentication: `apps/web/lib/request-auth.ts` resolves a web session, bearer token, or internal ingest token depending on the caller.
- Validation: `apps/web/lib/validation.ts` validates type, source, URL/text/file metadata, folder, and action overrides.
- Action extraction: `apps/web/lib/comment-actions.ts` infers tags, target folder name, and reminders without creating folders during the pre-transaction phase.
- File storage: Accepted files are saved under the configured local file storage path. If the following DB transaction fails, the file is removed.
- Transactional save: `ingestItem` locks the user row, checks save/storage/reminder caps, resolves or validates the folder, inserts the item, updates usage counters, and inserts the reminder in one transaction.
- Automation: enabled rules can run before/after writes for capture, import, and RSS events to skip matching inputs, add tags, move folders, set reminders, or request page archival.
- Response: The caller receives an item ID and pending enrichment status immediately after commit.

### Durable Archive and RSS Lifecycle
- Page archive: URL captures can opt into archival at capture time or through `POST /api/v1/items/[id]/archive`. The request queues an `archive` job, updates item archive status, stores sanitized HTML plus extracted text, and can request screenshot/PDF/video asset kinds. Screenshot/PDF rendering is optional and SSRF-guarded when Playwright is installed; unsupported visual/video requests become failed asset rows rather than hidden no-ops.
- Archive cleanup: `apps/web/workers/job-worker.ts` runs periodic retention sweeps, and `pnpm admin:jobs -- archive-retention --apply` provides a dry-run-first operator cleanup path. Both remove stored files, delete asset rows, and decrement storage accounting.
- Link health: archive fetch attempts update `items.link_last_checked_at`, `link_http_status`, `link_broken`, and failure reason for review filters.
- RSS: users create `rss_feeds`; `apps/web/workers/job-worker.ts` enqueues due feeds, fetches them through `safeFetch`, inserts `rss_feed_entries` idempotently, and ingests new entries with source `rss`.

### AI Enrichment Pipeline
- Detection: `apps/web/workers/enrichment-worker.ts` claims work through `apps/web/lib/enrichment-claim.ts`; migrations 018 and 020 add pending-scan and claim/status indexes.
- Claiming: the worker uses `FOR UPDATE SKIP LOCKED`, retry backoff, stale-lock reclaim, and terminal failure after max attempts.
- URL extraction: User-supplied URLs are fetched through `safeFetch`, which blocks unsafe protocols, localhost/private/link-local/reserved IP ranges, and unsafe redirects.
- File extraction: The worker extracts text from local PDF, DOCX, spreadsheet, and text files.
- AI processing: Gemini produces a title, summary, tags, and optional reminder hints from sanitized content.
- Vector generation: Gemini `text-embedding-004` generates 768-dimensional vectors saved in PostgreSQL/pgvector.
- Relation mapping: The worker computes vector similarity and same-domain relations for the user's archive. Same-domain lookup uses stored `items.url_host` instead of parsing `raw_url` in the query path.
- Observability: enrichment crawl, generation, embedding, relation, and generic job runs write best-effort rows to `operation_logs` with duration, attempts, provider/model, token estimates, crawl bytes, and failure reason.

### Search and RAG Retrieval
- Hybrid search: `apps/web/lib/search.ts` merges PostgreSQL full-text results with pgvector semantic results, always scoped by authenticated user ID.
- Advanced search: `apps/web/lib/search-query.ts` parses field filters, quoted phrases, boolean groups, and stable cursor pagination for exact, semantic, and hybrid modes.
- Query embedding cache: repeated normalized semantic search and chat queries reuse rows in `query_embedding_cache` before calling Gemini.
- RAG chat: `apps/web/app/api/v1/chat/route.ts` embeds the latest query, retrieves relevant user-owned items, and streams a Gemini answer with citations.
- Canvas: `apps/web/app/api/v1/graph/route.ts` returns user-owned nodes for the freeform canvas.

### Local-First Delta Sync
- Upserts: extension/mobile clients pull `GET /api/v1/items?since=<cursor>` with bearer auth and receive changed items ordered by sync timestamp.
- Deletes: single and batch deletes insert rows into `item_tombstones`; unfiltered delta pulls include `deletedItems` so clients can remove local copies.
- Edits: bearer `PATCH /api/v1/items/[id]` lets non-web clients push title, tags, note, collection, reminder, and canvas metadata without duplicating ingest rows.
- Conflict policy: server timestamp last-write-wins. Accepted edits are stamped with database `updated_at`; clean clients apply newer pull rows, while dirty extension rows defer remote overwrite until their local edit is pushed.
- Archive state: extension and mobile consume `archive_status`, archive attempt metadata, and link-health fields from item list/detail payloads; mobile can request a URL archive through `POST /api/v1/items/[id]/archive`.

## Security Constraints
- AGENT AVOID: Never trigger database modifications or vector generation from GET requests.
- AGENT NOTE: Raw content and scrapers must be sanitized before sending content to Gemini.
- AGENT NOTE: Every search, chat, graph, and vector query must filter by authenticated user ID.

## Update Triggers
- When ingestion payload schemas or transaction boundaries change.
- When enrichment fetch policy, prompts, embedding model, or relation scoring changes.
- When retrieval thresholds, search merge behavior, or chat streaming schemas change.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) - Architectural overview.
- [docs/modules/capture.md](file:///e:/Projects/recallQ/docs/modules/capture.md) - Capture engine logic.
- [docs/modules/search-chat-canvas.md](file:///e:/Projects/recallQ/docs/modules/search-chat-canvas.md) - Search and retrieval views.

AGENT OWNER: apps/web/lib/ingest.ts
AGENT UPDATE: docs/architecture/data-flow.md
