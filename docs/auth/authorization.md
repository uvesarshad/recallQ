# Authorization and Access Control

> Scope: Documents Next.js layout route guards, API session verification, webhook ingest tokens, and plan limit enforcement rules.
> Rendering context: Server-side
> Project tier: 4
> Last updated: 2026-05-17

## Overview
Recall enforces rigorous permission checks across route boundaries, API handlers, and external capture webhooks. Beyond user isolation, authorization includes real-time checking of subscription plan limits, usage allocations, and self-hosted mode bypasses to restrict or grant access dynamically.

## Route Guards and API Security

### Layout Route Guarding
- File Location: lib/auth.config.ts and proxy.ts
- Middleware Matcher: Monitored through proxy.ts, capturing all paths under /app/:path*.
- Access Rules: The authorized callback grants access to /login, /signup, /forgot-password, /reset-password, and the compatibility /app/login redirect without verification. For all other protected paths starting with /app, NextAuth checks if the user is authenticated. Unauthenticated users are redirected to /login.

### API Session Authorization
- Helper: requireSessionUser located in lib/request-auth.ts.
- Flow: Queried at the beginning of all client-triggered API route handlers (e.g. app/api/items/route.ts). If the session user ID cannot be resolved, the API returns a 401 Unauthorized JSON error response.

## Ingest Webhook Verification
For automated external ingestion channels (such as Chrome extensions, Telegram capture bots, or email receivers) where standard browser cookies are absent:
- Helper: requireIngestUser in lib/request-auth.ts.
- Validation: If no standard user session exists, the helper checks incoming request headers. It validates that the x-internal-ingest-token matches the secret stored in env.INTERNAL_INGEST_TOKEN.
- User Delegation: If token validation succeeds, the handler authorizes the write operation on behalf of the user ID supplied inside the x-recall-user-id request header, enabling integrations to capture content securely.

## Subscription Plan Limit Enforcement
Access control also regulates write limits based on the user's payment tier:
- Plan Levels: Users are assigned to one of three plans inside the database: free, starter, or pro.
- Monthly Saves Counter: Prior to saving a captured item, lib/ingest.ts queries the saves_this_month column in the users table.
- Limit Check: The canUserSave utility in lib/plan-limits.ts compares this counter against the maximum saves limit defined for the user's plan.
  - Free plan: Caps saves at 50 per month, file uploads at 10MB, and reminder alerts at 2. Blocks email ingestion.
  - Starter plan: Caps saves at 100 per month, file uploads at 10MB, and reminders at 30. Enables email ingestion.
  - Pro plan: Provides unlimited saves, 50MB file uploads, and unlimited reminders.
- Self-Hosted Mode Bypass: If SELF_HOSTED is set to true, the canUserSave checks default to maximum values (Infinity saves and reminders), bypassing hosted billing limits.

## Security Constraints
- AGENT AVOID: Never query user items without explicitly filtering the SQL query by the active user ID resolved from auth. This prevents cross-tenant data leakage.
- AGENT NOTE: Always invoke requireIngestUser rather than requireSessionUser inside API endpoints that receive webhook integrations to support secure remote captures.

## Update Triggers
- When the NextAuth route matcher pattern in proxy.ts is modified.
- When changing plan tiers or usage limits inside lib/plan-limits.ts.
- When altering ingest token header validation parameters in lib/request-auth.ts.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Connects access controls.
- [docs/auth/auth-flow.md](file:///e:/Projects/recallQ/docs/auth/auth-flow.md) — Auth providers.
- [docs/api/route-handlers.md](file:///e:/Projects/recallQ/docs/api/route-handlers.md) — REST endpoints.

AGENT OWNER: lib/request-auth.ts
AGENT UPDATE: docs/auth/authorization.md
