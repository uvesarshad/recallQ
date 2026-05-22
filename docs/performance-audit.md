# Performance Audit

> Scope: Backend query patterns, indexes, bundle composition, worker cost, image strategy, and operational growth on the web tier.
> Last updated: 2026-05-22

## Database queries

### Hot paths

| Endpoint | Pattern | Indexes used | Notes |
|---|---|---|---|
| `GET /api/v1/items` (Feed) | `SELECT … FROM items LEFT JOIN collections WHERE user_id=$1 [optional filters] ORDER BY created_at DESC LIMIT 50` | `idx_items_user_id`, `idx_items_created_at` | LIMIT clamped 1-50 with NaN guard. `raw_text` truncated to 240 chars to keep response under ~50 KB. |
| `GET /api/v1/items/[id]` | Single-row by id with ownership filter | Primary key + `user_id` filter | Cheap. |
| `POST /api/v1/search` (hybrid) | (1) Postgres FTS via `tsvector @@ websearch_to_tsquery`, (2) pgvector cosine `embedding <=> $1::vector`, merged | `idx_items_tsv` (GIN), `idx_items_embedding` (ivfflat) | Falls back to ILIKE on missing `tsvector` (graceful). |
| `POST /api/v1/chat` | Same as search retrieval + Gemini call | Same | Rate limited 30/user/hour. |
| `POST /api/v1/devices/push` | Upsert keyed on `token` | UNIQUE constraint on `token` | New rate limit 60/user/hour (Stage 5+1). |
| Reminder worker (60s loop) | `SELECT * FROM reminders WHERE remind_at <= NOW() AND sent = FALSE LIMIT 10` | `idx_reminders_due` (partial: `WHERE sent = FALSE`) | Partial index keeps it tight. |
| Enrichment worker (5s loop) | `SELECT … FROM items WHERE enriched = false ORDER BY created_at ASC LIMIT 5` | `idx_items_user_id` partial? No, full scan with filter | Acceptable when unenriched backlog is small. Could add `WHERE enriched = false` partial index if backlog grows. |
| OAuth sign-in | `SELECT "userId" FROM accounts WHERE provider = $1 AND "providerAccountId" = $2 LIMIT 1` | **Added in migration 017** | Previously sequential scan; now indexed. |
| Push fan-out (in reminder worker) | `SELECT id, token FROM device_push_tokens WHERE user_id = $1 AND revoked_at IS NULL` | `idx_device_push_tokens_user` (partial: `WHERE revoked_at IS NULL`) | Partial index keeps it small. |
| Rate-limit upsert | `INSERT … ON CONFLICT (bucket_key) DO UPDATE …` | Primary key on `bucket_key` | One round-trip per limited request. |

### Index inventory

| Migration | Indexes |
|---|---|
| 001_initial | `idx_items_user_id`, `idx_items_created_at`, `idx_items_tags` (GIN), `idx_items_reminder` (partial), `idx_reminders_due` (partial), `idx_item_relations_a`, `idx_item_relations_b` |
| 003_enable_embeddings | `idx_items_embedding` (ivfflat, vector_cosine_ops, lists=100) |
| 004_profile_and_comments | `idx_item_comments_item_id` |
| 007_search_index | `idx_items_tsv` (GIN on the persisted tsvector column) |
| 010_password_reset_tokens | `idx_password_reset_tokens_user_id`, `idx_password_reset_tokens_expires_at` |
| 011_personal_access_tokens | `idx_pat_token_hash` (partial), `idx_pat_user` (partial) |
| 012_worker_heartbeats | Primary key on `worker_name` |
| 013_rate_limits | `idx_rate_limits_window` |
| 015_stripe_billing | `idx_users_stripe_subscription` (partial), `idx_users_stripe_customer` (partial) |
| 016_device_push_tokens | `idx_device_push_tokens_user` (partial) |
| **017_accounts_indexes** | **`idx_accounts_provider_lookup` (provider + providerAccountId), `idx_accounts_user_id`** |

### Missing / candidate indexes

- **`items` enrichment scan**: the enrichment worker's `WHERE enriched = false` benefits from a partial index `CREATE INDEX … ON items (created_at) WHERE enriched = false`. Skip for now — measured cost is tiny while backlog stays under a few hundred rows. Add if you see slow worker batches in logs.
- **`item_relations` cleanup queries**: no time-based index. Not currently a hot path.

## Bundle and lazy loading

Next.js 16 doesn't print per-route First Load JS in the standard build output (the older format is gone), so I can't quote numbers here. Concrete optimisations in place:

- **`output: 'standalone'`** in `next.config.mjs` for smaller deployable artifacts.
- **`transpilePackages: ['@recall/api-schema']`** so the workspace schema package transpiles inside the web build instead of needing a separate dist step.
- **`optimizePackageImports: ['lucide-react']`** — Next strips unused icon exports.
- **`@xyflow/react` lazy-loaded** via `next/dynamic` in `apps/web/app/(app)/app/canvas/canvas-client.tsx`. ~70 KB JS + the xyflow CSS only ship on `/app/canvas`.
- **`react-force-graph-2d` removed entirely** in Stage 6 along with 24 transitive deps.
- **`@auth/pg-adapter`** and the entire NextAuth bundle are server-only — never in the client tree.
- **Stripe SDK** is server-only (used in `lib/billing-stripe.ts`, never imported by client components).

### Heavy server-only dependencies (fine on server, would be problematic if accidentally imported in a client component)

- `pdf-parse`, `mammoth`, `xlsx`, `cheerio` (workers)
- `sharp` (worker + blur computation)
- `jose` (Apple JWT signing, OAuth verification)
- `stripe`, `resend`, `@google/generative-ai`, `@anthropic-ai/sdk`, `openai`, `web-push`

These are large but only loaded server-side. Watch for accidental client-side imports during code review — anything that ends up in a `"use client"` file tree gets bundled to the browser.

### Recommendations

- Add `@next/bundle-analyzer` (~5 min): `pnpm add -D @next/bundle-analyzer`, wrap config, `ANALYZE=true pnpm build`. Gives a per-route flamegraph. Worth doing once before launch to confirm `/app` first-load JS is under 200 KB.
- Lazy-load `react-dom/server` consumers if any creep in.
- Consider extracting the markdown rendering libs (`mammoth`, `xlsx`) into a separate worker process distinct from `enrichment-worker.ts` if file ingestion becomes a hot path.

## Image strategy

- `next/image` with `unoptimized` is used for scraped third-party thumbnails. `unoptimized` skips the Next.js image optimisation pipeline because we don't know the host domains ahead of time. We still get:
  - **`placeholder="blur"` + base64 `blurDataURL`** populated by the enrichment worker (`lib/blur.ts` using sharp, 16×16 JPEG q40, ~200-400 bytes/item). Prevents CLS.
  - **Lazy loading** (default `loading="lazy"` on `next/image`).
  - **Layout reservation** via `aspect-[16/9]`.
- **Trade-off accepted**: no format conversion (AVIF/WebP) for scraped images, no responsive `srcset`. Adding these requires whitelisting source hosts in `images.remotePatterns`. Tracked as a Stage 6 follow-up.

## Caching headers

| Resource | Caching | Notes |
|---|---|---|
| `/api/v1/health` | `Cache-Control: public, s-maxage=10, stale-while-revalidate=30` | Set explicitly in route handler. |
| `/api/v1/items`, `/api/v1/search`, etc. | None (dynamic, user-scoped) | Correct — no caching for personalized responses. |
| `/api/auth/*` | NextAuth-default no-cache | Correct. |
| Static assets (`/_next/static/*`) | Immutable, 1y | Next.js default. |
| Page HTML (`/app`, `/app/canvas`, etc.) | `dynamic = "force-dynamic"` — no cache | Correct (authenticated). |
| Webhook endpoints (`/api/v1/payments/{webhook,stripe/webhook}`, `/telegram/webhook`, `/email/inbound`) | None | Correct. |

### Recommendations

- Consider `s-maxage=60, stale-while-revalidate=300` on `/api/v1/collections` GET (the folder list rarely changes; the UI reloads it after every Feed render).
- The PWA manifest (`/manifest.json`) and service worker (`/sw.js`) should set `Cache-Control: no-cache` to keep the SW upgrade story sane. Verify in build output.

## Worker cost

| Worker | Loop interval | Per-iteration cost | Notes |
|---|---|---|---|
| `enrichment-worker.ts` | 5s | 1 SELECT (≤ 5 rows) + per-row: fetch scrape (5s timeout), Gemini call (~1-3s), pgvector embed, sharp blur, 1 UPDATE | Low idle cost. Per-item cost dominated by Gemini latency; LISTEN/NOTIFY would only marginally help. |
| `reminder-worker.ts` | 60s | 1 SELECT (≤ 10 rows) + per-row: 1-3 SELECT (item+user+device_push_tokens) + per-channel delivery + 2 UPDATEs | Cheap when idle. Push channel fans out to all of a user's device_push_tokens; cap is implicit (typical user has 1-3 devices). |
| Heartbeat upsert | 30s in each worker | 1 UPSERT | Tiny. |

### Recommendations

- The enrichment worker re-fetches `process.env.RESEND_API_KEY` on every iteration via the lazy `getResend()` getter — confirmed cheap (single object lookup) but worth noting.
- Workers don't share a connection pool — each opens its own `pg.Pool`. Two pools (one per worker) + the web app's pool = three pools per server. Default Postgres max_connections (100) leaves comfortable headroom.

## Operational growth (tables that grow over time)

| Table | Growth rate | GC strategy | Status |
|---|---|---|---|
| `items` | User-driven; unbounded | None (user-deletes only) | Expected. |
| `item_relations` | ~10× items (cosine matches) | None | Expected. May want a periodic re-computation if relations drift. |
| `item_comments` | User-driven | None | Expected. |
| `reminders` | User-driven | None | Expected; `sent = true` rows accumulate. Could archive monthly. |
| `rate_limits` | High — every limited request writes a row OR updates one | **No GC cron yet** | ⚠️ Add: `DELETE FROM rate_limits WHERE window_started_at < now() - interval '1 day'` nightly. Documented as a follow-up. |
| `worker_heartbeats` | Constant: 2 rows (one per worker) | N/A | Tiny. |
| `personal_access_tokens` | Per device sign-in; revoked rows stay | Manual revoke flow | Acceptable. Consider hard-delete of revoked rows older than 90 days. |
| `device_push_tokens` | Per device install; revoked rows stay | Worker auto-marks `DeviceNotRegistered` as revoked | Acceptable. |
| `password_reset_tokens` | User-driven; should expire | Expiry timestamp; no auto-delete | Consider nightly delete of `expires_at < now() - interval '7 days'`. |
| `accounts`, `sessions`, `verification_token` | NextAuth-managed | NextAuth handles sessions expiry on read | Fine. |
| `users` | User-driven | None | Expected. |

## Recent fixes applied during this audit

1. **OAuth account-takeover guard** — `findOrCreateUser` in `apps/web/app/api/v1/auth/oauth/token/route.ts` now only links a new OAuth identity to an existing email-based user when the provider returned `emailVerified: true`. Defence-in-depth against future providers that don't always verify emails.
2. **`accounts` table indexes** (migration 017) — `(provider, providerAccountId)` for the OAuth sign-in lookup, `(userId)` for revocation flows. Was sequential scan; now indexed.
3. **Stripe checkout rate limit** — 5/user/hour on `POST /api/v1/payments/stripe/checkout`.
4. **Stripe portal rate limit** — 10/user/hour on `POST /api/v1/payments/stripe/portal`.
5. **Push device registration rate limit** — 60/user/hour on `POST /api/v1/devices/push`.
6. **`/api/v1/items` limit param hardening** — `parseInt` NaN guard + clamp to `[1, 50]` range.

## Priority follow-ups

### P0 (do before scaling)

Nothing — the OAuth takeover was the only P0 found in this audit and it's fixed.

### P1 — landed 2026-05-22

- ✅ NextAuth credentials authorize is rate-limited (`5/IP/15min + 10/email/hour`).
- ✅ `/api/v1/chat` validates against `ChatRequestSchema` (`@recall/api-schema/src/chat.ts`).
- ✅ `/api/v1/actions/preview` is rate-limited 60/user/hour.
- ✅ `ingest:user:<id>` bucket is shared between `/ingest` and `/ingest/file`.
- ✅ Hourly GC of stale `rate_limits` (> 1d) + expired `password_reset_tokens` (> 7d) runs from the reminder worker.

### P2 — landed 2026-05-22

- ✅ `telegram-token POST` rate-limited 5/user/hour. (`telegram-link` only has DELETE — no token mint to limit.)
- ✅ `payments/create-subscription` rate-limited 5/user/hour.
- ✅ Razorpay shim migrated to nonce-based CSP. Per-request nonce in middleware + `'strict-dynamic'` lets us drop `'unsafe-inline'` for modern browsers (legacy keeps the fallback). CSP stays Report-Only for now.
- ✅ `@next/bundle-analyzer` wired in (`pnpm analyze`).
- ✅ `/api/v1/collections` GET sends `Cache-Control: private, max-age=60`.
- ✅ `/sw.js` and `/manifest.json` send `Cache-Control: no-cache` so the PWA shell can upgrade.

### Still deferred

- Flip CSP from Report-Only to enforcing after 1-2 weeks of clean reports in production.
- CORS allowlist post-extension-ID.
- Partial index `items WHERE enriched = false` on `items.created_at` if enrichment worker backlog grows.
- `item_relations` time-based index / periodic re-computation when embeddings drift.
- Extract `mammoth`/`xlsx`/`pdf-parse` into a separate worker if file ingestion becomes a hot path.
- AVIF/WebP for scraped images (requires whitelisting source hosts in `images.remotePatterns`).
- Archive `sent = true` reminders monthly.
- Hard-delete revoked `personal_access_tokens` older than 90 days.

AGENT OWNER: apps/web/lib/, migrations/
AGENT UPDATE: docs/performance-audit.md
