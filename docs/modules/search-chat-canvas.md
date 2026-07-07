# Retrieval, Chat, and Canvas Module

> Scope: Hybrid search rendered inline in the Feed, streaming RAG chat, and the freeform infinite Canvas.
> Rendering context: Isomorphic
> Project tier: 4
> Last updated: 2026-07-07

## Overview
This module covers how users search an archive, ask questions of it, and arrange items visually. The current consumption surfaces are search-inside-Feed, the global ChatDock, and a freeform canvas at `/app/canvas`.

## Feature Architectures

### Hybrid Search In Feed
- Server logic: `apps/web/lib/search.ts` exports `runSearch`, `runHybridSearch`, `runExactSearch`, `runSemanticSearch`, and `makeSnippet`.
- API route: `apps/web/app/api/v1/search/route.ts` auth-checks, validates query length, and delegates to `runSearch`.
- Feed page: `apps/web/app/(app)/app/page.tsx` reads `searchParams.q`; when present it calls `runSearch(userId, q, "hybrid")` server-side and hydrates `FeedPageClient` with search results plus a `searchQuery` prop.
- Feed client: `apps/web/components/FeedPageClient.tsx` renders the search query pill and keeps type, source, folder, tag, and sort controls active over the result set.
- Reader filters: `FeedPageClient` also filters favorite, read-later, archived, reading/read/unread, and broken-link states from item response fields.
- App shell: `apps/web/components/AppShell.tsx` mounts the sticky capture header and global shell; the feed page owns query-result rendering.
- Modes: `hybrid` merges full-text and vector results, `fulltext` uses Postgres text matching with fallbacks, and `semantic` uses pgvector over `text-embedding-004` embeddings.
- Highlight matching: item search includes `item_highlights.quote` and `note` in full-text and fallback text matching.
- Saved searches: `/api/v1/search/saved` stores dynamic advanced-search queries without copying items.

### Reader, Highlights, and Link Review
- Reader API: `GET /api/v1/items/[id]/reader` returns archived extracted text first, then item text or summary fallback plus source metadata.
- State API: `PATCH /api/v1/items/[id]/state` updates progress, read state, favorite, archived, and read-later flags; item list/detail responses include these fields.
- Highlights API: `GET/POST/PATCH/DELETE /api/v1/items/[id]/highlights` manages quote/note highlights with optional ranges and item ownership enforcement.
- Link review API: `/api/v1/items/review/broken-links` lists broken URL items; `/api/v1/items/[id]/link-review` can retry/archive checks or mark false positives/resolved.
- Parser: `apps/web/lib/search-query.ts` supports `type:`, `tag:`, `folder:`, `source:`, `after:`, `before:`, `has:reminder`, `is:enriched`, `is:broken`, quoted phrases, and `and/or` groups.
- Pagination: exact, semantic, and hybrid modes return stable cursor payloads; Feed search load-more appends with client-side de-duping.
- Saved searches: `smart_saved_searches` plus `/api/v1/search/saved` let users persist dynamic advanced queries without copying items; `FeedPageClient` renders a smart-search rail and save/delete controls.

### Conversational Chat
- Route handler: `apps/web/app/api/v1/chat/route.ts`.
- Context extraction: receives the user message array, embeds the latest query, performs pgvector similarity over user-owned items, and retrieves relevant context items.
- Synthesis: compiles title, summary, and note contents of the top context items into a server-side prompt and calls Gemini to answer with citations.
- Streaming: textual chunks and final citation data are returned as a Server-Sent Event stream, with JSON fallback support.
- Client surface: `apps/web/components/ChatDock.tsx` is a floating panel mounted by `AppShell`. It keeps local message history, streams response text, renders citation chips, and posts to `/api/v1/chat`.

### Visualization Canvas
- Page route: `apps/web/app/(app)/app/canvas/page.tsx`.
- Client wrapper: `apps/web/app/(app)/app/canvas/canvas-client.tsx` dynamically loads `KnowledgeMap` so canvas code only ships on the canvas route.
- Component: `apps/web/components/KnowledgeMap.tsx` uses `@xyflow/react` for pan, zoom, drag, background, and viewport helpers. Item nodes are custom; no edges, minimap, in-canvas search, type filters, or side options panel are rendered.
- Data gateway: `apps/web/app/api/v1/graph/route.ts` returns `{ nodes: CanvasItem[] }` for the canvas.
- Position model: persisted `canvas_x` / `canvas_y` wins. Items without saved coordinates fall into a deterministic 4-column grid until the user drags them.
- New-item placement: `ARCHIVE_ITEM_CREATED_EVENT` persists new item coordinates at the current viewport center, so captures from web, PWA, Telegram, extension, or mobile appear where the user is looking.
- Floating dock: bottom-right Capture, Fit-to-viewport, and Refresh controls appear when the canvas has items. The empty state owns first-run capture.

## Security Constraints
- AGENT AVOID: Never query items globally in search or chat. Every SQL statement, including vector queries, must filter by the authenticated user ID.
- AGENT NOTE: Canvas position updates (`canvas_x` / `canvas_y` / `canvas_pinned`) flow through `PATCH /api/v1/items/[id]`, which must verify the item's `user_id` matches the requester.

## Update Triggers
- When search matching thresholds, weights, merge order, or pagination behavior change in `apps/web/lib/search.ts`.
- When reader-state filters, highlight search behavior, or broken-link review workflows change.
- When advanced search grammar or saved-search API behavior changes.
- When prompt templates, context thresholds, streaming schemas, or ChatDock citation behavior change.
- When canvas position fallback, viewport-center placement, node rendering, or floating dock behavior changes in `apps/web/components/KnowledgeMap.tsx`.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) - Connects retrieval engines.
- [docs/architecture/data-flow.md](file:///e:/Projects/recallQ/docs/architecture/data-flow.md) - Details the data flows.
- [docs/modules/capture.md](file:///e:/Projects/recallQ/docs/modules/capture.md) - Ingestion flow details.

AGENT OWNER: apps/web/components/KnowledgeMap.tsx
AGENT UPDATE: docs/modules/search-chat-canvas.md
