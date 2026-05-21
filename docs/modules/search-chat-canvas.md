# Retrieval, Chat, and Canvas Module

> Scope: Hybrid search (rendered inline in the Feed), streaming RAG chat, and the freeform infinite Canvas.
> Rendering context: Isomorphic
> Project tier: 4
> Last updated: 2026-05-22

## Overview
This module covers how users get value out of an existing archive: searching it, asking questions of it, and arranging it visually. As of Stage 3 of [PLAN.md](file:///e:/Projects/recallQ/PLAN.md) the consumption surface is three things — search-inside-Feed, chat, and a freeform canvas. The separate `/app/search` route and the force-directed `/app/graph` view were removed; Canvas is now the only visualization and lives at `/app/canvas`.

## Feature Architectures

### Hybrid Search (rendered inline in Feed)
- Server logic: `apps/web/lib/search.ts` exports `runSearch`, `runHybridSearch`, `runExactSearch`, `runSemanticSearch`, and `makeSnippet`.
- API route: `apps/web/app/api/v1/search/route.ts` is a thin wrapper that auth-checks, validates query length (max 500 chars), and delegates to `runSearch`.
- Feed page: `apps/web/app/(app)/app/page.tsx` reads `searchParams.q`; when present it calls `runSearch(userId, q, "hybrid")` server-side and hydrates `FeedPageClient` with the search results plus a `searchQuery` prop instead of the default reverse-chrono items.
- Feed client: `apps/web/components/FeedPageClient.tsx` shows a "Search results / 'q' [X]" pill at the top in search mode. The X navigates to `/app` (no `q`) which exits search mode. All existing filters/sort/preset chips still apply on top of search results.
- AppShell input: `apps/web/components/AppShell.tsx` reads `?q=` via `useSearchParams` so the input always reflects the current URL state. Submitting navigates to `/app?q=…` (or `/app` if empty).
- Modes:
  - `hybrid` (default): merges full-text + vector results, de-duped, exact matches first.
  - `fulltext`: Postgres `tsvector` / `websearch_to_tsquery`; falls back to ILIKE on tag/title/summary/raw_text if `tsvector` isn't present.
  - `semantic`: pgvector cosine similarity over `text-embedding-004` vectors; gracefully no-ops if pgvector is missing or the Gemini call fails.
- Limits: 20 results per mode. The Feed disables its load-more button in search mode (no pagination yet — Stage 5+ consideration if needed).

### Conversational Chat (RAG Engine)
- Route handler: `apps/web/app/api/v1/chat/route.ts`.
- Context extraction: receives the user message array, embeds the latest query, performs pgvector similarity over the user's items, retrieves items above 0.68 similarity.
- Synthesis: compiles title + summary + note contents of the top 10 items into a system prompt; calls Gemini to answer using only those blocks.
- Streaming: textual chunks followed by citation JSON returned as a Server-Sent Event stream.
- Client drill-in: chat page parses citation blocks into clickable references that open `ItemDetailModal`.
- Layout: chat route uses the global app header; renders a two-pane workspace with thread rail, conversation surface, citation chips, and composer.

### Visualization Canvas (Infinite Freeform Board)
- Page route: `apps/web/app/(app)/app/canvas/page.tsx`.
- Component: `apps/web/components/KnowledgeMap.tsx` (rewritten in Stage 3, ~330 lines, down from ~510). Uses `@xyflow/react` for pan/zoom/drag plumbing only; everything else is custom.
- Data gateway: `apps/web/app/api/v1/graph/route.ts` returns `{ nodes: CanvasItem[] }` — same payload as before, kept for compatibility. (The `relations` payload it can return is no longer rendered now that the Graph view is gone.)
- Position model: persisted `canvas_x` / `canvas_y` wins. Items without saved coordinates fall into a deterministic 4-column grid by their order in the items array — stable across reloads. As soon as the user drags an item, the new position is `PATCH`ed and the grid fallback no longer applies to it.
- New-item placement: a listener on `ARCHIVE_ITEM_CREATED_EVENT` computes the current viewport center (using `useReactFlow().getViewport()`) and immediately persists those coordinates against the new item — so links captured from PWA / Telegram / extension / mobile land where the user is currently looking on the canvas.
- Floating dock (bottom-right): Capture button (`openCreateDialog`), Fit-to-viewport (`fitView`), Refresh. Visible only when there are items so the empty state owns the screen on first load.
- Stage 6 bundle audit: `react-force-graph-2d` and its 24 transitive deps were removed from `apps/web/package.json`. `@xyflow/react` is now lazy-loaded via `next/dynamic` from `apps/web/app/(app)/app/canvas/canvas-client.tsx` (a thin "use client" wrapper around the server-side `page.tsx`), so its ~70KB JS + CSS bundle is only fetched when the user actually opens `/app/canvas` — Feed, Chat, Settings, and auth pages no longer pay the cost.

## Security Constraints
- AGENT AVOID: Never query items globally in search or chat. Every SQL statement, including vector queries, must filter by the authenticated user ID. The shared helpers in `apps/web/lib/search.ts` already do this; do not introduce alternates.
- AGENT NOTE: Canvas position updates (`canvas_x` / `canvas_y` / `canvas_pinned`) flow through `PATCH /api/v1/items/[id]` which must verify the item's user_id matches the requester. Do not add a "set position" RPC that bypasses ownership checks.

## Update Triggers
- When the search matching threshold, weights, or merge order are modified in `apps/web/lib/search.ts`.
- When changing prompt templates, context thresholds, or streaming schemas in the RAG chat engine.
- When the canvas's position-fallback strategy, viewport-center logic, or floating dock changes in `apps/web/components/KnowledgeMap.tsx`.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Connects retrieval engines.
- [docs/architecture/data-flow.md](file:///e:/Projects/recallQ/docs/architecture/data-flow.md) — Details the data flows.
- [docs/modules/capture.md](file:///e:/Projects/recallQ/docs/modules/capture.md) — Ingestion flow details.

AGENT OWNER: apps/web/components/KnowledgeMap.tsx
AGENT UPDATE: docs/modules/search-chat-canvas.md
