# Application Data Flow

> Scope: End-to-end data pipelines: Capture ingestion, AI background enrichment, vector relationship building, and RAG chat retrieval.
> Rendering context: Isomorphic
> Project tier: 4
> Last updated: 2026-05-17

## Overview
Recall features a strict, unidirectional data architecture designed to maintain an asynchronous, non-blocking ingestion engine. Operations are split into immediate, optimistic writes during capture, post-save asynchronous processing in background workers, and hybrid exact-semantic search pipelines during retrieval.

## Data Lifecycles

### Capture and Ingestion Lifecycle
- Ingestion Trigger: A user captures content through the CaptureBar component, a REST API post to api/ingest, an incoming webhook from Telegram (api/telegram) or email (api/email), or the PWA Share Target interface.
- Request Authentication: Handled in lib/request-auth.ts. Resolves either the active web session or validates incoming secret tokens (e.g. x-internal-ingest-token) for external capture channels.
- Limits Checking: Invokes canUserSave helper in lib/plan-limits.ts. Compares the user's plan type against their saves_this_month database counter to restrict or allow writes.
- Action Extraction: Invokes inferCaptureActions in lib/comment-actions.ts. Parses tags (hashtags), folder paths, and reminders from the capture text. If needed, it calls Gemini to predict structured JSON actions.
- File Storage: If a file is uploaded, the buffer is validated by file type and size. The local helper in lib/storage.ts saves the buffer inside the local filepath storage directory.
- Database Save: Inserts a new record into the items table with enriched set to false. If a reminder was resolved, a record is added to the reminders table. Returns an optimistic success response to the client.

### AI Enrichment Pipeline
- Daemon Detection: The background enrichment worker (workers/enrichment-worker.ts) polls PostgreSQL for records where enriched is false.
- Extraction Phase: For URL types, it scrapes raw HTML via cheerio. For file types, it extracts body text using mammoth (Word), pdf-parse (PDF), or xlsx (Excel spreadsheets).
- AI Processing: Packages the text, title hints, and capture notes into a system prompt. Calls the Gemini model, forcing JSON output with title, summary, tags, and implicit reminders.
- Vector Generation: Embeds the AI-generated title and summary using Gemini text-embedding-004. Saves the resulting 768-dimensional array into the items table, updating enriched to true.
- Relation Mapping: Computes cosine distances between the new item's vector and other vectors in the database. Inserts relations with strength > 0.75 as ai_similar in the item_relations table. Also creates same-domain domain relationships for URL items.

### Search and RAG Retrieval
- Hybrid Search: When querying the search endpoint or interactive map, the server performs exact SQL checks via ILIKE patterns (matching raw text, title, and summaries) and cosine similarity queries using pgvector.
- RAG Query: In the ChatDrawer component, user messages post to api/chat. The handler calls answerArchiveQuestion in lib/archive-chat.ts.
- Context Assembly: Embeds the user query, searches for matching items above a 0.68 cosine similarity threshold, maps their titles and content summaries into a context string, and prompts Gemini to answer the question using only the context.
- Streaming: Returns the response to the client via server-sent events, streaming textual chunks followed by citation records linked to the corresponding items.

## Security Constraints
- AGENT AVOID: Never trigger database modifications or vector generation within query GET requests. All writes must occur in POST/PATCH route handlers or async background workers.
- AGENT NOTE: All raw content and scrapers must be sanitized before passing them to the Gemini API to prevent prompt injections.

## Update Triggers
- When the ingestion payload schema or parameter types in lib/ingest.ts are modified.
- When the background enrichment prompt or embedding model is upgraded.
- When new steps are added to the vector cosine relationship scoring pipeline.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Architectural overview.
- [docs/modules/capture.md](file:///e:/Projects/recallQ/docs/modules/capture.md) — Capture engine logic.
- [docs/modules/search-chat-graph.md](file:///e:/Projects/recallQ/docs/modules/search-chat-graph.md) — Search and retrieval views.

AGENT OWNER: lib/ingest.ts
AGENT UPDATE: docs/architecture/data-flow.md
