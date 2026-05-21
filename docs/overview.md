# Recall Project Overview

> Scope: High-level vision, tech stack, glossary, and index of Recall documentation.
> Rendering context: N/A
> Project tier: 4
> Last updated: 2026-05-22

## Overview
Recall (product name: RecallQ, by Montr AI) is a frictionless capture and intelligent organization tool designed to make high-density personal knowledge searchable and navigable. It captures notes, URLs, and files from any surface (web, Chrome extension, iOS/Android, Telegram, email) and enriches them using Gemini AI. Users interact with their archive via search, LLM-based RAG chat, and a freeform canvas. Billing is handled via Razorpay (web/extension/Android — iOS is free-only for v1).

## Project Tier and Tech Stack
Recall is classified as a Tier 4 production SaaS. The codebase is a pnpm + Turborepo monorepo with the web app under `apps/web/`; the Chrome extension (WXT) under `apps/extension/` and the Expo iOS/Android app under `apps/mobile/` will be added per [PLAN.md](file:///e:/Projects/recallQ/PLAN.md). Shared TypeScript packages will live under `packages/`.

The technical stack consists of:
- Monorepo: pnpm workspaces + Turborepo. Single workspace-root `.env` shared by web, workers, and DB scripts.
- Web framework: Next.js (App Router, Turbopack) with a dark-first UI theme.
- Runtime & Language: Node.js with strict TypeScript and direct TSX-based worker execution.
- Styling: Tailwind CSS v4 and custom design tokens in the global stylesheet.
- State Management: React local state and context-based state propagation with no third-party store.
- Database: Raw PostgreSQL Pool client via the pg package, coupled with pgvector for semantic similarities.
- Authentication: NextAuth v5 (beta) with PostgresAdapter for the web cookie session; bearer-token auth (personal access tokens) for the extension and mobile, per Stage 1 of PLAN.md.
- Payments: Razorpay API integration with webhook listeners to manage subscription tiers. iOS billing deferred (no Apple IAP for v1).
- AI Services: Gemini API via the Google Generative AI SDK, using gemini-2.5-flash-lite for summary/tags and text-embedding-004 for vector embeddings.
- Background Processing: Two discrete daemon tasks (enrichment, reminders) under `apps/web/workers/`, supervised by systemd in production.
- Chrome extension (planned): WXT + React + Manifest V3.
- Mobile (planned): Expo SDK + Expo Router + NativeWind + Expo SecureStore + Expo SQLite + Expo Push.

## Directory Map
- docs/overview.md (This file): Entry index, technology overview, directory map, glossary, and changes log.
- docs/architecture/folder-structure.md: Top-level layout and module grouping, naming rules, and convention boundaries.
- docs/architecture/rendering-strategy.md: Next.js rendering modes, static routes, dynamic handlers, and auth checks.
- docs/architecture/data-flow.md: Step-by-step lifecycles of capture, AI enrichment, vector mapping, and RAG retrieval.
- docs/ui/component-library.md: Detailed layout of shared shell, dialogs, cards, and interactive visualization maps.
- docs/ui/layout-system.md: Shared layouts, nested views, PWA setup, and user navigation panels.
- docs/ui/theming.md: Colors, font scales, border radiuses, and spacing constants.
- docs/api/route-handlers.md: Mapping and contracts for items, actions, chat, email, graph, me, reminders, and webhook routes.
- docs/api/server-actions.md: Sign-in and auth-handling server actions.
- docs/api/external-services.md: Third-party integrations (Gemini, Resend, Razorpay, Telegram) and format extraction engines.
- docs/api/database.md: PostgreSQL tables, vector dimensions, indexes, and initial-to-billing schema migrations.
- docs/state/client-state.md: Browser local states, custom events, and filter state management.
- docs/state/server-state.md: Fetch-based state hydration, client cache sync, and optimistic archive mutations.
- docs/auth/auth-flow.md: Provider setups, JWT callback mapping, and development login bypass.
- docs/auth/authorization.md: Layout guards, plan limit enforcement, and header token ingest validation.
- docs/infra/environment.md: Environment schema Zod validation list.
- docs/infra/deployment.md: Local execution, production builds, and daemon background execution.
- docs/infra/testing.md: CLI test run scripts, utility coverages, and custom tests map.
- docs/modules/capture.md: Deep dive into the multi-surface capture engine, action extraction, and limits checking.
- docs/modules/search-chat-graph.md: Deep dive into semantic search, Gemini RAG, and interactive flow chart canvas.
- docs/modules/billing-settings.md: Deep dive into plans, settings routing, and webhook-driven subscription sync.

## Glossary
- Archive Item: The core unit of knowledge (URL, note, plain text, or file) captured by the user.
- Ingestion: The entry pipeline that validates, performs command parsing, limits check, and saves the item.
- Enrichment: The async post-save AI pipeline that scrapes, parses, summarizes, tags, and embeds the item.
- RAG: Retrieval-Augmented Generation, used to answer queries in the chat panel based on the semantic search of context items.
- Item Relation: AI-inferred similarities (embedding cosine distance) or manual links between captured items.

## Recent Changes
- [2026-05-22] Stage 1: Versioned the application API under `/api/v1/*` (15 route directories moved; NextAuth stays at `/api/auth/*`). Added a transparent rewrite in `apps/web/next.config.mjs` so legacy paths keep working through the migration. Introduced `packages/api-schema` (shared Zod schemas, consumed via `transpilePackages`). Added migration 011_personal_access_tokens.sql for bearer-token auth, `apps/web/lib/auth-tokens.ts` for token generation + hashing, `apps/web/lib/api-response.ts` (`ok` / `fail` / `parseBody` helpers), and the three token endpoints (`POST /api/v1/auth/tokens`, `GET /api/v1/auth/tokens`, `DELETE /api/v1/auth/tokens/:id`). `requireUser(req)` in `apps/web/lib/request-auth.ts` now accepts both NextAuth session cookies and `Authorization: Bearer …` headers, ready for the Chrome extension and the mobile apps to consume.
- [2026-05-22] Stage 0: Restructured into pnpm + Turborepo monorepo with the web app under `apps/web/`. Workers moved to `apps/web/workers/`. Migrations, scripts, and docs stay at the workspace root. Single `.env` at root, loaded by `apps/web/next.config.mjs` for build/dev and via Node `--env-file` for workers. ESLint pinned to ^9 (10.x has incompatible plugin breakage). `react-hooks/set-state-in-effect` downgraded to warn pending Stage 3 cleanup. See [PLAN.md](file:///e:/Projects/recallQ/PLAN.md).
- [2026-05-18] Split authentication into dedicated login, signup, forgot-password, and reset-password pages with local password reset tokens.
- [2026-05-17] Switched UI to dark-first default, added quick-capture to shell, and added mobile drawer navigation.
- [2026-05-17] Built hybrid search retrieval page, threaded chat with citation drill-in, and bulk archive/undo actions.
- [2026-05-17] Standardized settings routing and created initial system documentation.

## Update Triggers
- When any documentation file is added, removed, or renamed.
- When there is a major change to the tech stack (e.g. upgrading Next.js version).
- When a new core feature is introduced that changes the high-level project vision.

## Related Docs
- [docs/architecture/folder-structure.md](file:///e:/Projects/recallQ/docs/architecture/folder-structure.md) — Renders the codebase layout described in the tech stack.

AGENT NOTE: overview.md is the first file any agent reads. If it drifts from reality, all downstream decisions will be wrong. Update it whenever any doc file is added, removed, or significantly restructured.
AGENT UPDATE: docs/overview.md
