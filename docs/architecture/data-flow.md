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
- Response: The caller receives an item ID and pending enrichment status immediately after commit.

### AI Enrichment Pipeline
- Detection: `apps/web/workers/enrichment-worker.ts` polls for `items.enriched = false`; migration 018 adds a partial index for this pending scan.
- URL extraction: User-supplied URLs are fetched through `safeFetch`, which blocks unsafe protocols, localhost/private/link-local/reserved IP ranges, and unsafe redirects.
- File extraction: The worker extracts text from local PDF, DOCX, spreadsheet, and text files.
- AI processing: Gemini produces a title, summary, tags, and optional reminder hints from sanitized content.
- Vector generation: Gemini `text-embedding-004` generates 768-dimensional vectors saved in PostgreSQL/pgvector.
- Relation mapping: The worker computes vector similarity and same-domain relations for the user's archive.

### Search and RAG Retrieval
- Hybrid search: `apps/web/lib/search.ts` merges PostgreSQL full-text results with pgvector semantic results, always scoped by authenticated user ID.
- RAG chat: `apps/web/app/api/v1/chat/route.ts` embeds the latest query, retrieves relevant user-owned items, and streams a Gemini answer with citations.
- Canvas: `apps/web/app/api/v1/graph/route.ts` returns user-owned nodes for the freeform canvas.

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
