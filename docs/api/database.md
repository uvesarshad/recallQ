# Database Schema and Migrations

> Scope: PostgreSQL schema, tables, relationships, indexes, pgvector integration, and migration files.
> Rendering context: Server-side
> Project tier: 4
> Last updated: 2026-07-07

## Overview
Recall uses PostgreSQL through the raw `pg` Pool client in `apps/web/lib/db.ts`. pgvector stores 768-dimensional Gemini embeddings for semantic search and relation building. Migrations live at the workspace root under `migrations/` and run through `pnpm db:migrate`.

## Database Tables Map
- `users`: profiles, auth-related fields, plan, save/storage usage, push subscription, billing identifiers, timezone, and preferences.
- `accounts`, `sessions`, `verification_token`: NextAuth persistence.
- `password_reset_tokens`: local password reset tokens.
- `collections`: user-owned folders.
- `items`: central archive table. Types are `url`, `text`, `file`, `note`; sources include `web`, `pwa-share`, `telegram`, `email`, `extension`, `mobile`, and `manual`.
- `item_relations`: AI/user-created graph edges between items.
- `item_comments`: threaded item notes.
- `reminders`: due reminder queue and delivery state.
- `personal_access_tokens`: hashed bearer tokens for extension/mobile/API clients.
- `worker_heartbeats`: liveness rows for enrichment and reminder workers.
- `rate_limits`: fixed-window counters for API abuse protection.
- `device_push_tokens`: Expo Push tokens for mobile reminder delivery.

## Important Indexes
- `idx_items_user_id`, `idx_items_created_at`: feed and ownership hot paths.
- `idx_items_tags`: GIN tag search.
- `idx_items_tsv`: persisted full-text search.
- `idx_items_embedding`: pgvector cosine search.
- `idx_items_pending_enrichment`: partial `items(created_at) WHERE enriched = false` for the enrichment worker backlog scan.
- `idx_reminders_due`: partial reminder worker due scan.
- `idx_pat_token_hash`, `idx_pat_user`: bearer-token lookup/listing.
- `idx_device_push_tokens_user`: active mobile push fan-out.
- `idx_accounts_provider_lookup`, `idx_accounts_user_id`: OAuth sign-in and account revocation.

## Migration Files List
- `001_initial.sql`: base NextAuth, users, collections, items, item_relations, reminders, and core indexes.
- `002_add_item_image.sql`: item preview image URL.
- `003_enable_embeddings.sql`: pgvector extension and item embedding column.
- `004_profile_and_comments.sql`: profile fields and comments.
- `005_add_billing.sql`: Razorpay billing fields.
- `006_chat_quota.sql`: daily chat quota counters.
- `007_search_index.sql`: full-text search helpers and indexes.
- `008_push_and_storage_quota.sql`: storage usage tracking.
- `009_password_auth.sql`: password hash.
- `010_password_reset_tokens.sql`: password reset table.
- `011_personal_access_tokens.sql`: bearer-token table and indexes.
- `012_worker_heartbeats.sql`: worker heartbeat table.
- `013_rate_limits.sql`: Postgres-backed rate limiter.
- `014_item_blur.sql`: `items.blur_data_url`.
- `015_stripe_billing.sql`: Stripe billing fields and provider discriminator.
- `016_device_push_tokens.sql`: Expo Push token registry.
- `017_accounts_indexes.sql`: OAuth account indexes.
- `018_items_enrichment_pending_index.sql`: partial pending-enrichment index.
- `019_items_mobile_source.sql`: widens `items.source` to include `mobile`.

## Update Triggers
- When a migration file is added, removed, or modified.
- When an index is added or altered.
- When a model interface or table column definition changes in `apps/web/lib/types.ts`.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) - Tech stack context.
- [docs/api/route-handlers.md](file:///e:/Projects/recallQ/docs/api/route-handlers.md) - API queries.
- [docs/api/external-services.md](file:///e:/Projects/recallQ/docs/api/external-services.md) - Integration context.

AGENT OWNER: apps/web/lib/db.ts
AGENT UPDATE: docs/api/database.md
