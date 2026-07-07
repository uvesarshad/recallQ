# Performance Audit

> Scope: Backend query patterns, indexes, bundle composition, worker cost, image strategy, and operational growth on the web tier.
> Last updated: 2026-07-07

## Database Hot Paths

| Path | Pattern | Indexes / controls | Notes |
|---|---|---|---|
| `GET /api/v1/items` | user-scoped feed query with optional filters | `idx_items_user_id`, `idx_items_created_at` | Limit clamped 1-50; delta sync uses `updated_at ASC`. |
| `GET /api/v1/items/[id]` | single item by id + owner | primary key + owner filter | Cheap. |
| `GET /api/v1/search` | FTS + optional semantic merge | `idx_items_tsv`, `idx_items_embedding` | Falls back when vector support is unavailable. |
| `POST /api/v1/chat` | semantic retrieval + Gemini stream | `idx_items_embedding` | Rate-limited 30/user/hour. |
| `POST /api/v1/ingest` | user row lock + item/reminder writes | `users` PK, `collections` lookup | Save/storage accounting is transactional. |
| Enrichment worker | pending item scan | `idx_items_pending_enrichment` | Migration 018 keeps backlog scans tight. |
| Reminder worker | due reminder scan | `idx_reminders_due` | Partial index on unsent reminders. |
| OAuth sign-in | provider lookup | `idx_accounts_provider_lookup` | Added in migration 017. |
| Push fan-out | active device tokens | `idx_device_push_tokens_user` | Partial active-token index. |

## Index Inventory
- Initial/core: item owner, created-at, tags, reminders, relations.
- Search: full-text `idx_items_tsv`, vector `idx_items_embedding`.
- Auth: personal access token hash/user indexes, account provider/user indexes.
- Workers: worker heartbeats primary key, pending enrichment partial index, due reminders partial index.
- Billing/push/rate limits: Stripe customer/subscription indexes, active device token index, rate-limit window index.

## Bundle and Lazy Loading
- `output: "standalone"` is enabled in `apps/web/next.config.mjs`.
- `@xyflow/react` is lazy-loaded only on `/app/canvas`.
- `react-force-graph-2d` was removed.
- `optimizePackageImports` strips unused `lucide-react` icons.
- Heavy parsing/AI dependencies stay server-side; do not import worker/server helpers from client components.
- `pnpm analyze` is wired to `@next/bundle-analyzer`.

## Image and Remote Fetch Strategy
- Scraped thumbnails render with `next/image` and blur placeholders.
- `apps/web/lib/blur.ts` fetches remote images through `safeFetch`, checks response status, enforces a 5 MB cap, and decodes with Sharp.
- `safeFetch` adds DNS/IP/redirect validation for SSRF protection. This adds a small DNS cost per remote URL/image but prevents high-risk internal network fetches.

## Worker Cost
- Enrichment worker idles cheaply: one pending scan every 5 seconds, then per-item fetch/parse/Gemini/embed/blur/update.
- Reminder worker runs every 60 seconds, handles due reminders, monthly save resets, and hourly stale-row GC.
- Two workers plus the web app maintain separate pg pools; current connection budget is acceptable for a single-server deployment.

## Operational Growth
- `items`, `item_relations`, files, and reminders grow with user archives.
- `rate_limits` and expired password reset tokens are swept hourly by the reminder worker.
- Revoked PATs and device push tokens remain for audit/visibility; consider periodic hard-delete later.
- Durable archive assets, import sessions, and tombstones are still future work and should include explicit GC/index plans.

## Priority Follow-Ups
1. Add worker claim/status columns before running multiple enrichment workers concurrently.
2. Add server-side tombstones for delete propagation to local-first clients.
3. Add normalized URL host column and `(user_id, url_host)` index for same-domain relation building.
4. Add search pagination and query embedding cache.
5. Extract heavy file parsing into a dedicated worker if file ingestion volume grows.
6. Add Docker compose with Postgres + pgvector, web, and worker services.

AGENT OWNER: apps/web/lib/, apps/web/workers/, migrations/
AGENT UPDATE: docs/performance-audit.md
