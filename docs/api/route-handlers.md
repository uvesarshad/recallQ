# REST API Route Handlers

> Scope: Documents all backend REST API endpoints, method signatures, query/payload shapes, authentication guards, and response objects.
> Rendering context: Server-side
> Project tier: 4
> Last updated: 2026-05-17

## Overview
Recall exposes a robust REST API under the app/api/ directory to handle items capture, search, AI chat, graph indexing, profile editing, and webhook handlers. All endpoints enforce strict session validation via NextAuth or secure API tokens, and output standard JSON payloads.

## REST Route Directory

### Ingestion and Capture Endpoints

- api/ingest [POST]: Gateway for manual captures and extension saves. Accepts a JSON body containing type (url, text, file, note), source, raw text or URL, optional files, and overrides. Authenticates via session or x-internal-ingest-token. Returns an ingestion success object with item ID and a pending enrichment status.
- api/files [POST]: Multipart file capture handler. Validates file MIME types and size limits against user tiers. Saves the file buffer locally and returns the item record.
- api/actions/preview [POST]: Receives draft capture notes. Generates real-time predictions of tags, target folders, and reminders from the text body using Gemini models. Returns predicted properties and extraction confidence.

### Archive Items Endpoints

- api/items [GET]: Queries the user's item list. Accepts query parameters: q (fuzzy keywords search), tag, collection (folder UUID), type, cursor (for pagination), and limit (max 50). Returns items list, nextCursor value, and a boolean indicating if more items exist.
- api/items [POST]: Creates a manual archive item, calling the ingestion engine.
- api/items/[id] [GET]: Fetches metadata for a single item by UUID. Returns the full item object.
- api/items/[id] [PATCH]: Updates item parameters (title, summary, tags, folder, reminders, or canvas positioning coordinates). Evaluates comment actions if note updates contain commands. Returns the updated item.
- api/items/[id] [DELETE]: Permanently deletes an item and cleans up associated files. Returns success.
- api/items/batch [POST]: Processes bulk operations. Accepts a JSON list of item IDs and action strings (archive, delete, tag, move). Implements client-side delay for undo support. Returns success.

### Search and Retrieval Endpoints

- api/search [GET]: Specialized hybrid search endpoint. Performs SQL matches and optional vector cosine similarity queries to return top matches with relevance ranks. If vector support or embeddings are unavailable, hybrid mode falls back to exact/basic SQL results with a successful response.
- api/chat [POST]: AI chat drawer endpoint. Accepts a list of messages. Embeds the last query, retrieves relevant context items, generates answers using Gemini, and streams chunks and citations back to the client drawer as a Server-Sent Event stream.
- api/graph [GET]: Generates map visuals. Accepts minimum connection thresholds and filter types. Queries items and their relationships from item_relations. Returns nodes list and edges list.

### Collections and Billing Endpoints

- api/collections [GET/POST/DELETE]: Lists folders, creates a folder (with custom color and icon), or deletes folders.
- api/payments/create-subscription [POST]: Creates a Razorpay subscription transaction for Starter or Pro plans. Updates the database and returns the Razorpay transaction payload.
- api/payments/cancel-subscription [POST]: Sets user subscription to cancel at the end of the active billing cycle.
- api/payments/webhook [POST]: Listens to payment completions from Razorpay, validates webhook signatures, and updates user limits.
- api/reminders [GET/PATCH]: Lists user reminders or updates due remind dates.

### Integration and User Webhooks

- api/telegram [POST]: Webhook endpoint that parses text/files from the Telegram bot, links Telegram IDs to user profile records, and replies via Telegram.
- api/email [POST]: Inbound email webhook parser. Receives email attachments and text, resolving matching users.
- api/me [GET] / api/user [PATCH]: Returns active profile details or patches name, bio, timezone, and consent options.

## Security Constraints
- AGENT AVOID: Never return raw SQL connection errors or stack traces to the client. Always catch API exceptions and return clean error responses.
- AGENT NOTE: All external webhooks (such as Razorpay, email, and Telegram) must validate inbound signatures to prevent request spoofing.

## Update Triggers
- When adding, renaming, or deleting an API route handler under app/api/.
- When altering the parameters or response shapes of an existing REST route.
- When changing request authentication guards or token headers.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Index of API directories.
- [docs/architecture/data-flow.md](file:///e:/Projects/recallQ/docs/architecture/data-flow.md) — Ingestion pipelines.
- [docs/modules/capture.md](file:///e:/Projects/recallQ/docs/modules/capture.md) — Capture routing details.

AGENT OWNER: app/api/
AGENT UPDATE: docs/api/route-handlers.md
