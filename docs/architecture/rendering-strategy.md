# Next.js Rendering Strategy

> Scope: Dynamic vs. static routes, caching, Edge vs. Node runtime, and client/server boundary contracts.
> Rendering context: Isomorphic
> Project tier: 4
> Last updated: 2026-05-17

## Overview
Recall is a highly personalized data-rich system where almost all routes must reflect the current user's private dataset in real-time. Consequently, the codebase relies heavily on dynamic, non-cached Server-side Rendering (SSR) for views and forced dynamic route evaluation for all REST API endpoints. Static site generation (SSG) is avoided to guarantee user data isolation and instant write reflection.

## Client and Server Component Boundaries
Recall strictly splits rendering execution between Server Components and Client Components to combine fast initial page loads and secure database querying with highly interactive browser interfaces.

### Server Components
- Root Layout: app/layout.tsx. Isomorphic root that loads HTML headers, applies the initial theme dataset attribute via a Next.js beforeInteractive Script, and mounts PWA helpers.
- App Shell Layout: app/(app)/layout.tsx. Server Component that fetches user session from NextAuth and redirects unauthenticated requests to the login page.
- Dashboard Feed: app/(app)/app/page.tsx. Dynamically queries items and collections from the database based on the active user session, and passes down initial records to client components.
- Auth Pages: app/(auth)/login/page.tsx, app/(auth)/signup/page.tsx, app/(auth)/forgot-password/page.tsx, and app/(auth)/reset-password/page.tsx. Force dynamic rendering for auth state, form status, and token query handling. app/app/login/page.tsx remains only as a compatibility redirect to /login.

### Client Components
- Interactive Feed Page: components/FeedPageClient.tsx. Marked with use client. Handles state sorting, sidebar search input filtering, modal toggling, and infinite scroll triggers.
- Canvas Visualization: components/KnowledgeMap.tsx. Marked with use client. Manages force-directed graphs using react-force-graph-2d and canvas flows using reactflow.
- Modal Dialogs: components/ItemDetailModal.tsx and components/CreateItemDialog.tsx. Marked with use client. Handle local edit states, comment input actions, and user key down escapes.
- Capture Bar: components/CaptureBar.tsx. Marked with use client. Handles client-side URL parsing, file drag-and-drop bindings, paste events, and optimistic state spinner.

## Caching and Runtime Strategies
- Force Dynamic Routing: Almost all page components (such as app/(app)/app/page.tsx) and API handlers (such as app/api/items/route.ts) explicitly export a dynamic string constant set to force-dynamic. This instructs Next.js to bypass static build generation and evaluate the route fresh on every request.
- Caching: Standard route-level HTTP caching is disabled to prevent stale data. Client components handle their own data invalidation by triggering refetches directly upon saving new items.
- Runtime Environment: All APIs and workers execute on the standard Node.js runtime (no Edge runtime limitations) to maintain full access to local files and Postgres Pool connections.

## Security Constraints
- AGENT AVOID: Never import database query pools (lib/db.ts) or secret env tokens inside client-side components. Client components must only query the database via REST API handlers under app/api/.
- AGENT NOTE: Always mark interactive elements that require browser APIs (such as document event listeners or window sizes) with use client at the very top of the file.

## Update Triggers
- When a static or dynamic route changes its rendering configuration.
- When introducing edge runtimes or streaming routing responses.
- When shifting a component between server-side execution and client-side compilation.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Connects high-level architecture.
- [docs/architecture/folder-structure.md](file:///e:/Projects/recallQ/docs/architecture/folder-structure.md) — Code directory mapping.
- [docs/ui/layout-system.md](file:///e:/Projects/recallQ/docs/ui/layout-system.md) — Documents routing shell structure.

AGENT OWNER: app/layout.tsx
AGENT UPDATE: docs/architecture/rendering-strategy.md
