# UI Layout System

> Scope: Layout routing hierarchy, App Router groups, nesting rules, PWA setup, and shell wrappers.
> Rendering context: Isomorphic
> Project tier: 4
> Last updated: 2026-07-07

## Overview
Recall uses a nested Next.js layout structure to enforce route guards, apply theme state, load PWA requirements, and provide a unified capture/chat shell across authenticated routes.

## Layout Hierarchy

### Root Layout
- File Location: `apps/web/app/layout.tsx`
- Role: Isomorphic base layout wrapping all pages. It outputs the standard `html` and `body` containers.
- Settings: Declares viewport configuration, app metadata, manifest links, and icon links.
- Inlined Script: Uses a Next.js `beforeInteractive` script to read and validate `recall-theme`, then applies the theme dataset before hydration.
- PWA Registration: Mounts `apps/web/components/PWASetup.tsx` to register client-side service workers.

### App Shell Layout
- File Location: `apps/web/app/(app)/layout.tsx`
- Parent: Nested under the Root Layout.
- Guard Boundary: Checks NextAuth session credentials server-side. Redirects unauthenticated requests to `/login`.
- Layout Wrapper: Extracts verified session parameters and wraps nested pages inside `apps/web/components/AppShell.tsx`.

### Authenticated Shell
`AppShell` provides the sticky capture header, global create dialog, floating chat dock, and top-left menu. The current primary destinations are:
- Feed: `/app`, served by `apps/web/app/(app)/app/page.tsx`, renders `apps/web/components/FeedPageClient.tsx`. Search is rendered inline from `?q=`, and the feed owns filters, tags, selection, bulk actions, keyboard shortcuts, and load-more pagination.
- Canvas: `/app/canvas`, served by `apps/web/app/(app)/app/canvas/page.tsx`, dynamically loads `apps/web/components/KnowledgeMap.tsx` through `canvas-client.tsx`. Canvas is a freeform board with pan, zoom, drag, persisted item positions, custom item nodes, and a bottom-right Capture/Fit/Refresh dock.
- Settings: `/app/settings/profile`, with subpages `profile`, `folders`, `integrations`, `billing`, and `appearance` under `apps/web/app/(app)/app/settings/<sub>/`. Each subpage pairs with `apps/web/components/SettingsNav.tsx`.
- Chat: `apps/web/components/ChatDock.tsx` is mounted globally by `AppShell`; it streams `/api/v1/chat` from a floating panel instead of a dedicated navigation route.

### Legacy Redirects
Legacy visualization, search, login, and root settings URLs are redirected in `apps/web/next.config.mjs` so old bookmarks and share targets land on canonical app routes.

## Layout-Level Data Fetching
- Authentication Check: Performed server-side inside `apps/web/app/(app)/layout.tsx` using the auth helper. It guarantees that page-level data fetches receive a validated user session.
- Initial Hydration: Page controllers such as `apps/web/app/(app)/app/page.tsx` fetch folders and recent items server-side via SQL before mounting client components.

## Security Constraints
- AGENT AVOID: Never query database records directly inside `apps/web/app/layout.tsx`, since this root layout is shared with unauthenticated pages.
- AGENT NOTE: When writing a new authenticated app view, place it under `apps/web/app/(app)/app/` so it is wrapped by the AppShell layout.

## Update Triggers
- When the layout hierarchy changes or a new Next.js route group is introduced.
- When global viewport, manifest, icon, or SEO metadata changes in `apps/web/app/layout.tsx`.
- When auth check logic, redirect conditions, or primary shell surfaces are modified.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) - Connects high-level components.
- [docs/architecture/rendering-strategy.md](file:///e:/Projects/recallQ/docs/architecture/rendering-strategy.md) - Details server rendering.
- [docs/ui/component-library.md](file:///e:/Projects/recallQ/docs/ui/component-library.md) - Catalogs component files.

AGENT OWNER: apps/web/app/(app)/layout.tsx
AGENT UPDATE: docs/ui/layout-system.md
