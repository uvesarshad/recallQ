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
- `items`: central archive table. Types are `url`, `text`, `file`, `note`; sources include `web`, `pwa-share`, `telegram`, `email`, `extension`, `mobile`, and `manual`. `url_host` stores normalized link hosts for relation/search hot paths.
- `item_tombstones`: deleted item IDs and timestamps for local-first delta sync.
- `item_relations`: AI/user-created graph edges between items.
- `item_comments`: threaded item notes.
- `reminders`: due reminder queue and delivery state.
- `personal_access_tokens`: hashed bearer tokens for extension/mobile/API clients.
- `worker_heartbeats`: liveness rows for enrichment and reminder workers.
- `rate_limits`: fixed-window counters for API abuse protection.
- `device_push_tokens`: Expo Push tokens for mobile reminder delivery.
- `jobs`: generic Postgres-backed job queue for crawl, parse, summarize, embed, relation, reminder, import, webhook, and archive work.
- `import_sessions`, `import_session_items`: resumable import progress, duplicate/error counts, and created item mapping.
- `automation_rules`, `automation_rule_runs`: user rule definitions and audit trail for capture/import/RSS/enrichment automation.
- `archive_assets`: durable per-item archive assets for HTML, screenshots, PDFs, original files, extracted text, thumbnails, and opt-in video stubs, with retention/cleanup metadata.
- `item_highlights`: reader highlights with quote, note, color, optional text range, and user/item ownership.
- `smart_saved_searches`: user-owned dynamic saved advanced-search definitions.
- `rss_feeds`, `rss_feed_entries`: RSS subscriptions, poll status/error fields, and idempotent feed-entry-to-item mapping.
- `webhook_subscriptions`, `webhook_deliveries`: outbound webhook endpoint config, encrypted signing secrets, subscribed events, delivery attempts, retry status, and response/error tracking.
- `query_embedding_cache`: normalized search/chat query embeddings keyed by hash, provider, and model to reduce repeated Gemini embedding latency and cost.
- `operation_logs`: best-effort AI, crawl, relation, and job observability events with provider/model, attempts, duration, token estimates, crawl bytes, and failure reason.
- `ai_prompt_preferences`: plan-gated user enrichment prompt preferences with bounded custom instructions.

## Important Indexes
- `idx_items_user_id`, `idx_items_created_at`: feed and ownership hot paths.
- `idx_items_tags`: GIN tag search.
- `idx_items_tsv`: persisted full-text search.
- `idx_items_embedding`: pgvector cosine search.
- `idx_items_pending_enrichment`: partial `items(created_at) WHERE enriched = false` for the enrichment worker backlog scan.
- `idx_items_enrichment_claim`: partial pending/retrying/processing enrichment claim scan.
- `idx_items_user_url_host`: same-host relation lookup.
- `idx_item_tombstones_user_deleted`: user-scoped tombstone delta-sync scan.
- `idx_reminders_due`: partial reminder worker due scan.
- `idx_pat_token_hash`, `idx_pat_user`: bearer-token lookup/listing.
- `idx_device_push_tokens_user`: active mobile push fan-out.
- `idx_accounts_provider_lookup`, `idx_accounts_user_id`: OAuth sign-in and account revocation.
- `idx_jobs_claim`, `idx_jobs_user_created`, `idx_jobs_item`: generic job queue claim and inspection paths.
- `idx_import_sessions_user_created`, `idx_import_sessions_status`, `idx_import_session_items_session`, `idx_import_session_items_item`: import progress and created-item lookup paths.
- `idx_automation_rules_user_event`, `idx_automation_rule_runs_rule_created`, `idx_automation_rule_runs_user_created`: rule matching and audit lookup paths.
- `idx_archive_assets_item_kind`, `idx_archive_assets_user_created`, `idx_archive_assets_item_kind_hash`: archive asset lookup and dedup paths.
- `idx_archive_assets_retention_due`, `idx_archive_assets_deleted`: archive retention sweeps and deferred deleted-asset cleanup.
- `idx_items_reader_state`, `idx_items_read_later`, `idx_items_favorite`, `idx_items_archived`: reading-state and state-filter feed paths.
- `idx_items_link_review_queue`: broken-link review queue over broken URL items.
- `idx_item_highlights_item`, `idx_item_highlights_user_created`, `idx_item_highlights_quote`: item highlight listing and text search.
- `idx_items_archive_status`, `idx_items_link_broken`: archive job and broken-link review filters.
- `idx_smart_saved_searches_user_created`, `idx_smart_saved_searches_user_name`: saved-search listing and unique naming.
- `idx_rss_feeds_due`, `idx_rss_feeds_user`, `idx_rss_feed_entries_feed`: RSS poll queue and feed history paths.
- `idx_webhook_subscriptions_user_created`, `idx_webhook_deliveries_subscription_created`, `idx_webhook_deliveries_pending`: webhook subscription listing and delivery retry paths.
- `idx_query_embedding_cache_last_used`, `idx_query_embedding_cache_expires`: query-cache cleanup and inspection paths.
- `idx_operation_logs_item_created`, `idx_operation_logs_job_created`, `idx_operation_logs_operation_created`: per-item, per-job, and operation summary inspection paths.
- `idx_collections_public_slug`, `idx_collections_public_enabled`: public collection share lookup and inspection paths.

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
- `020_items_enrichment_claiming.sql`: enrichment status, lock, attempt, and error columns plus claim index.
- `021_item_tombstones.sql`: item deletion tombstone table and delta-sync index.
- `022_items_url_host.sql`: normalized `items.url_host` backfill and `(user_id, url_host)` index.
- `023_jobs.sql`: generic Postgres job table with status, attempts, locks, payload/result, and claim indexes.
- `024_import_sessions.sql`: import session and imported-item mapping tables.
- `025_automation_rules.sql`: rule engine definitions and run audit tables.
- `026_archive_assets.sql`: durable archive asset records for HTML, screenshots, PDFs, original files, extracted text, and thumbnails.
- `027_items_archive_link_health.sql`: item archive status, archive attempts, and link health columns/indexes.
- `032_smart_saved_searches.sql`: dynamic saved advanced-search definitions.
- `034_rss_feeds.sql`: RSS feed subscription and idempotent entry mapping tables.
- `035_items_rss_source.sql`: widens `items.source` to include `rss`.
- `036_items_reader_review_state.sql`: item reading progress/state, favorite/archive/read-later flags, and link-review metadata.
- `037_item_highlights.sql`: highlight records with quote/note text-search indexes.
- `039_query_embedding_cache.sql`: query embedding cache table for normalized search/chat queries.
- `040_operation_logs.sql`: AI/crawl/job operation log table for cost and reliability observability.
- `043_webhook_subscriptions.sql`: outbound webhook subscriptions and delivery attempts with encrypted signing secrets and retry indexes.
- `046_public_collections.sql`: public collection sharing columns and slug indexes.
- `047_ai_prompt_preferences.sql`: bounded custom enrichment prompt preferences.
- `041_archive_asset_retention.sql`: archive asset retention expiry/deleted metadata, video asset kind stub, and cleanup indexes.

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
