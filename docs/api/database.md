# Database Schema and Migrations

> Scope: Documents relational database schemas, tables, relationships, indexes, pgvector integration, and migration files.
> Rendering context: Server-side
> Project tier: 4
> Last updated: 2026-05-22

## Overview
Recall utilizes a local, system-installed PostgreSQL database as its primary persistent storage. Database connections are handled through an active pg Pool in lib/db.ts, performing raw SQL query statements. The shared query helper retries once with a fresh pool when a stale development connection reports a closed or terminated connection. The database features 768-dimensional vector embeddings managed via the pgvector extension for high-performance cosine similarity searches.

## Database Tables Map

- users: Core user profiles. Includes unique UUID primary key, name, email (unique), password_hash for email/password accounts, emailVerified timestamp, avatar image URL, telegram_chat_id (unique), telegram_link_token (unique), inbound_email_address (unique), active plan tier (free, starter, pro), saves_this_month integer, push_subscription JSONB, timezone (defaults to Asia/Kolkata), bio, consents, and Razorpay billing identifiers.
- accounts: NextAuth social login mapping. Links user UUIDs to Google OAuth provider accounts.
- sessions: NextAuth browser session mapping. Links user UUIDs to active tokens and expiration dates.
- verification_token: Legacy NextAuth email verification token table. Has primary composite keys and is retained for compatibility with earlier installs.
- password_reset_tokens: One-time email password reset records. Stores a reset UUID, user UUID, SHA-256 token hash, expiration timestamp, optional used_at timestamp, and created_at timestamp.
- collections: Archive folders. Stores collection UUID, owner user UUID, folder name, color, and icon names.
- items: The central content table. Stores item UUID, owner user UUID, collection UUID (nullable), type (url, text, file, note), raw URLs, raw extracted body text, local file paths, file metadata, AI-enriched titles, summaries, tags (text array), image URLs, capture sources, capture notes, reminder times, enrichment statuses, and canvas coordinates.
- item_relations: Similarity graph edges. Stores relation UUID, owner user UUID, item_a_id, item_b_id, relation_type (ai_similar, ai_same_domain, ai_topic, user_linked), connection strength (0.0 to 1.0), and timestamps. Has unique key composite constraints.
- item_comments: Threaded notes. Stores comment UUID, item UUID, user UUID, body text, and timestamps.
- reminders: Reminders queue. Stores reminder UUID, item UUID, user UUID, remind_at timestamp, dispatch channels (text array: email, telegram, push), and sent flags.
- personal_access_tokens: Bearer tokens for non-web clients (Chrome extension, iOS/Android). Columns: id (UUID), user_id (UUID FK → users.id), device_name (TEXT), token_hash (SHA-256 base64url of the raw token, unique), prefix (first 8 chars of the raw token's random portion, shown in UI), scopes (TEXT[], defaults to {full}), last_used_at (TIMESTAMPTZ), created_at, revoked_at. The raw token is only returned at issue time and cannot be recovered. Consulted by lib/request-auth.ts on every request that carries an `Authorization: Bearer …` header.
- worker_heartbeats: Liveness tracking for the background workers. Columns: worker_name (TEXT primary key — `enrichment` or `reminders`), last_heartbeat_at (TIMESTAMPTZ, defaults to now()), pid (INTEGER), hostname (TEXT). Each worker upserts its row every 30 seconds via apps/web/lib/worker-heartbeat.ts. The /api/v1/health endpoint reports a worker as `down` when its heartbeat is older than 5 minutes.
- rate_limits: Fixed-window counter backing apps/web/lib/rate-limit.ts. Columns: bucket_key (TEXT primary key like `auth-tokens:ip:1.2.3.4` or `chat:user:<uuid>`), count (INTEGER), window_started_at (TIMESTAMPTZ). The helper does an atomic INSERT ... ON CONFLICT that either bumps the counter or resets the window. Indexed on window_started_at for the eventual GC job.

## Database Indexes
- GIN Index: idx_items_tags is a generalized inverted index placed on the items tags array column to accelerate tag searches.
- Vector Index: idx_items_embedding is an ivfflat index built on the items embedding column using vector_cosine_ops with lists set to 100 to speed up semantic cosine distance searches.
- Partial Indexes: idx_items_reminder (filters items where reminder_sent is false) and idx_reminders_due (filters reminders where sent is false) limit index sizes to active pending reminders only.
- Relationships Indexes: Placed on item_relations item_a_id, item_b_id, and item_comments item_id to speed up graph fetches and comment loads.
- Partial Token Indexes: idx_pat_token_hash (lookup by hash on every bearer-authed request) and idx_pat_user (lists a user's active tokens in Settings → Connected Devices) both filter `WHERE revoked_at IS NULL` to stay tight.

## Migration Files List
Migrations are located inside the migrations directory and are executed sequentially by Node.js scripts:
- 001_initial.sql: Establishes base NextAuth tables, collections, items, item_relations, reminders, and core indexes.
- 002_add_item_image.sql: Adds the image_url column to the items table to store scraped web images.
- 003_enable_embeddings.sql: Attempts to activate the pgvector extension and appends the 768-dimensional embedding vector column to the items table.
- 004_profile_and_comments.sql: Appends bio, timezone, and consent fields to the users table, and creates the item_comments table.
- 005_add_billing.sql: Appends Razorpay customer, plan, and subscription details to the users table.
- 006_chat_quota.sql: Appends daily chat quota tracking to users.
- 007_search_index.sql: Adds search-oriented item indexes and text search helpers.
- 008_push_and_storage_quota.sql: Appends storage quota and file usage columns to users.
- 009_password_auth.sql: Adds users.password_hash for local email/password authentication.
- 010_password_reset_tokens.sql: Creates password_reset_tokens and indexes for local email/password reset links.
- 011_personal_access_tokens.sql: Creates personal_access_tokens and partial indexes for bearer-token auth from the Chrome extension and the mobile apps. Web continues to use NextAuth session cookies.
- 012_worker_heartbeats.sql: Creates worker_heartbeats so /api/v1/health can report whether the enrichment and reminders daemons are alive.
- 013_rate_limits.sql: Creates rate_limits for the Postgres-backed token-bucket-ish rate limiter introduced in Stage 5 — no Redis required.
- 014_item_blur.sql: Adds items.blur_data_url (TEXT). Tiny base64 JPEG (~200-400 bytes) populated during enrichment by apps/web/lib/blur.ts via sharp; consumed by the ItemCard's next/image placeholder to prevent CLS.
- 015_stripe_billing.sql: Adds Stripe-specific columns (stripe_customer_id, stripe_subscription_id, stripe_price_id) alongside the existing Razorpay columns, plus a `billing_provider` discriminator column (`razorpay` | `stripe` | NULL) that endpoints and webhooks read to route correctly. A user can be on at most one provider at a time. Shared subscription-state columns (subscription_plan, subscription_status, subscription_current_*, subscription_cancel_at_cycle_end) are provider-agnostic — both adapters write the same shape so plan-limit checks don't care which billing system the user is on.
- 016_device_push_tokens.sql: Per-device Expo Push token registry for mobile reminder delivery. Columns: id (UUID), user_id (FK), token (UNIQUE — `ExponentPushToken[…]`), platform (ios | android | web), device_name, created_at, last_seen_at, revoked_at. Partial index `(user_id) WHERE revoked_at IS NULL` for fan-out lookups. The reminder worker auto-marks tokens revoked when Expo returns `DeviceNotRegistered`.

## Update Triggers
- When a database migration file (.sql) is added, removed, or modified.
- When an index is added or altered.
- When a model interface or table column definition changes in lib/types.ts.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Tech stack context.
- [docs/api/route-handlers.md](file:///e:/Projects/recallQ/docs/api/route-handlers.md) — API queries.
- [docs/api/external-services.md](file:///e:/Projects/recallQ/docs/api/external-services.md) — Integrations context.

AGENT OWNER: apps/web/lib/db.ts
AGENT UPDATE: docs/api/database.md
