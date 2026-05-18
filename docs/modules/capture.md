# Ingestion and Capture Module

> Scope: Documents multi-surface captures, URL scraping, file parsing, structural action extractions, and the asynchronous enrichment pipeline.
> Rendering context: Isomorphic
> Project tier: 4
> Last updated: 2026-05-17

## Overview
The Ingestion and Capture module is Recall's primary write entry point. It is engineered to capture notes, links, and documents instantly and non-blockingly from multiple sources. It processes inline tagging commands, routes items to collection folders, schedules email/Telegram notifications, and queues items for deep AI processing inside background workers.

## Ingestion Architecture

### Capture Gateways
- Web Interface: The CaptureBar and CreateItemDialog components present instant drag-and-drop file areas and pastable text inputs to users. They perform optimistic UI feeds.
- REST Ingestion API: Handled in app/api/ingest/route.ts. Acts as the primary target gateway for third-party platforms and web extensions.
- Email Ingestion: Handled in app/api/email/route.ts. Parses inbound emails on behalf of matching users.
- Telegram Bot Webhook: Served by app/api/telegram/route.ts. Captures URL shares and text messages directly from Telegram chats.
- PWA Share Target: Renders app/(app)/app/share-target/page.tsx, utilizing web app manifests to capture platform shares.

### Processing Mechanics (lib/ingest.ts)
Upon payload submission to ingestItem:
- Limits Audit: Compares saves_this_month counts against users plan configurations inside lib/plan-limits.ts.
- File Verification: Compares file sizes and MIME formats using helpers inside lib/storage.ts.
- Action Synthesis: Invokes parseActions inside lib/comment-actions.ts. Identifies tags, folder moves, and reminders from the capture text. It combines regex lookups with a Gemini AI call to return structured JSON actions containing tags, categories, and reminders.
- Storage Write: Saves the file buffer locally under user and item directories inside lib/storage.ts.
- DB Insertion: Upserts collection directories if required. Inserts the item with enriched set to false, schedules active reminders inside the reminders table, and increments saves_this_month.
- Return: Returns an optimistic success response with a pending status to avoid client-side response delays.

### Post-Capture Enrichment (workers/enrichment-worker.ts)
The enrichment worker daemon polls PostgreSQL for unenriched records and finishes the ingestion lifecycle:
- Extracting Body: Scrapes web links via cheerio or parses local file buffers using mammoth (Word), pdf-parse (PDF), or xlsx (spreadsheets).
- Metadata Generation: Feeds the body text and capture notes to the Gemini generative model. Receives a structured JSON payload containing refined titles, summaries, and tags.
- Embeddings Calculations: Throttles Gemini embedding requests using text-embedding-004. Saves the resulting 768-dimensional vector to PostgreSQL.
- Sibling Mapping: Computes cosine vector distances. Inserts similar pairs with thresholds > 0.75 as ai_similar in item_relations. Maps domain overlaps for web URLs.

## Security Constraints
- AGENT AVOID: Never trigger heavy file parsing or Gemini embedding generation inside the web request lifecycle. These operations must strictly be offloaded to the background worker.
- AGENT NOTE: Always sanitise file names before saving them to disk inside lib/storage.ts to prevent directory traversal exploits.

## Update Triggers
- When the capture payload interface or ingestion helpers in lib/ingest.ts change.
- When new command formats or tag extraction schemas are added to lib/comment-actions.ts.
- When document text extraction libraries or scrapers in the background worker change.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Connects tech stack.
- [docs/architecture/data-flow.md](file:///e:/Projects/recallQ/docs/architecture/data-flow.md) — Details the data flows.
- [docs/modules/search-chat-graph.md](file:///e:/Projects/recallQ/docs/modules/search-chat-graph.md) — Details the retrieval.

AGENT OWNER: lib/ingest.ts
AGENT UPDATE: docs/modules/capture.md
