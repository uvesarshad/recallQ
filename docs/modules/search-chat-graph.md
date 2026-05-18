# Retrieval, Chat, and Canvas Module

> Scope: Documents hybrid search algorithms, explainability scoring, streaming RAG chat pipelines, 2D network graphs, and interactive canvases.
> Rendering context: Isomorphic
> Project tier: 4
> Last updated: 2026-05-17

## Overview
The Retrieval, Chat, and Canvas module represents Recall's consumption core. It empowers users to extract value from their archives through three distinct interfaces: a hybrid search dashboard (combining exact keyword matching and semantic vectors), a conversational chat drawer (leveraging vector-driven RAG and citation drill-ins), and a visual relationship canvas (rendering interactive network clusters).

## Feature Architectures

### Hybrid Search and Explainability
- Route Handlers: Served by app/api/search/route.ts and app/api/items/route.ts.
- Keyword Matching: Performs traditional database checks utilizing standard SQL ILIKE queries on item titles, summaries, and raw text bodies. Matches tags using array overlap operators.
- Semantic Matching: Converts search queries into 768-dimensional vectors using text-embedding-004 and executes cosine similarity searches against items embeddings when vector support and Gemini credentials are available. Hybrid search still returns exact matches if semantic search is unavailable.
- Explainability Scoring: Handled inside lib/search-explain.ts. Examines exact keyword overlaps and cosine distances to generate human-readable relevance labels (such as Exact Text Match, Highly Relevant, or Related Idea) on cards to explain search matches.

### Conversational Chat (RAG Engine)
- Route Handler: Served by app/api/chat/route.ts.
- Context Extraction: Receives the user message array. Embeds the latest query and performs pgvector similarity checks on user items. Retrieves matching items scoring above a 0.68 similarity threshold.
- Synthesis: Compiles the title, summary, and note contents of the top 10 items into a system prompt. Calls Gemini to answer the question using only the context blocks.
- Text Streaming: Streams textual chunks followed by citation JSON datasets back to the client as a Server-Sent Event stream.
- Client Drill-in: The chat page parses citation blocks, displaying clickable references that open the corresponding item details modal.
- Layout: The chat route uses the global app header and renders a compact two-pane workspace with a local thread rail, conversation surface, source citation chips, and bottom composer.

### Visualization Canvas (Knowledge Map)
- Page Route: app/(app)/app/canvas/page.tsx, rendering components/KnowledgeMap.tsx.
- Graphic Rendering: Uses react-force-graph-2d to render 2D force-directed node-edge network clusters in the browser, and reactflow for structured flowchart layouts.
- Data Gateway: Fetches nodes and relations list from app/api/graph/route.ts, reading from items and item_relations tables.
- Interactive Controls: Features a collapsible options panel with search, type filters, pinned/connected toggles, and threshold sliders to adjust relation strengths dynamically (0.0 to 1.0). The Canvas/Graph mode toggle stays visible while the options panel is collapsed.

## Security Constraints
- AGENT AVOID: Never query global items in search or chat. Every SQL vector statement must strictly filter by the active user ID resolved from the session.
- AGENT NOTE: Force-directed canvases must perform window checks to bypass server rendering failures, and clamp node sizes to prevent rendering crashes.

## Update Triggers
- When the search matching threshold, weights, or scoring rules are modified.
- When changing prompt templates, context thresholds, or streaming schemas in the RAG chat engine.
- When updating force-directed properties or graph filters inside components/KnowledgeMap.tsx.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Connects retrieval engines.
- [docs/architecture/data-flow.md](file:///e:/Projects/recallQ/docs/architecture/data-flow.md) — Details the data flows.
- [docs/modules/capture.md](file:///e:/Projects/recallQ/docs/modules/capture.md) — Ingestion flow details.

AGENT OWNER: components/KnowledgeMap.tsx
AGENT UPDATE: docs/modules/search-chat-graph.md
