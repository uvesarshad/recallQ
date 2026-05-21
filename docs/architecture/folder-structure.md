# Folder Structure and Naming Conventions

> Scope: Directory organization, structural grouping, co-location practices, and code style boundaries.
> Rendering context: Isomorphic
> Project tier: 4
> Last updated: 2026-05-22

## Overview
Recall is a pnpm + Turborepo monorepo. The Next.js web app, future Chrome extension, and future mobile app each live under `apps/`. Shared TypeScript packages (API schemas, typed client, core helpers) will live under `packages/`. Centralized infrastructure (SQL migrations, DB scripts, top-level docs) stays at the workspace root because both the web app and the workers run against the same database.

## Workspace Directory Map

- apps/: One folder per deployable app.
  - apps/web: The Next.js 14 App Router application (current ship target).
    - apps/web/app: Routing layouts, endpoints, and views.
      - apps/web/app/api: Server-side REST API handlers (will move to apps/web/app/api/v1 in Stage 1 of [PLAN.md](file:///e:/Projects/recallQ/PLAN.md)).
      - apps/web/app/(app): Route group containing the primary authenticated application shell.
        - apps/web/app/(app)/app: Nested folder structure serving the core dashboard routes (e.g. canvas, chat, settings).
      - apps/web/app/(auth): Public auth pages for /login, /signup, /forgot-password, and /reset-password.
    - apps/web/components: Presentational and interactive React UI components. Flat, no sub-folders.
    - apps/web/lib: Core business logic, helper scripts, client initializations (e.g. db.ts, auth.ts, gemini.ts).
    - apps/web/workers: TypeScript background worker daemons (enrichment-worker.ts, reminder-worker.ts). Run via `pnpm worker:enrich` / `pnpm worker:reminders` from the workspace root; both load env from the workspace-root .env via Node's `--env-file` flag.
    - apps/web/tests: Custom test suites and runner harness files.
    - apps/web/public: Static assets, image mockups, PWA manifest.
    - apps/web/types: Ambient type declarations (e.g. next-auth.d.ts).
    - apps/web/next.config.mjs: Loads the workspace-root .env via dotenv at the top so build/dev pick up DATABASE_URL, AUTH_SECRET, etc. Sets turbopack.root to the workspace root for monorepo dependency resolution.
  - apps/extension: Chrome / Edge / Firefox extension built with WXT (Stage 8 of [PLAN.md](file:///e:/Projects/recallQ/PLAN.md)). Entrypoints under `apps/extension/entrypoints/`: `background.ts` (MV3 service worker for the context menu), `popup/` (React popup with sign-in + save-current-tab). Shared helpers under `apps/extension/lib/` (auth-storage backed by `chrome.storage.local`, API client singleton, build-time API base URL). Manifest assembled by `apps/extension/wxt.config.ts`; build output in `apps/extension/.output/chrome-mv3/`. Auth bridges to the web through `apps/web/app/extension/connect/page.tsx` via `chrome.identity.launchWebAuthFlow`.
  - apps/mobile: Expo SDK 52 iOS/Android app (Stage 9 of [PLAN.md](file:///e:/Projects/recallQ/PLAN.md)). Expo Router file-based routing in `apps/mobile/app/` — `(auth)/sign-in.tsx` for email+password auth that mints a PAT via `/api/v1/auth/tokens`, `(tabs)/` for the authenticated shell (Feed, Capture, Settings), `item/[id].tsx` for item detail. Token persistence in `lib/auth-storage.ts` via Expo SecureStore. Shared `AuthProvider` in `lib/auth-context.tsx`. Styling via NativeWind 4 (Tailwind for React Native) with a palette mirroring the web's `--app-*` tokens. Metro is configured for the pnpm monorepo via `metro.config.js`. Bundle ID `ai.montr.recallq`, scheme `recallq://`, Android intent filters for SEND + recallq.xyz deep links, iOS Associated Domains for universal links.
- packages/: Internal TypeScript packages consumed by apps.
  - packages/api-schema: Zod schemas + types for every `/api/v1/*` request/response shape, shared between web and non-web clients. Stage 1 of [PLAN.md](file:///e:/Projects/recallQ/PLAN.md).
  - packages/api-client: Typed REST client for non-web clients (Chrome extension today, mobile later). Created in Stage 8.
- migrations/: Relational SQL migrations numbered sequentially (001_initial.sql … 010_password_reset_tokens.sql). Run via `pnpm db:migrate` from the workspace root.
- scripts/: DB migrate runner and Telegram webhook registration. Stay at root so they sit alongside `migrations/`.
- docs/: This documentation directory. Lives at the workspace root because it describes the system as a whole.
- pnpm-workspace.yaml: Lists `apps/*` and `packages/*` as workspaces and approves native build dependencies (esbuild, sharp, unrs-resolver).
- turbo.json: Defines build / dev / lint / typecheck / test / start task pipelines.
- package.json (workspace root): Holds the orchestration scripts (`dev`, `build`, `lint`, `typecheck`, `test`, `db:migrate`, `worker:*`, `telegram:webhook`) and dev-only deps for the root-level scripts (turbo, pg, dotenv).

## Naming Conventions
- React Components: Always PascalCase (e.g. CaptureBar.tsx, AppShell.tsx) located in `apps/web/components`.
- Routes and Directories: Always kebab-case or brackets for dynamic parameters (e.g. `apps/web/app/api/payments/create-subscription`, `apps/web/app/api/items/[id]`).
- Core Helper Libraries: Always kebab-case or camelCase (e.g. `apps/web/lib/plan-limits.ts`, `apps/web/lib/request-auth.ts`).
- Database Migration Files: Prefixed with three-digit sequential padding (e.g. 001_initial.sql).
- Background Workers: Kebab-case (e.g. `apps/web/workers/enrichment-worker.ts`).
- Internal packages: Scoped under `@recall/*` (e.g. `@recall/web`, future `@recall/api-schema`).

## Architectural Boundaries
- AGENT AVOID: Never mix UI components inside the `lib/` directory. Keep `apps/web/lib/` strictly reserved for data models, API integrations, and helper logic.
- AGENT NOTE: All shared UI pieces belong under `apps/web/components/` rather than co-locating them inside App Router sub-directories to maintain high reusability.
- AGENT NOTE: Workers live under `apps/web/workers/` because they share the same `lib/*` modules (db pool, telegram, gemini, push). They will move to a dedicated package only after `packages/core` is extracted (post-Stage 1).
- AGENT AVOID: Never edit the workspace-root `package.json` to add web app dependencies — those belong in `apps/web/package.json`. The root only orchestrates and holds devDeps for root-level scripts.

## Update Triggers
- When a new app is added under `apps/` or a new package under `packages/`.
- When a top-level directory is created in the workspace root.
- When renaming existing core directories.
- When shifting file placement rules (e.g. moving a helper from `lib/` to `components/`).

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Connects workspace layers.
- [docs/architecture/rendering-strategy.md](file:///e:/Projects/recallQ/docs/architecture/rendering-strategy.md) — Explains routing layers.
- [docs/ui/component-library.md](file:///e:/Projects/recallQ/docs/ui/component-library.md) — Catalogs component files.

AGENT OWNER: apps/web/
AGENT UPDATE: docs/architecture/folder-structure.md
