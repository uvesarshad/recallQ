# Next.js Rendering Strategy

> Scope: Dynamic vs. static routes, caching, Edge vs. Node runtime, and client/server boundary contracts.
> Rendering context: Isomorphic
> Project tier: 4
> Last updated: 2026-07-07

## Overview
Recall is a highly personalized data-rich system where almost all routes must reflect the current user's private dataset in real-time. Consequently, the codebase relies heavily on dynamic, non-cached Server-side Rendering (SSR) for views and forced dynamic route evaluation for all REST API endpoints. Static site generation (SSG) is avoided to guarantee user data isolation and instant write reflection.

## Client and Server Component Boundaries
Recall strictly splits rendering execution between Server Components and Client Components to combine fast initial page loads and secure database querying with highly interactive browser interfaces.

### Server Components
- Root Layout: `apps/web/app/layout.tsx`. Isomorphic root that loads HTML headers, applies the initial theme dataset attribute via a Next.js beforeInteractive Script, and mounts PWA helpers.
- App Shell Layout: `apps/web/app/(app)/layout.tsx`. Server Component that fetches the NextAuth session and redirects unauthenticated requests to `/login`.
- Dashboard Feed: `apps/web/app/(app)/app/page.tsx`. Dynamically queries items and collections for the active user and passes initial records to `FeedPageClient`.
- Auth Pages: `apps/web/app/(auth)/login/page.tsx`, `signup/page.tsx`, `forgot-password/page.tsx`, and `reset-password/page.tsx`. These force dynamic rendering for auth state, form status, and token query handling.

### Client Components
- Interactive Feed Page: `apps/web/components/FeedPageClient.tsx`. Marked with `use client`. Handles feed filters, sorting, column count, selection/batch actions, keyboard navigation, and item modal state.
- Canvas Visualization: `apps/web/components/KnowledgeMap.tsx`. Marked with `use client`. Uses `@xyflow/react` for freeform pan, zoom, drag, background, and viewport helpers while rendering custom item nodes without graph edges.
- Modal Dialogs: `apps/web/components/ItemDetailModal.tsx` and `CreateItemDialog.tsx`. Marked with `use client`. Handle local edit states, comment/capture actions, action previews, focus handling, and Escape dismissal.
- Capture Bar and Chat Dock: `apps/web/components/CaptureBar.tsx` and `ChatDock.tsx`. Marked with `use client`. Capture handles URL/text/file entry; chat streams `/api/v1/chat`.

## Caching and Runtime Strategies
- Force Dynamic Routing: Personalized page components such as `apps/web/app/(app)/app/page.tsx` and API handlers such as `apps/web/app/api/v1/items/route.ts` export `dynamic = "force-dynamic"` where they must bypass static build generation and evaluate fresh on every request.
- Caching: Standard route-level HTTP caching is disabled to prevent stale data. Client components handle their own data invalidation by triggering refetches directly upon saving new items.
- Runtime Environment: All APIs and workers execute on the standard Node.js runtime (no Edge runtime limitations) to maintain full access to local files and Postgres Pool connections.

## Security Constraints
- AGENT AVOID: Never import database query pools (`apps/web/lib/db.ts`) or secret env tokens inside client-side components. Client components must only query server data through REST handlers under `apps/web/app/api/v1/` or their legacy rewrite URLs.
- AGENT NOTE: Always mark interactive elements that require browser APIs (such as document event listeners or window sizes) with use client at the very top of the file.

## Update Triggers
- When a static or dynamic route changes its rendering configuration.
- When introducing edge runtimes or streaming routing responses.
- When shifting a component between server-side execution and client-side compilation.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Connects high-level architecture.
- [docs/architecture/folder-structure.md](file:///e:/Projects/recallQ/docs/architecture/folder-structure.md) — Code directory mapping.
- [docs/ui/layout-system.md](file:///e:/Projects/recallQ/docs/ui/layout-system.md) — Documents routing shell structure.

AGENT OWNER: apps/web/app/layout.tsx
AGENT UPDATE: docs/architecture/rendering-strategy.md
