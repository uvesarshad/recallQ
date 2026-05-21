# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Primary references

This repo's authoritative agent guidance lives in two files — read them before doing anything else:

- **[AGENTS.md](AGENTS.md)** — the bootstrap file. Defines hard rules, the per-task workflow (read overview → read module doc → make change → run update tree → output `DOCS UPDATED`), the docs update tags (`AGENT NOTE` / `AGENT SEE` / `AGENT AVOID` / `AGENT UPDATE`), the tech-stack summary, and the canonical list of key file paths. Kept under 80 lines on purpose; do not bloat it.
- **[docs/overview.md](docs/overview.md)** — the mental model and the index of every other doc. Lists each file under `docs/architecture/`, `docs/ui/`, `docs/api/`, `docs/state/`, `docs/auth/`, `docs/infra/`, and `docs/modules/` with a one-line description. Use it to find the right module/architecture doc for whatever area you're touching, and update it whenever a doc file is added, removed, or restructured.

CLAUDE.md (this file) only summarizes commands and the big-picture architecture. For rules, constraints, and module deep-dives, **AGENTS.md and docs/overview.md are authoritative** — if they disagree with anything here, they win.

## Required reading before edits

1. Read [AGENTS.md](AGENTS.md) — bootstrap rules, hard constraints, key file paths.
2. Read [docs/overview.md](docs/overview.md) — full mental model and the index of all other doc files.
3. Read the relevant `docs/modules/*.md` or `docs/architecture/*.md` for the area being changed.
4. Follow `AGENT NOTE:` / `AGENT UPDATE:` / `AGENT AVOID:` tags inside any doc you touch — they specify which docs must be updated when code changes.
5. Output a `DOCS UPDATED` summary before declaring the task done.

Hard rules from AGENTS.md that you MUST honor:
- Never add `'use client'` to a Server Component without checking `docs/architecture/rendering-strategy.md`.
- Never add an env var without updating `docs/infra/environment.md`.
- Never modify the DB schema without updating `docs/api/database.md` and adding a numbered migration in `migrations/`.
- Any single `docs/*.md` file over 200 lines must be split, and `docs/overview.md` updated to list both parts.

## Monorepo

This is a pnpm + Turborepo workspace. The Next.js web app lives at `apps/web/`. Future `apps/extension/` (WXT, Chrome extension) and `apps/mobile/` (Expo, iOS/Android) per [PLAN.md](PLAN.md). Shared TypeScript packages will live under `packages/`. Workers live at `apps/web/workers/`. `migrations/`, `scripts/`, and `docs/` stay at the workspace root because they're not app-specific.

Always run scripts from the workspace root via pnpm. Do not `cd apps/web` and run there — the env file loading and turbo task graph assume root cwd.

## Commands

All run from the workspace root.

- `pnpm dev` — Next dev server on **port 3008** (not 3000). Loads `.env` from workspace root via `next.config.mjs`.
- `pnpm build` / `pnpm start` — production build / serve.
- `pnpm lint` — ESLint via `apps/web/eslint.config.mjs`.
- `pnpm typecheck` — `next typegen` then `tsc --noEmit`.
- `pnpm test` — `node --experimental-strip-types apps/web/tests/run-tests.ts`, which sequentially invokes the runner exported from each `tests/*.test.ts` file. No framework, no name filter.
- `pnpm db:migrate` — applies `migrations/*.sql` in order via `scripts/migrate.js` (loads `.env` from workspace root, runs against `DATABASE_URL`).
- `pnpm db:migrate:latest` — applies only the newest schema addition.
- `pnpm worker:enrich` — runs the enrichment daemon (`tsx --env-file=../../.env workers/enrichment-worker.ts` inside `apps/web/`). Must be running locally for AI summaries, tags, embeddings, and item relations to populate.
- `pnpm worker:reminders` — runs the reminder daemon (same env-file pattern).
- `pnpm telegram:webhook` — registers the Telegram bot webhook against the configured host.

## Architecture

Recall is a Tier 4 Next.js App Router SaaS with two persistent background workers. The web tier never does heavy AI / scraping work — it enqueues by writing rows; the workers do the rest. The architecture is being extended to a multi-client ecosystem (web + Chrome extension + iOS/Android) per [PLAN.md](PLAN.md); the canonical web paths below all sit under `apps/web/`.

**Request path (web):** `apps/web/app/(app)/*` and `apps/web/app/(auth)/*` route groups → server components hit `apps/web/lib/db.ts` (a singleton `pg.Pool`) directly. Auth is NextAuth v5 (beta) with `@auth/pg-adapter`; layout guards live in `apps/web/app/(app)/layout.tsx`. API handlers under `apps/web/app/api/*` (items, actions, chat, email, graph, me, reminders, payments, telegram, ingest, search, files, collections, user) implement the route contracts documented in `docs/api/route-handlers.md`. They will move under `apps/web/app/api/v1/*` in Stage 1 of PLAN.md. Plan-limit enforcement and request-auth helpers live in `apps/web/lib/plan-limits.ts` and `apps/web/lib/request-auth.ts`.

**Capture pipeline:** All ingest surfaces (web form, PWA, browser extension, Telegram webhook, inbound email) funnel through `apps/web/lib/ingest.ts`, which validates, parses commands, checks plan limits, and inserts an `archive_items` row in an unenriched state.

**Enrichment pipeline (async):** `apps/web/workers/enrichment-worker.ts` polls every 5s for unenriched items, scrapes (`cheerio`) or extracts (`mammoth` for DOCX, `pdf-parse` for PDF, `xlsx` for spreadsheets), calls Gemini (`gemini-2.5-flash-lite`) for title/summary/tags/reminder, computes `text-embedding-004` vectors, writes back, and runs pgvector cosine-distance matching via `apps/web/lib/relations.ts` + `apps/web/lib/vector.ts` to generate item relations. **Never inline this work into a route handler** — see the `AGENT AVOID` in `docs/infra/deployment.md`.

**Reminder pipeline (async):** `apps/web/workers/reminder-worker.ts` polls every 60s for `reminders` rows that are due and unsent, delivers via Resend email or Telegram (HTML), marks them sent, and resets `saves_this_month` counters at month boundaries.

**Search / chat / graph:** Hybrid search + streaming RAG chat + the `KnowledgeMap` force-directed canvas (`apps/web/components/KnowledgeMap.tsx`, `@xyflow/react` + `react-force-graph-2d`) are documented together in `docs/modules/search-chat-graph.md`. The chat uses Gemini RAG over the same embeddings the worker writes.

**Database:** Raw `pg` Pool (no ORM) with pgvector. Migrations are append-only numbered SQL files in `migrations/` (workspace root). Schema reference lives in `docs/api/database.md`.

**Billing:** Razorpay with webhook listeners under `apps/web/app/api/payments/`; subscription tier transitions are documented in `docs/modules/billing-settings.md`. iOS will be free-only for v1 (no Apple IAP) per PLAN.md.

**Env vars:** Validated via a Zod schema in `apps/web/lib/env.ts`; the canonical list is `docs/infra/environment.md`. The `.env` file lives at the workspace root and is loaded by `apps/web/next.config.mjs` (for build/dev), by Node's `--env-file=../../.env` flag (for workers), and by `require('dotenv').config()` in `scripts/migrate.js` / `scripts/register-telegram-webhook.js`.
