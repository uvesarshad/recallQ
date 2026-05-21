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
- docs/security-audit.md: Per-endpoint audit of `/api/v1/*` confirming auth, validation, plan-limit, and rate-limit guards.
- docs/modules/capture.md: Deep dive into the multi-surface capture engine, action extraction, and limits checking.
- docs/modules/search-chat-canvas.md: Deep dive into hybrid search (now rendered inline in the Feed), streaming RAG chat, and the freeform infinite canvas.
- docs/modules/billing-settings.md: Deep dive into plans, settings routing, and webhook-driven subscription sync.

## Glossary
- Archive Item: The core unit of knowledge (URL, note, plain text, or file) captured by the user.
- Ingestion: The entry pipeline that validates, performs command parsing, limits check, and saves the item.
- Enrichment: The async post-save AI pipeline that scrapes, parses, summarizes, tags, and embeds the item.
- RAG: Retrieval-Augmented Generation, used to answer queries in the chat panel based on the semantic search of context items.
- Item Relation: AI-inferred similarities (embedding cosine distance) or manual links between captured items.

## Recent Changes
- [2026-05-22] Stage 9 (foundation): Expo mobile app (`apps/mobile/`) scaffolded with Expo SDK 52, React Native 0.76, Expo Router 4, NativeWind 4. Bundle ID `ai.montr.recallq`, scheme `recallq://`. Screens: `(auth)/sign-in` (email+password → `/api/v1/auth/tokens` via the typed `@recall/api-client`), `(tabs)/index` (feed with pull-to-refresh), `(tabs)/capture` (URL/text → ingest), `(tabs)/settings` (account info + sign out), `item/[id]` (detail with open-link). Token persistence via Expo SecureStore. Shared `AuthProvider` gates the tabs and redirects to sign-in. `app.json` carries Android intent filters (SEND + recallq.xyz path deep links) and iOS `associatedDomains` for future universal-link wiring. `@recall/api-client` got `items.list` + `items.get`. Monorepo React types aligned via `pnpm-workspace.yaml` overrides (`@types/react: 18.3.12`, `@types/react-dom: 18.3.5`) — web on React 19 runtime works with @types/react 18.3 (the Next-recommended pattern), and RN/Expo's types are compiled against the same. **Deferred to v1.5**: Share Extension (iOS) / share intent handling, Expo Push notifications + device registration, offline capture queue via Expo SQLite, Google + Apple OAuth, camera/document picker, universal/app link content handlers, EAS build setup, splash + icon assets.
- [2026-05-22] Stage 8: Chrome extension (`apps/extension/`) scaffolded via WXT 0.20 — Manifest V3, React popup, background context menu (`Save link to RecallQ`, `Save selection to RecallQ`), token persisted in `chrome.storage.local`. Auth via `chrome.identity.launchWebAuthFlow` → new web bridge `apps/web/app/extension/connect/page.tsx` that requires NextAuth session, mints a personal access token, and redirects back to the extension's reserved `chromiumapp.org` URL. New `packages/api-client` (typed REST client, `createRecallClient`) consumed by the extension; web app keeps hitting `/api/v1/*` same-origin without it. `apps/web/proxy.ts` middleware extended to handle CORS preflight + headers for `/api/v1/*` (permissive because the API is bearer-token-gated). Root scripts added: `pnpm build:ext`, `pnpm build:all`, `pnpm zip:ext`, `pnpm dev:ext`. Extension build is ~205 KB total (popup + background + manifest + CSS).
- [2026-05-22] Stage 7: Visual polish + a11y. Sitewide `:focus-visible` outline added in `apps/web/app/globals.css` so every interactive element shows a brand-colored focus ring under keyboard navigation (suppressed under mouse). New `apps/web/lib/use-modal-a11y.ts` shared hook handles body scroll lock, auto-focus on open, focus restoration on close, and Tab/Shift+Tab focus trap — adopted by both `CreateItemDialog` and `ItemDetailModal`. `FeedPageClient` gets a real search-no-results state: search icon, the query echoed in a heading, and a "Clear search" button that returns to the full archive.
- [2026-05-22] Stage 6: Performance work. Dropped `react-force-graph-2d` (unused since the Stage 3 canvas rewrite) along with 24 transitive deps. Lazy-loaded `@xyflow/react` so the ~70KB canvas bundle only ships on `/app/canvas` — Feed, Chat, Settings, and auth pages skip it. New migration 014 adds `items.blur_data_url`; the enrichment worker now computes a 16x16 base64 JPEG placeholder via `apps/web/lib/blur.ts` (sharp) whenever it scrapes an `image_url`, and `ItemCard` renders it through `next/image` with `placeholder="blur"` to eliminate CLS on the feed. `/api/v1/health` gets a 10s edge cache so uptime probes don't ping the DB on every poll. A11y nibbles: `aria-label` + `aria-expanded` on the sidebar collapse button, `aria-label` on the per-card delete button. Sharp added to `apps/web/package.json` so workers and (future) image-resize routes can use the same library.
- [2026-05-22] Stage 5: Security hardening. Migration 013 adds `rate_limits`; new `apps/web/lib/rate-limit.ts` is an atomic Postgres-backed fixed-window limiter (no Redis). Applied to `POST /api/v1/auth/tokens` (5/IP/15min + 10/email/hour), `POST /api/v1/chat` (30/user/hour), `POST /api/v1/ingest` (60/user/min). `apps/web/next.config.mjs` now sets HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy on every response, plus a Content-Security-Policy in Report-Only mode (allowlist covers Razorpay, Gemini). `apps/web/lib/env.ts` boot check refuses to start in production with an AUTH_SECRET shorter than 32 chars or with a localhost DATABASE_URL when `SELF_HOSTED!=true` — phase-aware so it doesn't fire during `next build`. `.gitignore` now blocks all `.env*` files except `.env.example`. Per-route audit lives in `docs/security-audit.md` (33 endpoints catalogued, 7 follow-ups deferred to Stage 6/8).
- [2026-05-22] Stage 4: Wired production-grade error handling and observability. `apps/web/lib/logger.ts` now emits JSON-per-line in production (CloudPanel-parseable) and pretty text in dev, gated by the new `LOG_LEVEL` env. Migration 012 adds `worker_heartbeats`; both background workers upsert their row every 30 seconds via the new `apps/web/lib/worker-heartbeat.ts` helper and install `unhandledRejection` / `uncaughtException` handlers that log and exit non-zero so systemd restarts cleanly. New unauthenticated `GET /api/v1/health` endpoint pings the DB and reads heartbeats, returning 200/503 plus per-worker `up`/`down` status. App shell now ships its own `error.tsx`, `loading.tsx`, plus per-page loading skeletons for canvas and chat; `apps/web/app/not-found.tsx` and `apps/web/app/global-error.tsx` are branded last-resort boundaries.
- [2026-05-22] Stage 3: Wired search into the Feed and reshaped Canvas as an infinite freeform board. Extracted `runSearch` / `runHybridSearch` into `apps/web/lib/search.ts` and made `apps/web/app/(app)/app/page.tsx` call it server-side when `searchParams.q` is present. `FeedPageClient` now accepts a `searchQuery` prop and renders a clear-pill at the top in search mode. `AppShell` syncs the input value with `?q=` via `useSearchParams`. Rewrote `apps/web/components/KnowledgeMap.tsx` from ~510 lines to ~330: deleted the column-by-type swimlanes, header nodes, in-canvas search, type filters, MiniMap, ReactFlow Controls, and image-vs-text height variants. Kept pan/zoom/drag/persist, ItemDetailModal click-through, and the archive-event listeners. New items captured anywhere in the app immediately persist a viewport-center position so they appear where the user is looking. Bottom-right floating dock has Capture, Fit-to-viewport, Refresh. Renamed `docs/modules/search-chat-graph.md` → `docs/modules/search-chat-canvas.md`. Settings audit kept the Appearance subpage (it's a 3-option card picker, richer than the AppShell cycle button).
- [2026-05-22] Stage 2: Deleted duplicate and feature-cut routes — `/canvas`, `/graph`, `/app/graph`, `/app/search`, `/app/login`, the entire `app/(app)/settings/` tree. Moved each `*-settings-client.tsx` from `app/(app)/settings/<sub>/` into the canonical `app/(app)/app/settings/<sub>/` so the inner pages no longer reach outward for components. Added 301 redirects in `apps/web/next.config.mjs` so external bookmarks, search-engine indexes, and the PWA Web Share Target keep working. AppShell's header search now navigates to `/app?q=…` (Feed page will consume `q` in Stage 3). Canonical destinations are now Feed, Canvas, Chat, Settings.
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
