-- NextAuth's PostgresAdapter and our mobile OAuth-to-PAT exchange
-- (`apps/web/app/api/v1/auth/oauth/token/route.ts`) both look up the
-- `accounts` table by `(provider, providerAccountId)` on every OAuth
-- sign-in. The original schema in 001_initial.sql didn't index this pair,
-- so each sign-in performed a sequential scan. This migration adds the
-- composite index plus a per-user index for revocation flows.

CREATE INDEX IF NOT EXISTS idx_accounts_provider_lookup
  ON accounts (provider, "providerAccountId");

CREATE INDEX IF NOT EXISTS idx_accounts_user_id
  ON accounts ("userId");
