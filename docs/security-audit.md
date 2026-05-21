# Per-Route Security Audit

> Scope: One-row-per-endpoint audit of `apps/web/app/api/v1/*` and the legacy `/api/auth/[...nextauth]` mount. Documents which guards are in place and which need follow-up.
> Last updated: 2026-05-22

## How to read this table

Every column should be ✅ for a route that's safe to call from any client. Symbols:

- ✅ — guard present and correct
- 🔒 — guard intentionally not applicable (e.g. webhook with signature, public health endpoint)
- ⚠️ — gap that needs attention; the **Notes** column points at the follow-up

Columns:

- **Auth** — the request can only reach the business logic with a valid session cookie, bearer token, internal token, or webhook signature.
- **Validation** — request body (if any) is validated against a Zod schema via `parseBody` from `apps/web/lib/api-response.ts` or `safeParse` directly.
- **Plan limit** — where the route consumes a billable resource (capture, storage, chat), the per-plan limit is enforced before the work runs.
- **Rate limit** — Stage 5 burst protection via `apps/web/lib/rate-limit.ts`.

## Routes

| Endpoint | Method | Auth | Validation | Plan limit | Rate limit | Notes |
|---|---|---|---|---|---|---|
| `/api/auth/[...nextauth]` | * | 🔒 NextAuth catch-all | 🔒 NextAuth handled | 🔒 N/A | ⚠️ | Stage 5 didn't rate-limit NextAuth's `/credentials/signin`. The parallel `/api/v1/auth/tokens` POST (which mints PATs) is rate-limited; equivalent IP+email limit on the NextAuth credentials callback is tracked as Stage 5 follow-up. |
| `/api/v1/auth/tokens` | POST | ✅ email+password | ✅ `TokenIssueInputSchema` | 🔒 N/A | ✅ 5/IP/15min + 10/email/hour | |
| `/api/v1/auth/tokens` | GET | ✅ session only | 🔒 no body | 🔒 N/A | ⚠️ | Read-only, cookie-only — abuse cost negligible. Defer rate limit. |
| `/api/v1/auth/tokens/[id]` | DELETE | ✅ session only | 🔒 no body | 🔒 N/A | ⚠️ | Same rationale. |
| `/api/v1/health` | GET | 🔒 public | 🔒 no body | 🔒 N/A | 🔒 N/A | Intentionally unauthenticated for CloudPanel / uptime probes. Does no work beyond two `SELECT`s. |
| `/api/v1/items` | GET | ✅ `requireSessionUser` | 🔒 query string | 🔒 N/A | ⚠️ | Heavy query if `limit` were unbounded — limit is already capped at 50 in code. Add per-user rate limit if abuse is observed. |
| `/api/v1/items` | POST | ✅ `requireIngestUser` | ✅ `ingestPayloadSchema` | ✅ via `ingestItem` | ⚠️ | Calls into `lib/ingest.ts` which checks plan limit. Add the same `ingest:user:<id>` rate-limit bucket here for consistency with `/ingest` (TODO). |
| `/api/v1/items/[id]` | GET | ✅ `requireSessionUser` | 🔒 no body | 🔒 N/A | 🔒 N/A | Ownership filter in SQL (`WHERE user_id = $1`). |
| `/api/v1/items/[id]` | PATCH | ✅ `requireSessionUser` | ✅ Zod | 🔒 N/A | ⚠️ | Per-user rate limit not applied; PATCH is cheap. Watch in logs. |
| `/api/v1/items/[id]` | DELETE | ✅ `requireSessionUser` | 🔒 no body | 🔒 N/A | 🔒 N/A | Idempotent; ownership filter in SQL. |
| `/api/v1/items/[id]/comments` | GET/POST | ✅ session | ✅ Zod on POST | 🔒 N/A | ⚠️ | POST is cheap. |
| `/api/v1/items/[id]/related` | GET | ✅ session | 🔒 no body | 🔒 N/A | 🔒 N/A | Read-only ownership-filtered SELECT. |
| `/api/v1/items/batch` | POST | ✅ `requireSessionUser` | ✅ Zod | 🔒 N/A | ⚠️ | Batch capped in code; rate limit deferred. |
| `/api/v1/ingest` | POST | ✅ `requireIngestUser` (session / bearer / internal) | ✅ Zod (single + bulk) | ✅ via `ingestItem` | ✅ 60/user/min | |
| `/api/v1/ingest/file` | POST | ✅ `requireIngestUser` | ✅ multipart validation | ✅ via `ingestItem` | ⚠️ | File ingest doesn't yet share the `ingest:user` bucket. TODO: add the same `rateLimit({ key: ingest:user:..., limit: 60, windowMs: 60_000 })` block. |
| `/api/v1/chat` | POST | ✅ `requireSessionUser` | 🔒 chat history (no Zod schema yet) | ✅ daily quota by plan | ✅ 30/user/hour | Add a `ChatRequestSchema` to `@recall/api-schema` and validate in Stage 6 / Stage 8 (extension consumer needs the schema anyway). |
| `/api/v1/search` | GET | ✅ `requireSessionUser` | ✅ query length capped | 🔒 N/A | ⚠️ | Query length 500 cap is the validation. Add per-user rate limit if hot path. |
| `/api/v1/graph` | GET | ✅ `requireSessionUser` | 🔒 no body | 🔒 N/A | 🔒 N/A | Ownership filter in SQL. |
| `/api/v1/collections` | GET/POST | ✅ session | ✅ Zod on POST | 🔒 N/A | 🔒 N/A | |
| `/api/v1/collections/[id]` | PATCH/DELETE | ✅ session | ✅ Zod on PATCH | 🔒 N/A | 🔒 N/A | Ownership filter in SQL. |
| `/api/v1/me` | GET | ✅ session | 🔒 no body | 🔒 N/A | 🔒 N/A | |
| `/api/v1/user/telegram-link` | POST | ✅ session | ✅ Zod | 🔒 N/A | ⚠️ | Generates a one-time link token. Should be rate-limited (5/user/hour) to avoid token spam; TODO. |
| `/api/v1/user/telegram-status` | GET | ✅ session | 🔒 no body | 🔒 N/A | 🔒 N/A | |
| `/api/v1/user/telegram-token` | POST | ✅ session | 🔒 no body | 🔒 N/A | ⚠️ | Rotates the user's ingest token. Should be rate-limited (5/user/hour); TODO. |
| `/api/v1/reminders` | GET/POST | ✅ session | ✅ Zod on POST | 🔒 N/A | 🔒 N/A | |
| `/api/v1/reminders/[id]` | PATCH/DELETE | ✅ session | ✅ Zod on PATCH | 🔒 N/A | 🔒 N/A | Ownership filter in SQL. |
| `/api/v1/push-subscription` | POST | ✅ session | ✅ Zod | 🔒 N/A | 🔒 N/A | Browser push subscription registration. |
| `/api/v1/actions/preview` | POST | ✅ session | ✅ Zod | 🔒 N/A | ⚠️ | Calls Gemini on every request — meaningful cost surface. Add a `preview:user/hour` rate limit (e.g. 60/hour). TODO. |
| `/api/v1/payments/create-subscription` | POST | ✅ session | ✅ Zod | 🔒 N/A | ⚠️ | Razorpay subscription creation is rate-limited downstream by Razorpay itself; add local cap to short-circuit attacks. TODO. |
| `/api/v1/payments/cancel-subscription` | POST | ✅ session | 🔒 no body | 🔒 N/A | 🔒 N/A | |
| `/api/v1/payments/webhook` | POST | 🔒 Razorpay HMAC signature (`x-razorpay-signature`) | 🔒 webhook payload | 🔒 N/A | 🔒 N/A | Signature verification gates body parsing. |
| `/api/v1/telegram/webhook` | POST | 🔒 Telegram secret token (`x-telegram-bot-api-secret-token`) | 🔒 webhook payload | ✅ via `ingestItem` | 🔒 N/A | Per-user save limits applied through `lib/ingest.ts`. |
| `/api/v1/email/inbound` | POST | 🔒 Resend webhook signature + per-user inbound address | 🔒 webhook payload | ✅ via `ingestItem` | 🔒 N/A | |
| `/api/v1/files/[...path]` | GET | ✅ session + path-prefix ownership check + path traversal guard | 🔒 path params | 🔒 N/A | 🔒 N/A | Three-layer guard: session, `userId === session.user.id` from path, file_path must start with `FILES_BASE_PATH`. |

## Cross-cutting controls (Stage 5)

- **HTTPS / HSTS.** `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` is set on every response via `apps/web/next.config.mjs`. CloudPanel terminates TLS via Let's Encrypt; the header is harmless over plain HTTP in dev because browsers ignore HSTS without TLS.
- **Clickjacking.** `X-Frame-Options: DENY` plus `frame-ancestors 'none'` in the CSP. The settings page does not embed third-party frames.
- **MIME sniffing.** `X-Content-Type-Options: nosniff`.
- **Referrer leakage.** `Referrer-Policy: strict-origin-when-cross-origin`.
- **Powerful APIs.** `Permissions-Policy` disables camera, microphone, geolocation, and the FLoC `interest-cohort`.
- **Content-Security-Policy.** Set in **Report-Only** mode for production. Allowlist below. Flip to enforcing (`Content-Security-Policy` without the `-Report-Only` suffix) once the report endpoint shows no legitimate violations for a sustained window.
  - `default-src 'self'`
  - `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com` — `'unsafe-inline'` is temporary for the Razorpay checkout shim. Migration to a nonce-based policy is a follow-up.
  - `connect-src 'self' https://api.razorpay.com https://generativelanguage.googleapis.com`
  - `img-src 'self' data: https:` — broad to allow scraped item thumbnails.
  - `style-src 'self' 'unsafe-inline'` — Tailwind v4 emits inline `<style>` for some cases; tighten if/when it stops.
  - `font-src 'self' data:`
  - `frame-src https://api.razorpay.com https://checkout.razorpay.com`
  - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`
- **Cookies.** NextAuth defaults to `secure` + `sameSite: 'lax'` + `httpOnly` when running over HTTPS; verified in production by `auth()` callback.
- **Boot-time hardening.** `apps/web/lib/env.ts` refuses to start in production when `AUTH_SECRET` is shorter than 32 characters or when `DATABASE_URL` points at localhost without an explicit `SELF_HOSTED=true` opt-in (the CloudPanel single-server case).
- **Token storage on non-web clients.** Documented expectations: Chrome extension uses `chrome.storage.local` (encrypted at rest by Chrome under MV3), mobile uses Expo SecureStore (Keychain on iOS, EncryptedSharedPreferences on Android). Wiring lives with each client (Stages 8 and 9).
- **Secrets in repo.** `.gitignore` blocks `.env` and `.env.*` (only `.env.example` is committed). Verified no AUTH_SECRET / DATABASE_URL / API key values are present in the tracked tree.

## Outstanding follow-ups (Stage 5 → Stage 8)

1. Rate limit the NextAuth credentials endpoint (`/api/auth/callback/credentials`) — mirror the IP + email limits from `/api/v1/auth/tokens`.
2. Add `ChatRequestSchema` in `@recall/api-schema` and validate `/api/v1/chat` input.
3. Add a 60/user/hour rate limit on `/api/v1/actions/preview` (every call hits Gemini).
4. Move `/api/v1/items` POST to share the `ingest:user:<id>` rate-limit bucket with `/api/v1/ingest` and `/api/v1/ingest/file`.
5. Rate-limit `/api/v1/user/telegram-link` and `/api/v1/user/telegram-token` (5/user/hour) — they mint one-time tokens.
6. After 1-2 weeks of CSP Report-Only data, flip to enforcing.
7. Migrate Razorpay checkout shim to a nonce-based CSP so we can drop `'unsafe-inline'` from `script-src`.
8. Add a CORS allow-list for the Chrome extension origin once Stage 8 publishes a stable extension ID. Until then `/api/v1/*` is same-origin-only.

AGENT OWNER: apps/web/lib/rate-limit.ts, apps/web/next.config.mjs
AGENT UPDATE: docs/security-audit.md
