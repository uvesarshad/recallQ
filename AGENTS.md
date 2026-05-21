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

## Monorepo layout
pnpm + Turborepo. Web app at `apps/web/`. Future `apps/extension/` (WXT), `apps/mobile/` (Expo), and `packages/*` per PLAN.md. Workers live at `apps/web/workers/`. `migrations/`, `scripts/`, and `docs/` stay at the workspace root. Run scripts from root: `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm worker:enrich`, `pnpm db:migrate`.

## Key paths
- [apps/web/app/(app)/layout.tsx](file:///e:/Projects/recallQ/apps/web/app/(app)/layout.tsx) — Authenticated layout routing guard.
- [apps/web/app/(app)/app/page.tsx](file:///e:/Projects/recallQ/apps/web/app/(app)/app/page.tsx) — Primary dashboard feed page component.
- [apps/web/lib/ingest.ts](file:///e:/Projects/recallQ/apps/web/lib/ingest.ts) — Multi-channel capture ingestion entry.
- [apps/web/lib/db.ts](file:///e:/Projects/recallQ/apps/web/lib/db.ts) — Direct PostgreSQL database pool connection client.
- [apps/web/workers/enrichment-worker.ts](file:///e:/Projects/recallQ/apps/web/workers/enrichment-worker.ts) — Asynchronous background AI scraper and vector builder daemon.
- [apps/web/workers/reminder-worker.ts](file:///e:/Projects/recallQ/apps/web/workers/reminder-worker.ts) — Continuous polling reminder alert dispatcher.
- [apps/web/components/KnowledgeMap.tsx](file:///e:/Projects/recallQ/apps/web/components/KnowledgeMap.tsx) — 2D force-directed node-edge canvas layout visualizer.
- [apps/web/lib/request-auth.ts](file:///e:/Projects/recallQ/apps/web/lib/request-auth.ts) — `requireUser(req)` (session + bearer), `requireSessionUser()` (cookie only), `requireIngestUser(req)` (internal token).
- [apps/web/lib/auth-tokens.ts](file:///e:/Projects/recallQ/apps/web/lib/auth-tokens.ts) — Personal access token format, generation, and hashing.
- [apps/web/lib/api-response.ts](file:///e:/Projects/recallQ/apps/web/lib/api-response.ts) — `ok` / `fail` / `parseBody`. Every `/api/v1/*` handler returns through these.
- [packages/api-schema/](file:///e:/Projects/recallQ/packages/api-schema/) — Shared Zod schemas (`ErrorResponse`, `TokenIssueInput`, etc.) consumed by web, future extension, future mobile.
- [apps/web/next.config.mjs](file:///e:/Projects/recallQ/apps/web/next.config.mjs) — Loads workspace `.env`, sets `turbopack.root`, hosts the legacy `/api/*` → `/api/v1/*` rewrite block.
- [apps/web/proxy.ts](file:///e:/Projects/recallQ/apps/web/proxy.ts) — Combined middleware: NextAuth gate for `/app/*` + CORS preflight/headers for `/api/v1/*`.
- [apps/web/app/extension/connect/page.tsx](file:///e:/Projects/recallQ/apps/web/app/extension/connect/page.tsx) — Session-authed token issuance bridge used by the Chrome extension's WebAuth flow.
- [apps/extension/](file:///e:/Projects/recallQ/apps/extension/) — Chrome extension (WXT). Background context menu in `entrypoints/background.ts`, popup in `entrypoints/popup/`.
- [packages/api-client/src/index.ts](file:///e:/Projects/recallQ/packages/api-client/src/index.ts) — Typed REST client (`createRecallClient`) for non-web clients.
- [PLAN.md](file:///e:/Projects/recallQ/PLAN.md) — v1 ecosystem plan (web + extension + mobile). Read before touching anything cross-cutting.


AGENT NOTE: AGENTS.md must stay under 80 lines. It is a bootstrap file,
not a full reference. All detail lives in /docs. Keep it short and hard.
