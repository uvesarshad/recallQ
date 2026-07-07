# Per-Route Security Audit

> Scope: Endpoint guards, cross-cutting controls, and remaining security follow-ups for `apps/web/app/api/v1/*`.
> Last updated: 2026-07-07

## How to Read This Audit
- Auth: route gates business logic behind session, bearer, internal token, or webhook signature.
- Validation: request bodies/queries are schema-checked or tightly bounded.
- Plan limit: billable resource use is checked server-side.
- Rate limit: local Postgres fixed-window limiting is present where abuse cost matters.

## Cross-Cutting Controls
- Session auth: NextAuth guards web routes and session-only API routes.
- Bearer auth: `requireUser(req)` supports extension/mobile/API clients through hashed personal access tokens.
- Ingest auth: `requireIngestUser(req)` supports session, bearer, and internal-token capture channels.
- Response envelopes: API errors should use shared helpers instead of leaking stack traces.
- Rate limiting: auth token issue, chat, ingest, actions preview, selected billing/device routes, and credentials authorize are limited.
- Security headers: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, and nonce-based CSP Report-Only live in config/proxy.
- SSRF guard: user-supplied URL scraping and scraped image placeholder fetches go through `apps/web/lib/url-safety.ts`, which rejects unsafe protocols, localhost/private/link-local/reserved IPs, embedded credentials, and unsafe redirects.
- Atomic ingest accounting: `apps/web/lib/ingest.ts` locks the user row and commits save count, storage bytes, item insert, folder resolution, and reminder insert in one transaction.

## Route Summary

| Endpoint group | Auth | Validation | Plan limit | Rate limit | Notes |
|---|---|---|---|---|---|
| `/api/auth/[...nextauth]` | NextAuth | NextAuth | N/A | credentials limited | OAuth callbacks stay unversioned. |
| `/api/v1/auth/tokens` | email/password or session | Zod | N/A | POST limited | GET/DELETE session-only. |
| `/api/v1/auth/oauth/token` | provider ID token | Zod + JWKS | N/A | limited | Mobile OAuth exchange. |
| `/api/v1/health` | public | no body | N/A | N/A | DB + worker heartbeat only. |
| `/api/v1/ingest` | session/bearer/internal | Zod | transactional | limited | Supports `mobile` source. |
| `/api/v1/ingest/file` | session/bearer/internal | multipart checks | transactional | shared ingest bucket | MIME + hard size checked first. |
| `/api/v1/items` | session or bearer | bounded query | N/A | watch logs | Ownership filter in SQL. |
| `/api/v1/items/[id]` | session; DELETE also bearer | Zod on PATCH | N/A | cheap path | Ownership filter in SQL. |
| `/api/v1/search` | session | query length cap | N/A | watch logs | User-scoped search helpers. |
| `/api/v1/chat` | session | `ChatRequestSchema` | chat quota | limited | Streams RAG answer. |
| `/api/v1/graph` | session | no body | N/A | N/A | User-scoped canvas payload. |
| `/api/v1/collections` | session | Zod on writes | N/A | N/A | Ownership filter. |
| `/api/v1/reminders` | session | Zod on writes | reminder cap via ingest/create | N/A | Ownership filter. |
| `/api/v1/devices/push` | session or bearer | Zod | N/A | limited | Mobile token registration. |
| `/api/v1/actions/preview` | session | Zod | AI cost surface | limited | Gemini call. |
| `/api/v1/payments/*` | session or provider signature | Zod/signature | N/A | selected routes limited | Razorpay/Stripe signatures. |
| `/api/v1/email/inbound` | Resend signature + address | schema | ingest limits | provider side | Capture path. |
| `/api/v1/telegram/webhook` | Telegram secret | webhook shape | ingest limits | provider side | Capture path. |
| `/api/v1/files/[...path]` | session | path checks | N/A | N/A | Session + user path prefix + traversal guard. |

## Still Deferred
1. Flip CSP from Report-Only to enforcing after production reports are clean.
2. Add a CORS allow-list for the Chrome extension origin once the stable extension ID exists.
3. Add durable server-side tombstones so extension/mobile delta sync can propagate server-side deletes.
4. Add worker claim/status columns if multiple enrichment workers will run concurrently.

AGENT OWNER: apps/web/lib/rate-limit.ts, apps/web/proxy.ts, apps/web/lib/url-safety.ts
AGENT UPDATE: docs/security-audit.md
