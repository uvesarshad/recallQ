-- migrations/001_initial.sql

-- CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- NextAuth tables
CREATE TABLE users (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                     TEXT,
  email                    TEXT UNIQUE,
  "emailVerified"          TIMESTAMPTZ,
  image                    TEXT,
  telegram_chat_id         BIGINT UNIQUE,
  telegram_link_token      TEXT UNIQUE,
  inbound_email_address    TEXT UNIQUE,
  plan                     TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'starter' | 'pro'
  saves_this_month         INTEGER NOT NULL DEFAULT 0,
  push_subscription        JSONB,                         -- web push PushSubscription object
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE accounts (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId"                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                     TEXT NOT NULL,
  provider                 TEXT NOT NULL,
  "providerAccountId"      TEXT NOT NULL,
  refresh_token            TEXT,
  access_token             TEXT,
  expires_at               INTEGER,
  token_type               TEXT,
  scope                    TEXT,
  id_token                 TEXT,
  session_state            TEXT
);

-- Note: Accounts has two PRIMARY KEY definitions above, I'll fix it.

CREATE TABLE sessions (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "sessionToken"           TEXT UNIQUE NOT NULL,
  "userId"                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires                  TIMESTAMPTZ NOT NULL
);

CREATE TABLE verification_token (
  identifier               TEXT NOT NULL,
  token                    TEXT NOT NULL,
  expires                  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- Collections
CREATE TABLE collections (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT,
  icon       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Main items table
CREATE TABLE items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_id   UUID REFERENCES collections(id) ON DELETE SET NULL,

  -- Content
  type            TEXT NOT NULL CHECK (type IN ('url','text','file','note')),
  raw_url         TEXT,
  raw_text        TEXT,
  file_path       TEXT,              -- local path: /data/files/{user_id}/{item_id}/{filename}
  file_name       TEXT,
  file_mime_type  TEXT,

  -- AI-enriched fields (populated async after save)
  title           TEXT,
  summary         TEXT,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  -- embedding       vector(768),       -- Gemini text-embedding-004 (Commented out until pgvector is fixed)

  -- Capture metadata
  source          TEXT NOT NULL CHECK (source IN ('web','telegram','email','extension','manual')),
  capture_note    TEXT,

  -- Reminder
  reminder_at     TIMESTAMPTZ,
  reminder_sent   BOOLEAN NOT NULL DEFAULT FALSE,

  -- Enrichment status
  enriched        BOOLEAN NOT NULL DEFAULT FALSE,
  enriched_at     TIMESTAMPTZ,

  -- Canvas position (tldraw)
  canvas_x        FLOAT,
  canvas_y        FLOAT,
  canvas_pinned   BOOLEAN NOT NULL DEFAULT FALSE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI-inferred or user-created relationships (graph edges + canvas connections)
CREATE TABLE item_relations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_a_id     UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  item_b_id     UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('ai_similar','ai_same_domain','ai_topic','user_linked')),
  strength      FLOAT NOT NULL DEFAULT 1.0,    -- 0.0–1.0, used for edge weight
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(item_a_id, item_b_id, relation_type)
);

-- Reminders
CREATE TABLE reminders (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id    UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  remind_at  TIMESTAMPTZ NOT NULL,
  channels   TEXT[] NOT NULL DEFAULT '{email}',   -- ['telegram','email','push']
  sent       BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_items_user_id      ON items(user_id);
CREATE INDEX idx_items_created_at   ON items(created_at DESC);
CREATE INDEX idx_items_tags         ON items USING GIN(tags);
-- Index ivfflat needs lists, 100 is default but might fail if not enough rows? 
-- Actually it's fine for setup.
-- CREATE INDEX idx_items_embedding    ON items USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_items_reminder     ON items(reminder_at) WHERE reminder_sent = FALSE AND reminder_at IS NOT NULL;
CREATE INDEX idx_reminders_due      ON reminders(remind_at) WHERE sent = FALSE;
CREATE INDEX idx_item_relations_a   ON item_relations(item_a_id);
CREATE INDEX idx_item_relations_b   ON item_relations(item_b_id);
