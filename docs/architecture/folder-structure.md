# Folder Structure and Naming Conventions

> Scope: Directory organization, structural grouping, co-location practices, and code style boundaries.
> Rendering context: Isomorphic
> Project tier: 4
> Last updated: 2026-05-17

## Overview
Recall utilizes a modular, feature-grouped directory hierarchy built inside a Next.js App Router structure. Code is organized by layers (UI presentation, business logic, background processing, and database schemas) with clear separations between client-side layouts and server-side worker daemons.

## Workspace Directory Map

- app: Contains all routing layouts, endpoints, and views. Built exclusively with Next.js App Router.
  - app/api: Server-side REST API handlers grouped by feature (e.g. app/api/items, app/api/chat).
  - app/(app): Route group containing the primary authenticated application shell.
    - app/(app)/app: Nested folder structure serving the core dashboard routes (e.g. app/(app)/app/canvas, app/(app)/app/chat).
  - app/(auth): Public auth pages for /login, /signup, /forgot-password, and /reset-password.
  - app/app: Compatibility auth redirect at app/app/login/page.tsx.
- components: Presentational and interactive React UI components (e.g. CaptureBar.tsx, ItemCard.tsx). All global UI components live in the root of this folder with no sub-folders.
- lib: Core business logic, helper scripts, and client initializations (e.g. lib/db.ts, lib/auth.ts, lib/gemini.ts). Isomorphic utilities are placed here alongside specialized backend logic.
- migrations: Relational SQL migrations numbered sequentially from 001_initial.sql to 005_add_billing.sql.
- workers: TypeScript-based background worker daemons (enrichment-worker.ts and reminder-worker.ts) that process items and dispatch reminders asynchronously.
- tests: Custom test suites and runner harness files.
- scripts: Developer scripting utilities, database run scripts, and webhook registration tools.
- public: Static public assets, image mockups, and PWA configurations (e.g. manifest.json, apple touch icons).

## Naming Conventions
- React Components: Always PascalCase (e.g. CaptureBar.tsx, AppShell.tsx) located in the components directory.
- Routes and Directories: Always kebab-case or brackets for dynamic parameters (e.g. app/api/payments/create-subscription, app/api/items/[id]).
- Core Helper Libraries: Always kebab-case or camelCase (e.g. lib/plan-limits.ts, lib/request-auth.ts).
- Database Migration Files: Prefixed with three-digit sequential padding (e.g. 001_initial.sql).
- Background Workers: Kebab-case (e.g. workers/enrichment-worker.ts).

## Architectural Boundaries
- AGENT AVOID: Never mix UI components inside the lib directory. Keep lib/ strictly reserved for data models, API integrations, and helper logic.
- AGENT NOTE: All shared UI pieces belong under components/ rather than co-locating them inside App Router sub-directories to maintain high reusability.

## Update Triggers
- When a new top-level directory is created in the repository.
- When renaming existing core directories.
- When shifting file placement rules (e.g. moving a helper from lib/ to components/).

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Connects workspace layers.
- [docs/architecture/rendering-strategy.md](file:///e:/Projects/recallQ/docs/architecture/rendering-strategy.md) — Explains routing layers.
- [docs/ui/component-library.md](file:///e:/Projects/recallQ/docs/ui/component-library.md) — Catalogs component files.

AGENT OWNER: app/
AGENT UPDATE: docs/architecture/folder-structure.md
