# Server State and Data Hydration

> Scope: Documents server data fetching, page hydration, cache invalidations, and client-server sync patterns.
> Rendering context: Isomorphic
> Project tier: 4
> Last updated: 2026-05-17

## Overview
Recall manages server-side state synchronization through direct PostgreSQL queries inside Server Components during initial page loads, and standard client-side fetch requests during live updates. It avoids global caching managers (such as React Query) in favor of explicit, event-driven state refetches to keep user dashboards fresh and lightweight.

## Hydration and Initial Loads
- Server Components Hydration: Routes like app/(app)/app/page.tsx fetch the initial user records (e.g. the 50 most recent archive items and the user's collections) directly from PostgreSQL before rendering.
- Props Seeding: These database records are passed directly as initial props to the client-side FeedPageClient. This avoids secondary client-side mount fetches, accelerating initial page displays.
- Dynamic Server Rendering: Pages and API routes are explicitly marked with force-dynamic. This instructs Next.js to bypass static route compilation and evaluate database queries fresh on every page load.

## Sync and Data Revalidation
Because the client does not implement automated cache layers, data revalidation is triggered manually upon mutations:
- Optimistic Ingestion: When a user captures content via the CaptureBar, the item is immediately pushed to the client feed list with an enriched property of false, avoiding blank states while the background daemon worker operates.
- Explicit Client Fetches: Modifying item configurations (like updating titles, changing collections, or editing tags inside ItemDetailModal) triggers client-side PATCH fetch requests. Once a request completes, the client updates its local state arrays.
- Event-Driven Revalidation: To notify other visual blocks (like updating node positions in components/KnowledgeMap.tsx or query matches in search pages), components broadcast custom window events. Sibling components capture these events and trigger internal fetch reloads to fetch fresh datasets.
- Pagination Cursor: The dashboard feed uses cursor-based pagination. Client components query api/items with the ID of the last item in the array to fetch the next block of 20 items.

## Security Constraints
- AGENT AVOID: Do not introduce tRPC, React Query, or other server-state frameworks. Native fetch calls and explicit local states keep the client bundle highly performant.
- AGENT NOTE: Always call clean, parameterized REST routes to fetch state in client components, rather than writing raw database queries inside useEffect blocks.

## Update Triggers
- When the Next.js routing cache configuration is modified.
- When changing initial hydration properties in app/(app)/app/page.tsx.
- When altering pagination cursors or revalidation callback rules.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Tech stack overview.
- [docs/state/client-state.md](file:///e:/Projects/recallQ/docs/state/client-state.md) — Client states mapping.
- [docs/api/route-handlers.md](file:///e:/Projects/recallQ/docs/api/route-handlers.md) — REST API endpoints.

AGENT OWNER: app/(app)/app/page.tsx
AGENT UPDATE: docs/state/server-state.md
