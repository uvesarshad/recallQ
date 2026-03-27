# PRD: Recall — Frictionless Capture & Intelligent Content Manager

**Version:** 2.0  
**Status:** Ready for AI Agent Implementation  
**Stack:** Next.js 15 (App Router) · PostgreSQL + pgvector (self-hosted) · Local filesystem · Gemini Flash · Telegram Bot · Resend (email) · NextAuth.js v5 · Razorpay · PM2 + Caddy (self-hosted VPS)  
**License:** MIT (public GitHub after dev is complete)

---

## AGENT NOTE: How to Read This PRD

- `AGENT NOTE` = architecture decision or constraint the agent must follow
- `AGENT AVOID` = explicitly prohibited pattern or approach
- `AGENT SEE` = cross-reference to another section
- All file paths are relative to project root unless stated otherwise
- Build features in the exact order listed in **Section 14: Implementation Phases**
- Never skip schema steps — canvas, graph, and relation columns must exist from day one

---

## 1. Product Overview

Recall is a **frictionless capture + intelligent organisation + visual recall** tool. Users save URLs, text snippets, and files from any surface (PWA share, Telegram, email, manual) in under 3 seconds. An AI agent enriches every saved item silently in the background. Users can search, chat with their archive, set reminders, and visualise everything on an **infinite tldraw canvas** (Obsidian-style) with AI-suggested connections — all synced across devices via a PWA.

**Open-source core + paid hosted SaaS.** The repo is public (MIT). Self-hosters run for free. Paying users use your hosted instance at recall.yourdomain.com.

### Core Jobs To Be Done

1. **Capture** — zero copy-paste, any surface
2. **Organise** — AI does the tagging, summarising, and clustering
3. **Recall** — find anything via search, chat, or canvas
4. **Act** — reminders and notifications

---

## 2. Target Users

Indian indie creators, knowledge workers, founders, students — power users of links and content who are frustrated by copy-paste workflows.

---

## 3. Capture Surfaces (V1)

### 3.1 PWA Web App (Primary)

- Next.js 15 app deployed as PWA with `manifest.json` and service worker
- **Android Chrome:** Web Share Target API — user taps Share → selects Recall → item saved instantly
- **Desktop:** manual paste or drag-and-drop into quick capture bar
- **iOS:** PWA share target not supported; user opens app and pastes (acceptable for v1)
- **Chrome + Firefox browser extension** (Phase 5 — not in initial build)

**AGENT NOTE:** Add `manifest.json` with the exact `share_target` block below. This enables Android share sheet integration.

```json
// public/manifest.json (share_target section)
"share_target": {
  "action": "/api/share-target",
  "method": "POST",
  "enctype": "multipart/form-data",
  "params": {
    "title": "title",
    "text": "text",
    "url": "url",
    "files": [{ "name": "file", "accept": ["*/*"] }]
  }
}
```

### 3.2 Telegram Bot

- User links account via `/connect [token]` (one-time setup)
- After linking: forward or send any URL, text, or file to the bot
- Bot parses natural language in message body for reminder instructions
- Bot replies with confirmation: `✓ Saved — [title]. [Reminder: Monday 9am]`

**AGENT NOTE:** Use Telegram Bot API with **webhooks only** (never polling). Set webhook at `https://api.telegram.org/bot{TOKEN}/setWebhook`. Webhook endpoint: `/api/telegram/webhook`. Verify `X-Telegram-Bot-Api-Secret-Token` header on every request.

**Handle these Telegram update types:**
- `message.text` with URL → save as URL item
- `message.text` without URL → save as note
- `message.document` → download file, save to local filesystem
- `message.photo` → download largest size, save to local filesystem
- `message.forward_date` (forwarded messages) → extract original content

**Linking flow:** User clicks "Connect Telegram" in settings → app generates `telegram_link_token` (UUID) → displays: *"Open @RecallBot and send: `/connect {token}`"* → bot receives command → sets `users.telegram_chat_id` → clears token → both bot and web app confirm. Web page polls `/api/user/telegram-status` every 3 seconds until linked.

### 3.3 Email Forwarding

- Each user gets a unique inbound address: `[nanoid(10)]@saves.{APP_DOMAIN}`
- Built on **Resend Inbound Email** — set up `saves.{APP_DOMAIN}` as inbound domain in Resend dashboard (generous free tier, simplest setup for launch volume)
- Resend POSTs parsed payload to `/api/email/inbound`
- Parse: `subject` → title, `text/html body` → content, attachments → save to local filesystem
- Match `to` address to `users.inbound_email_address`; silently ignore unknown addresses
- Reply to sender confirming save

**AGENT NOTE:** Resend inbound payload fields: `from`, `to`, `subject`, `text`, `html`, `attachments[]`. The `to` field matches `users.inbound_email_address`. Auto-generate this address at signup.

---

## 4. Data Model

**AGENT NOTE:** Single migration file `migrations/001_initial.sql`. Do not split. Canvas position columns, embedding column, and `item_relations` table must all exist from day one — canvas and graph views depend on them.

```sql
-- migrations/001_initial.sql

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE users (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email                    TEXT UNIQUE NOT NULL,
  name                     TEXT,
  avatar_url               TEXT,
  telegram_chat_id         BIGINT UNIQUE,
  telegram_link_token      TEXT UNIQUE,
  inbound_email_address    TEXT UNIQUE,
  plan                     TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'starter' | 'pro'
  saves_this_month         INTEGER NOT NULL DEFAULT 0,
  push_subscription        JSONB,                         -- web push PushSubscription object
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  embedding       vector(768),       -- Gemini text-embedding-004

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
CREATE INDEX idx_items_embedding    ON items USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_items_reminder     ON items(reminder_at) WHERE reminder_sent = FALSE AND reminder_at IS NOT NULL;
CREATE INDEX idx_reminders_due      ON reminders(remind_at) WHERE sent = FALSE;
CREATE INDEX idx_item_relations_a   ON item_relations(item_a_id);
CREATE INDEX idx_item_relations_b   ON item_relations(item_b_id);
```

---

## 5. API Routes

**AGENT NOTE:** All routes under `/api/` are Next.js 15 Route Handlers (App Router). Protected routes use `getServerSession()` from NextAuth. File storage uses local filesystem, not S3 (AGENT SEE: Section 11).

### 5.1 Core Ingest Route

```
POST /api/ingest
Auth: required (session or internal bot token)
Body: { type, raw_url?, raw_text?, capture_note?, source, collection_id? }
Files: multipart/form-data for file uploads
```

**Flow:**
1. Validate session or bot token
2. Check plan limits (AGENT SEE: Section 9)
3. Insert item with `enriched: false` — return 200 immediately
4. Enqueue for enrichment (AGENT SEE: Section 6)

**AGENT AVOID:** Never make the client wait for AI enrichment. Save instantly, enrich async.

### 5.2 PWA Share Target

```
POST /api/share-target
Auth: required (session cookie)
Body: multipart/form-data (title, text, url, file)
Response: 303 redirect to /app?saved=true
```

**AGENT NOTE:** Must respond with a redirect, not JSON. The browser follows it. Redirect triggers a success toast via `?saved=true` query param.

### 5.3 Telegram Webhook

```
POST /api/telegram/webhook
Auth: X-Telegram-Bot-Api-Secret-Token header verification
Body: Telegram Update object
```

### 5.4 Email Inbound

```
POST /api/email/inbound
Auth: Resend webhook signature verification
Body: Resend inbound email payload
```

### 5.5 Items CRUD

```
GET    /api/items                → paginated list; ?q= ?tag= ?collection= ?type=
GET    /api/items/[id]           → single item
PATCH  /api/items/[id]           → update title, tags, collection, reminder, canvas_x, canvas_y
DELETE /api/items/[id]           → soft delete
GET    /api/items/[id]/related   → related items via item_relations
```

### 5.6 Search

```
GET /api/search?q={query}&mode={fulltext|semantic|hybrid}
```

- `fulltext`: PostgreSQL `ts_vector` on title + summary + raw_text + tags
- `semantic`: pgvector cosine similarity on `embedding` column
- `hybrid`: run both, merge by rank (default for UI)

**AGENT NOTE:** For semantic search, embed the query with Gemini `text-embedding-004` before querying pgvector. Use `<->` cosine distance operator. Scope all queries to `user_id`.

### 5.7 Chat (RAG)

```
POST /api/chat
Auth: required
Body: { messages: [{role, content}], conversation_id? }
Response: SSE stream
```

**Flow:**
1. Embed last user message (Gemini `text-embedding-004`)
2. Retrieve top 10 similar items from pgvector (user-scoped)
3. Build system prompt with retrieved context
4. Stream response from Gemini Flash via SSE

**System prompt:**
```
You are a personal assistant for the user's saved content library.
Answer ONLY from the content provided. If the answer is not in the content, say so clearly.
Today's date: {date}. User's timezone: IST.

Saved items most relevant to the question:
{retrieved_items_as_markdown}
```

### 5.8 Canvas / Graph Data

```
GET /api/graph
Auth: required
Response: { nodes: Item[], edges: ItemRelation[] }
```

Returns all user items (id, title, type, tags, collection_id, canvas_x, canvas_y, enriched) and all relations. No raw_text or embeddings in response payload.

### 5.9 Collections

```
GET    /api/collections
POST   /api/collections
PATCH  /api/collections/[id]
DELETE /api/collections/[id]
```

### 5.10 Reminders

```
POST   /api/reminders           → create reminder for an item
PATCH  /api/reminders/[id]      → update remind_at or channels
DELETE /api/reminders/[id]      → cancel
```

### 5.11 Payments

```
POST /api/payments/create-subscription   → create Razorpay annual subscription
POST /api/payments/webhook               → Razorpay webhook (update users.plan on success)
```

### 5.12 User

```
GET  /api/user/telegram-status   → { linked: boolean } (polled during connect flow)
GET  /api/user/me                → current user profile + plan + usage
```

---

## 6. AI Enrichment Pipeline

**AGENT NOTE:** Implement as PM2 worker process `workers/enrichment-worker.ts`. Never run enrichment synchronously in request handlers. Poll for unenriched items every 5 seconds, process max 5 per batch to stay within Gemini rate limits. Read model from env: `process.env.GEMINI_MODEL` (default: `gemini-2.5-flash`).

### Per-Item Enrichment Steps

**URL items:**
1. Fetch URL with `node-fetch` (5s timeout, handle 4xx/5xx gracefully)
2. Parse with `cheerio`: extract `og:title`, `og:description`, `og:image`, `<title>`, first 1000 chars of `<body>` text
3. Run enrichment prompt (below) via Gemini Flash
4. Generate embedding with Gemini `text-embedding-004` on `title + summary + tags.join(' ')`
5. Update DB: `title`, `summary`, `tags`, `embedding`, `enriched: true`, `enriched_at`
6. If reminder detected in `capture_note`: insert row into `reminders`
7. Run relation building (below)

**Text / note items:** skip scraping, run enrichment prompt directly on `raw_text`.

**File items:**
- PDF → `pdf-parse`
- DOCX → `mammoth`
- XLS/XLSX → `xlsx` library
- Truncate extracted text to 3000 chars before sending to prompt

### Enrichment Prompt

```
You are a content enrichment assistant. Return ONLY valid JSON, no markdown, no preamble.

Content:
Title hint: {og_title or filename or first 100 chars}
Body: {content}
User note at capture: {capture_note}

Return this exact shape:
{
  "title": "clear concise title, max 80 chars",
  "summary": "2–3 sentence summary",
  "tags": ["tag1", "tag2"],  // 3–7 lowercase tags
  "reminder": null           // or ISO8601 string if user note has reminder intent
}

Reminder rules (today = {today_date}, default time = 09:00 IST):
- "remind me Monday" → next Monday 09:00 IST
- "remind me tomorrow" → tomorrow 09:00 IST
- "remind me in 3 days" → 3 days from now 09:00 IST
- No instruction → null
```

### Relation Building (runs after each enrichment)

1. Query top 10 nearest neighbours from pgvector for this item (exclude self, user-scoped)
2. Filter to cosine similarity > 0.75
3. Upsert into `item_relations` with `relation_type: 'ai_similar'`
4. For URL items: also check `raw_url` domain against existing items → upsert `ai_same_domain`

---

## 7. Reminder Scheduler

**AGENT NOTE:** Second PM2 worker: `workers/reminder-worker.ts`. Poll `reminders` table every 60 seconds. On the 1st of each month, reset `users.saves_this_month = 0` for all users (run this check inside the same worker loop).

```
Every 60 seconds:
  SELECT * FROM reminders WHERE remind_at <= NOW() AND sent = FALSE
  For each:
    → send via each channel in reminders.channels
    → UPDATE reminders SET sent = TRUE, sent_at = NOW()
    → UPDATE items SET reminder_sent = TRUE

  If day = 1 of month and hour = 0:
    → UPDATE users SET saves_this_month = 0
```

### Notification Channels

**Telegram:**
```
POST https://api.telegram.org/bot{TOKEN}/sendMessage
{ chat_id: user.telegram_chat_id, text: "⏰ Reminder: {item.title}\n{item.raw_url}", parse_mode: "HTML" }
```

**Email (Resend):**
- From: `reminders@{APP_DOMAIN}`
- Simple HTML: item title, link to item, "View in Recall" button

**Web Push:**
- Use `web-push` npm package
- Store `PushSubscription` in `users.push_subscription` (JSONB)
- Send with item title and URL as payload

---

## 8. Frontend — Web App

**AGENT NOTE:** Next.js 15 App Router. Protected routes under `app/(app)/`. Auth routes under `app/(auth)/`. Use Tailwind CSS. No external UI component library — build clean minimal components from scratch.

### Routes

```
/                             → Landing page (public)
/login                        → Auth (Google OAuth + magic link)
/app                          → Main feed (default view)
/app/search                   → Search results
/app/canvas                   → tldraw infinite canvas (primary visual view)
/app/graph                    → Force-graph view (secondary/bonus view)
/app/chat                     → Chat with saves
/app/collections/[id]         → Collection view
/app/settings                 → Account, plan, usage
/app/settings/integrations    → Telegram connect + email address
```

### Main Feed (`/app`)

- Reverse-chronological item cards
- Card shows: favicon/type icon, title, summary (truncated to 2 lines), tags, source badge, relative time
- Filter bar: All | URLs | Files | Notes | Reminders
- Quick capture bar at top: paste URL or text → saves on Enter
- Unenriched items show a subtle shimmer/spinner on title; disappears when enriched
- Infinite scroll (cursor-based pagination, no page numbers)

### Canvas View (`/app/canvas`) — Primary Visual View

**AGENT NOTE:** Use `@tldraw/tldraw` (latest v2). Install: `npm install tldraw`. Do not build a custom canvas renderer.

- Every saved item is a **custom tldraw shape** (draggable, resizable card)
- Three custom shapes: `UrlCard`, `FileCard`, `NoteCard`
- Each card displays: type icon, title, summary (truncated), tags as chips
- Clicking a card opens item detail panel (right-side drawer, same as feed)
- **AI-suggested connections** render as tldraw arrows between related items (from `item_relations` where strength > 0.75)
- Arrow labels show relation type: "similar", "same domain", "same topic"
- When a new item is enriched, auto-place it on canvas using a simple layout algorithm (spiral out from centre, or cluster near highest-strength related item)
- User can drag cards, pin them (`canvas_pinned: true`), and manually draw connections (saves as `user_linked` relation)
- PATCH `canvas_x`, `canvas_y` to `/api/items/[id]` on drag-end (debounce 500ms)

**AGENT NOTE:** tldraw state is the source of truth for visual positions. Sync positions to DB on drag-end. On canvas load, fetch all items + relations from `/api/graph` and reconstruct the tldraw document.

### Force Graph View (`/app/graph`) — Secondary View

- Use `react-force-graph-2d`
- Nodes coloured by collection, shaped by item type
- Edge thickness proportional to `strength`
- Click node → item detail drawer
- Filter panel: by tag, type, collection, date range

### Search (`/app/search`)

- Single bar, debounced 300ms, hybrid mode by default
- Results in two groups: "Exact matches" → "Semantic matches"
- Highlighted match terms in snippet

### Chat (`/app/chat`)

- Streaming SSE responses rendered progressively
- Citations shown below each assistant message: "Based on: [item title]" (linked)
- Suggested prompts on empty state:
  - "What did I save this week?"
  - "Do I have any tasks due soon?"
  - "Summarise everything I saved about [topic]"

### Settings — Integrations

- Telegram: connect flow (AGENT SEE: Section 3.2)
- Email: display `inbound_email_address` with copy button + instructions

---

## 9. Freemium Model

**AGENT NOTE:** Annual billing only — no monthly plans. Enforce limits in `/api/ingest`. Two Razorpay plans: `starter_29_year`, `pro_99_year`.

| Feature | Free | Starter ₹29/year | Pro ₹99/year |
|---|---|---|---|
| Saves per month | 50 | 100 | Unlimited |
| File storage | 100 MB | 1 GB | 10 GB |
| AI enrichment | All saves | All saves | All saves |
| Semantic search | ✓ | ✓ | ✓ |
| RAG Chat queries/day | 20 | 50 | Unlimited |
| Active reminders | 2 | 30 | Unlimited |
| Canvas + graph view | ✓ | ✓ | ✓ |
| Telegram bot | ✓ | ✓ | ✓ |
| Email forwarding | ✗ | ✓ | ✓ |

**Limit enforcement in `/api/ingest`:**
- Check `users.saves_this_month` against plan cap before inserting
- Check `users.plan` before allowing email capture (free plan blocked)
- Return `{ error: 'limit_reached', upgrade_url: '/app/settings' }` with 402 status when over limit

---

## 10. Authentication

- **Provider:** NextAuth.js v5
- **Methods:** Google OAuth + Email magic link (Resend adapter)
- **Session strategy:** JWT (stateless, works with PWA offline)
- **On first signup:** auto-generate `inbound_email_address = nanoid(10) + '@saves.' + APP_DOMAIN` and store in DB

---

## 11. File Storage (Local Filesystem)

**AGENT NOTE:** No AWS, no S3. All files stored locally on the VPS.

- Base path: `/data/files/` (outside project root, survives deploys)
- Per-file path: `/data/files/{user_id}/{item_id}/{original_filename}`
- Create directory with `fs.promises.mkdir(..., { recursive: true })` on save
- Serve files via Next.js static route or Caddy directly (AGENT SEE: Section 12)
- Generate access-controlled URL: `/api/files/[...path]` — verify session owns the file before streaming
- Max upload size: 10 MB (free/starter), 50 MB (pro) — enforce in `/api/ingest`
- Accepted MIME types: `application/pdf`, `application/vnd.openxmlformats-officedocument.*`, `text/markdown`, `text/plain`, `image/*`

**AGENT NOTE:** Never expose `/data/files` as a public static directory. Always stream through the authenticated `/api/files/[...path]` route.

---

## 12. PM2 + Caddy Self-Hosted Deployment

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'recall-web',
      script: 'node_modules/.bin/next',
      args: 'start',
      env: { PORT: 3000, NODE_ENV: 'production' }
    },
    {
      name: 'recall-enrichment',
      script: 'dist/workers/enrichment-worker.js',
      instances: 1,
      restart_delay: 5000,
      max_restarts: 10
    },
    {
      name: 'recall-reminders',
      script: 'dist/workers/reminder-worker.js',
      instances: 1,
      restart_delay: 10000,
      max_restarts: 10
    }
  ]
}
```

**Caddy config (Caddyfile):**
```
recall.yourdomain.com {
  reverse_proxy localhost:3000
}
```

Caddy handles HTTPS automatically via Let's Encrypt. No nginx, no certbot.

---

## 13. Environment Variables

```bash
# App
NEXT_PUBLIC_APP_URL=https://recall.yourdomain.com
APP_DOMAIN=yourdomain.com
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/recall

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=https://recall.yourdomain.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# AI
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

# File storage
FILES_BASE_PATH=/data/files

# Email
RESEND_API_KEY=
RESEND_INBOUND_DOMAIN=saves.yourdomain.com

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

# Payments
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# Web Push
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:hello@yourdomain.com
```

---

## 14. Implementation Phases

**AGENT NOTE:** Build in this exact order. Each phase is independently deployable and testable. Do not start the next phase until the current one is verified working.

### Phase 1 — Foundation (Days 1–2)
- [ ] Project setup: Next.js 15, Tailwind, NextAuth v5, node-postgres
- [ ] Run `migrations/001_initial.sql`
- [ ] Google OAuth + magic link auth, session working
- [ ] Auto-generate `inbound_email_address` on signup
- [ ] `/api/ingest` endpoint (manual/web source, URL and text only)
- [ ] Main feed UI: save a URL, see it in list with loading state
- [ ] PWA `manifest.json` + service worker + `share_target`

### Phase 2 — Capture Surfaces (Days 3–4)
- [ ] Telegram bot: register webhook, `/connect` command + linking flow
- [ ] Telegram ingest: text, URL, document, photo, forwarded messages
- [ ] Resend inbound email: webhook handler, match to user, call `/api/ingest`
- [ ] Settings > Integrations: Telegram connect UI + email address display + copy

### Phase 3 — AI Enrichment (Day 5)
- [ ] `workers/enrichment-worker.ts` as PM2 process
- [ ] URL scraping with `cheerio` (og tags + body text)
- [ ] File text extraction: `pdf-parse`, `mammoth`, `xlsx`
- [ ] Gemini Flash enrichment: title, summary, tags, reminder detection
- [ ] Gemini `text-embedding-004` embedding generation
- [ ] Relation building after enrichment (pgvector similarity + domain matching)
- [ ] Feed shimmer → populates when enriched

### Phase 4 — Search + Chat (Days 6–7)
- [ ] Full-text search with `ts_vector` (title + summary + raw_text + tags)
- [ ] Semantic search with pgvector
- [ ] Hybrid search merge
- [ ] Search page UI with grouped results
- [ ] RAG chat endpoint with SSE streaming
- [ ] Chat page UI with citations and suggested prompts

### Phase 5 — Canvas View (Days 8–9)
- [ ] Install `tldraw`, create `UrlCard`, `FileCard`, `NoteCard` custom shapes
- [ ] `/api/graph` endpoint
- [ ] Canvas page: load all items + relations, render as tldraw document
- [ ] AI-suggested arrows from `item_relations` (strength > 0.75)
- [ ] Drag-end → PATCH `canvas_x`, `canvas_y` (debounced 500ms)
- [ ] Auto-place new enriched items on canvas
- [ ] Item detail drawer on card click
- [ ] Force graph view (`react-force-graph-2d`) as secondary tab

### Phase 6 — Reminders + Notifications (Day 10)
- [ ] `workers/reminder-worker.ts` as PM2 process
- [ ] Telegram notification
- [ ] Email notification (Resend)
- [ ] Web push (VAPID setup, subscription save, push send)
- [ ] Reminder creation UI on any item (date picker + channel selector)
- [ ] Monthly saves reset in reminder worker

### Phase 7 — Freemium + Polish (Days 11–12)
- [ ] Razorpay annual subscription: two plans (`starter_29_year`, `pro_99_year`)
- [ ] Plan limit enforcement in `/api/ingest` (saves cap, email gating, reminder cap)
- [ ] Chat query limit enforcement (count per day in DB or Redis-free counter)
- [ ] Usage dashboard in Settings (saves used / cap, storage used, chat queries left)
- [ ] Landing page
- [ ] PWA install prompt

### Phase 8 — Browser Extension (Post-launch)
- [ ] Chrome extension (Manifest V3): popup with URL + note → POST to `/api/ingest`
- [ ] Firefox extension (same codebase, WebExtensions API)
- [ ] One-click save of selected text from any page

---

## 15. Open Source Strategy

- **Repo:** Public GitHub after dev is complete (MIT license)
- **README:** Must include a full self-host guide (target: 5-minute setup on any Ubuntu VPS)
- **Self-hosted users:** get Free plan behaviour only. They can modify code to remove limits — that's the trust model.
- **Your hosted instance** (recall.yourdomain.com) is the paid SaaS with Razorpay enforced
- **Monetisation:** Users pay via Razorpay on your hosted instance. Self-hosters do not pay.
- **Config flag:** `SELF_HOSTED=true` env var disables Razorpay UI and plan limits (for self-hosters running their own instance) — implement as a single env check, not spread through codebase

**README must include:**
1. Prerequisites (Node 20+, PostgreSQL 15+, Caddy)
2. Clone → `npm install` → copy `.env.example` → fill vars
3. `npm run db:migrate` (runs `migrations/001_initial.sql`)
4. Configure Resend inbound domain
5. Set Telegram webhook
6. `pm2 start ecosystem.config.js`
7. Point domain to server, Caddy handles HTTPS

---

## 16. AGENT AVOID — Global Rules

- **AVOID** any AWS services (no S3, no SES, no EC2-specific config)
- **AVOID** Docker — deploy directly with PM2 + Caddy
- **AVOID** Prisma — use `pg` (node-postgres) directly for all queries
- **AVOID** monthly billing — annual subscriptions only (Razorpay)
- **AVOID** storing files anywhere except `FILES_BASE_PATH` (`/data/files`)
- **AVOID** exposing file paths as public static URLs — always stream via authenticated route
- **AVOID** hardcoded model strings — always read `process.env.GEMINI_MODEL`
- **AVOID** synchronous AI calls in request handlers — always async worker
- **AVOID** Telegram polling (`getUpdates`) — webhooks only
- **AVOID** returning embeddings in API response payloads
- **AVOID** committing `.env` files — always use `.env.example`
- **AVOID** any UI component library — Tailwind utility classes only

---

## 17. Key Third-Party Docs

- Telegram Bot API: https://core.telegram.org/bots/api
- Resend Inbound: https://resend.com/docs/dashboard/emails/inbound-email
- Web Share Target API: https://web.dev/web-share-target/
- tldraw v2 custom shapes: https://tldraw.dev/docs/shapes
- react-force-graph: https://github.com/vasturiano/react-force-graph
- pgvector: https://github.com/pgvector/pgvector
- web-push: https://github.com/web-push-libs/web-push
- Razorpay Subscriptions: https://razorpay.com/docs/payments/subscriptions/