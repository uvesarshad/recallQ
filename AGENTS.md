# Agent Instructions — Recall

## Start here
Read docs/overview.md before doing anything else.
It contains the full mental model: stack, architecture, data flow,
module map, and glossary.

## Documentation index
docs/overview.md lists every doc file and what it covers.
Navigate from there. Do not rely on memory or assumptions.

## Before every task
1. Read docs/overview.md
2. Read the relevant module doc in docs/modules/ if one exists
3. Make the change
4. Run the update decision tree in the ## Update Rules section
   of the generation prompt, or follow AGENT UPDATE: tags in the
   affected doc files
5. Output a DOCS UPDATED summary before marking the task complete

## Hard rules
- Never invent file paths, component names, or type names.
  Always verify against the actual codebase.
- Never add 'use client' to a Server Component without checking
  docs/architecture/rendering-strategy.md first.
- Never add an environment variable without updating
  docs/infra/environment.md.
- Never modify the database schema without updating docs/api/database.md.
- If a docs/ file would exceed 200 lines after your update, split it
  and update docs/overview.md to list both parts.

## Docs update tags
Throughout the /docs files you will find:
  AGENT NOTE:  — constraint you must follow
  AGENT SEE:   — cross-reference to read
  AGENT AVOID: — anti-pattern to skip
  AGENT UPDATE: — doc files to update when this area changes

## Stack summary
Recall is a Tier 4 SaaS built on Next.js 14, dark-first globals.css themes, raw PostgreSQL (`pg` pool queries), pgvector similarities (`text-embedding-004`), NextAuth v5 (beta), Razorpay billing, Gemini AI integrations (`gemini-2.5-flash-lite`), and dual background daemons.

## Key paths
- [app/(app)/layout.tsx](file:///e:/Projects/recallQ/app/(app)/layout.tsx) — Authenticated layout routing guard.
- [app/(app)/app/page.tsx](file:///e:/Projects/recallQ/app/(app)/app/page.tsx) — Primary dashboard feed page component.
- [lib/ingest.ts](file:///e:/Projects/recallQ/lib/ingest.ts) — Multi-channel capture ingestion entry.
- [lib/db.ts](file:///e:/Projects/recallQ/lib/db.ts) — Direct PostgreSQL database pool connection client.
- [workers/enrichment-worker.ts](file:///e:/Projects/recallQ/workers/enrichment-worker.ts) — Asynchronous background AI scraper and vector builder daemon.
- [workers/reminder-worker.ts](file:///e:/Projects/recallQ/workers/reminder-worker.ts) — Continuous polling reminder alert dispatcher.
- [components/KnowledgeMap.tsx](file:///e:/Projects/recallQ/components/KnowledgeMap.tsx) — 2D force-directed node-edge canvas layout visualizer.


AGENT NOTE: AGENTS.md must stay under 80 lines. It is a bootstrap file,
not a full reference. All detail lives in /docs. Keep it short and hard.
