# UI Layout System

> Scope: Documents layout routing hierarchy, App Router groups, nesting rules, PWA setup, and shell wrappers.
> Rendering context: Isomorphic
> Project tier: 4
> Last updated: 2026-05-22

## Overview
Recall utilizes a nested Next.js layout structure to establish strict route guards, enforce global dark themes, load PWA requirements, and provide a unified navigation shell across different routes. Visual containment is split between isomorphic layouts and a dynamic sidebar component wrapper.

## Layout Hierarchy

### Root Layout
- File Location: apps/web/app/layout.tsx
- Role: The isomorphic base layout wrapping all pages. It outputs the standard html and body containers.
- Settings: Declares viewport configurations (e.g. initialScale 1, themeColor indigo) and Next.js SEO metadata (manifest JSON, apple touch icon links).
- Inlined Script: Uses Next.js Script with beforeInteractive to read and validate local storage recall-theme settings, then applies a dark or light dataset attribute to the document element before hydration. When no saved preference exists, / defaults to light while authenticated app routes default to dark.
- PWA Registration: Mounts apps/web/components/PWASetup.tsx to register client-side service workers.

### App Shell Layout
- File Location: apps/web/app/(app)/layout.tsx
- Parent: Nested under the Root Layout.
- Guard Boundary: Asynchronously checks NextAuth session credentials. Redirects unauthenticated requests to /login.
- Layout Wrapper: Extracts verified session parameters (id, name, email, image) and wraps all nested pages inside the apps/web/components/AppShell.tsx component.

### Page View Routing
All app routes are nested inside the App Shell Layout and inherit the sidebar, global search triggers, header Capture button, and mobile responsive controls. As of Stage 2 of [PLAN.md](file:///e:/Projects/recallQ/PLAN.md) the canonical set is four destinations:
- Dashboard Feed: Served by apps/web/app/(app)/app/page.tsx. Renders apps/web/components/FeedPageClient.tsx. The header search bar navigates to `/app?q=…` which the Feed page will read in Stage 3 to render search results inline (replacing the deleted `/app/search` route).
- Infinite Canvas: Served by apps/web/app/(app)/app/canvas/page.tsx. Renders apps/web/components/KnowledgeMap.tsx. Stage 3 will strip this down to an Excalidraw-style freeform board (no type columns, no in-canvas search, no MiniMap, no filters); the `/app/graph` route was removed because Canvas covers visualization.
- Semantic Chat Workspace: Served by apps/web/app/(app)/app/chat/page.tsx. Uses the global app header and renders a compact two-pane thread rail plus conversation surface without an additional page header.
- Settings Workspace: Served by apps/web/app/(app)/app/settings/page.tsx (redirects to /app/settings/profile). Four subpages — profile, billing, integrations, appearance — each rendered with their `*-settings-client.tsx` co-located alongside `page.tsx` under apps/web/app/(app)/app/settings/<sub>/. Each subpage wraps its client component with apps/web/components/SettingsNav.tsx.

### Removed routes (Stage 2)
The following routes were deleted and are now 301-redirected via apps/web/next.config.mjs:
- `/canvas`, `/graph`, `/app/graph` → `/app/canvas`
- `/app/search` → `/app`
- `/app/login` → `/login`
- `/settings`, `/settings/profile`, `/settings/billing`, `/settings/integrations`, `/settings/appearance` → `/app/settings/...`

## Layout-Level Data Fetching
- Authentication Check: Performed server-side inside apps/web/app/(app)/layout.tsx using the auth helper. It guarantees that database calls in page routing receive clean, validated user IDs.
- Initial Hydration: Page controllers (such as apps/web/app/(app)/app/page.tsx) fetch initial records (folders lists and 50 most recent items) server-side via SQL before mounting the client-side FeedPageClient.

## Security Constraints
- AGENT AVOID: Never query database records directly inside apps/web/app/layout.tsx, since this is a global layout shared with unauthenticated pages like the login screen.
- AGENT NOTE: When writing a new app view, place it under apps/web/app/(app)/app/ to ensure it is correctly wrapped inside the AppShell navigation layout. The corresponding outer route group apps/web/app/(app)/<name>/ was deleted in Stage 2; do not recreate it.

## Update Triggers
- When the layout hierarchy changes or a new Next.js route group is introduced.
- When global viewport or SEO metadata is changed in app/layout.tsx.
- When auth check logic or page redirect conditions are modified in app/(app)/layout.tsx.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Connects high-level components.
- [docs/architecture/rendering-strategy.md](file:///e:/Projects/recallQ/docs/architecture/rendering-strategy.md) — Details server rendering.
- [docs/ui/component-library.md](file:///e:/Projects/recallQ/docs/ui/component-library.md) — Catalogs component files.

AGENT OWNER: apps/web/app/(app)/layout.tsx
AGENT UPDATE: docs/ui/layout-system.md
