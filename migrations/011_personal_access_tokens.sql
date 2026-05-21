-- Bearer tokens issued to non-web clients (Chrome extension, iOS/Android).
-- The web app continues to use NextAuth session cookies; this table is
-- consulted only by lib/request-auth.ts when the request carries an
-- `Authorization: Bearer <token>` header.
--
-- Raw token format: `rq_<48 url-safe chars>`. The first 8 characters after
-- the `rq_` prefix are stored verbatim as the `prefix` column for UI
-- identification (e.g. "Revoke the iPhone token starting rq_aB3xK7Pq..."),
-- the full token is SHA-256 hashed into `token_hash`. The raw token is only
-- ever returned once at issue time and cannot be recovered after.

CREATE TABLE IF NOT EXISTS personal_access_tokens (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name   TEXT NOT NULL,
  token_hash    TEXT NOT NULL UNIQUE,
  prefix        TEXT NOT NULL,
  scopes        TEXT[] NOT NULL DEFAULT ARRAY['full']::TEXT[],
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ
);

-- Lookup by hash on every authenticated request — partial index keeps it
-- tight by excluding revoked rows.
CREATE INDEX IF NOT EXISTS idx_pat_token_hash
  ON personal_access_tokens (token_hash)
  WHERE revoked_at IS NULL;

-- Settings page lists a user's active tokens.
CREATE INDEX IF NOT EXISTS idx_pat_user
  ON personal_access_tokens (user_id)
  WHERE revoked_at IS NULL;
