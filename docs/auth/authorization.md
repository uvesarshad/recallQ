# Authorization and Access Control

> Scope: Route guards, API auth helpers, webhook ingest tokens, bearer tokens, and plan limit enforcement.
> Rendering context: Server-side
> Project tier: 4
> Last updated: 2026-07-07

## Overview
Recall enforces user isolation across web routes, API handlers, non-web clients, and capture webhooks. Authorization also includes atomic plan-limit checks for save count, storage bytes, reminders, and gated client capabilities such as extension cloud sync.

## Route Guards and API Security

### Layout Route Guarding
- Files: `apps/web/lib/auth.config.ts` and `apps/web/proxy.ts`.
- Matcher: protected app routes under `/app/:path*`.
- Behavior: public auth routes stay reachable; protected routes require a NextAuth session.

### API User Helpers
- `requireSessionUser()`: cookie/session-only web user.
- `requireUser(req)`: session or bearer-token user; used by routes consumed by extension/mobile.
- `requireIngestUser(req)`: session, bearer token, or internal ingest token; used by capture channels.

## Ingest Webhook Verification
- Internal capture can use `x-internal-ingest-token` with `x-recall-user-id`.
- Extension and mobile use personal access tokens through `Authorization: Bearer ...`.
- External webhook routes also validate provider-specific signatures or shared secrets.

## Subscription Plan Limit Enforcement
- Plans: free, starter, pro; self-hosted mode bypasses hosted SaaS limits.
- Source of truth: `apps/web/lib/plan-limits.ts`.
- Atomic ingest: `apps/web/lib/ingest.ts` locks the user's row, checks finite save/storage/reminder caps, and commits usage counters with item/reminder writes in one transaction.
- Unlimited plans: Pro and self-hosted unlimited values are handled through finite-cap branches in TypeScript, not SQL comparisons against `Infinity`.
- Failed ingest: rejected or failed captures do not consume save/storage quota; failed file-backed ingests delete the written file.

## Security Constraints
- AGENT AVOID: Never query user-owned records without filtering by the authenticated user ID.
- AGENT NOTE: Routes reachable from extension/mobile must use `requireUser(req)` when bearer access is expected.
- AGENT NOTE: Ingest writes must keep plan-limit accounting and item insertion transactional.

## Update Triggers
- When auth helper behavior changes.
- When plan tiers or usage limits change.
- When ingest token headers or bearer-token route access changes.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) - Access-control overview.
- [docs/auth/auth-flow.md](file:///e:/Projects/recallQ/docs/auth/auth-flow.md) - Auth providers.
- [docs/api/route-handlers.md](file:///e:/Projects/recallQ/docs/api/route-handlers.md) - REST endpoints.

AGENT OWNER: apps/web/lib/request-auth.ts
AGENT UPDATE: docs/auth/authorization.md
