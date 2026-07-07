# Ingestion and Capture Module

> Scope: Documents multi-surface captures, URL scraping, file parsing, structural action extraction, and the asynchronous enrichment pipeline.
> Rendering context: Isomorphic
> Project tier: 4
> Last updated: 2026-07-07

## Overview
The Ingestion and Capture module is Recall's primary write entry point. It captures notes, links, and documents instantly from multiple surfaces, then queues deep processing for background workers. It also parses inline tags, folder moves, and reminders from capture text.

## Ingestion Architecture

### Capture Gateways
- Web Interface: `CaptureBar` and `CreateItemDialog` perform optimistic capture from the app shell.
- REST Ingestion API: `apps/web/app/api/v1/ingest/route.ts` and `apps/web/app/api/v1/ingest/file/route.ts` serve web, extension, mobile, and internal capture callers.
- Email Ingestion: `apps/web/app/api/v1/email/inbound/route.ts` parses inbound emails for matching users.
- Telegram Bot Webhook: `apps/web/app/api/v1/telegram/webhook/route.ts` captures Telegram text and URL shares.
- PWA Share Target: `apps/web/app/(app)/app/share-target/route.ts` accepts platform shares.
- Mobile: `apps/mobile` uses bearer auth through the shared API client and sends captures with `source: "mobile"`.

### Processing Mechanics (`apps/web/lib/ingest.ts`)
- Validation: Zod validates capture payloads in `apps/web/lib/validation.ts`.
- Plan and storage limits: `ingestItem` locks the user row, checks finite save/storage/reminder caps, and never passes unlimited plan values into SQL comparisons.
- File verification: MIME and file-size checks happen before disk writes; file bytes are counted exactly once.
- Action synthesis: `inferCaptureActions` parses tags, folder names, and reminders with regex plus Gemini when intent signals are present.
- Transactional write: folder resolution, item insert, save counter, storage accounting, and reminder insert happen in one DB transaction. Failed DB work rolls back counters, and failed file ingests clean up the written file.
- Return: Returns an optimistic success response with `enrich_status: "pending"`.

### Post-Capture Enrichment (`apps/web/workers/enrichment-worker.ts`)
- URL extraction: User-supplied URLs are fetched through `safeFetch` in `apps/web/lib/url-safety.ts`, then parsed with Cheerio.
- File extraction: Local files are parsed with Mammoth (Word), pdf-parse (PDF), or SheetJS (spreadsheets).
- Metadata generation: Gemini generates title, summary, tags, and possible reminder metadata.
- Embeddings: `text-embedding-004` generates 768-dimensional vectors for search and relation building.
- Image placeholders: scraped image URLs are also fetched through `safeFetch`; `apps/web/lib/blur.ts` applies byte caps before Sharp decodes the image.

## Security Constraints
- AGENT AVOID: Never trigger heavy file parsing, scraping, or embedding generation inside the web request lifecycle.
- AGENT NOTE: Always sanitize file names before saving them to disk.
- AGENT NOTE: Never fetch user-supplied URLs or scraped image URLs without `safeFetch`.

## Update Triggers
- When capture payload schemas or ingestion helpers change.
- When command formats or action extraction behavior changes.
- When document extraction libraries, remote fetch policy, or enrichment worker behavior changes.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) - Connects tech stack.
- [docs/architecture/data-flow.md](file:///e:/Projects/recallQ/docs/architecture/data-flow.md) - Details the data flows.
- [docs/modules/search-chat-canvas.md](file:///e:/Projects/recallQ/docs/modules/search-chat-canvas.md) - Details retrieval.

AGENT OWNER: apps/web/lib/ingest.ts
AGENT UPDATE: docs/modules/capture.md
