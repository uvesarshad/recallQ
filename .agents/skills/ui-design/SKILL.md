---
name: recall-ui-architecture-system
description: >
  Use this skill when generating or editing ANY frontend or backend code for the
  Recall project. Covers design tokens (Inter + Geist Mono, slate/indigo palette),
  component patterns (capture bar, card grid, canvas overlay, chat drawer),
  data models (Item, Collection, Connection), API conventions, AI-enrichment
  pipeline, and what to avoid (heavy shadows, opinionated onboarding flows,
  full-page loaders). Always apply when writing React/Next.js, Tailwind, tRPC,
  or Drizzle code for Recall.
version: 1.0.0
---

# Recall — Master Skill
> For AI coding agents (Codex CLI, Claude, GPT-4) generating or editing code for the Recall project

---

## 1. Project Identity

**Product**: Recall — frictionless capture + intelligent organisation + visual recall tool.
**Tagline**: "Save anything. Find everything."
**Tone**: Fast, minimal, trustworthy. Think: a dev tool that normal people can love.
**Audience**: Indian indie creators, knowledge workers, founders, students — power users drowning in tabs and copy-paste.
**Business model**: Open-source core (MIT) + paid hosted SaaS.

### Core Jobs To Be Done (always keep these in mind)
1. **Capture** — zero copy-paste, any surface (PWA share, Telegram bot, email, manual)
2. **Organise** — AI silently tags, summarises, and clusters every item
3. **Recall** — find anything via search, chat, or infinite canvas
4. **Act** — reminders and cross-device notifications

---

## 2. Tech Stack (Canonical — never deviate without a comment)

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | `/app` directory only, no `pages/` |
| Language | TypeScript (strict) | `noUncheckedIndexedAccess: true` |
| Styling | Tailwind CSS v3 | Use CSS vars for theme tokens |
| Component lib | shadcn/ui | Only import what you use |
| State (server) | tRPC v11 + React Query v5 | All API calls through tRPC |
| State (client) | Zustand | One store per domain (`useCapture`, `useCanvas`, `useChat`) |
| Database | PostgreSQL via Neon | Drizzle ORM (never raw SQL strings) |
| File storage | Cloudflare R2 | Presigned URLs, never expose bucket directly |
| AI | Vercel AI SDK + OpenAI / Gemini | Model-agnostic via `ai` package |
| Canvas | tldraw v2 | `<Tldraw>` component, custom shape types |
| Auth | Clerk | `auth()` server helper in route handlers |
| Notifications | web-push + Telegram Bot API | |
| PWA | next-pwa | Share Target API for capture |

---

## 3. Design Tokens

### 3.1 Fonts
```css
/* globals.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
/* Geist Mono via next/font/local from the geist package */
```

| Role | Font | Weight | Usage |
|---|---|---|---|
| UI / Body | Inter | 400, 500, 600 | Everything except code |
| Monospace | Geist Mono | 400, 500 | URLs, IDs, timestamps, code snippets |

**Rules:**
- Never use system-ui, Roboto, or DM Sans in Recall
- Body font-size: 14px (dense, app-like), line-height: 1.55
- Headings inside modals/cards: Inter 16px / 600
- The product name "Recall" always renders in Inter 600, never italic or decorated

---

### 3.2 Color System

```css
/* CSS variables — define in :root */
--color-bg:          #0f0f11;   /* near-black canvas background */
--color-surface:     #18181b;   /* cards, sidebars, panels */
--color-surface-2:   #27272a;   /* hover states, nested surfaces */
--color-border:      #3f3f46;   /* dividers, card borders */
--color-border-soft: #27272a;   /* subtle inner borders */

--color-text-primary: #fafafa;  /* headings, important labels */
--color-text-mid:     #a1a1aa;  /* body copy, metadata */
--color-text-muted:   #71717a;  /* timestamps, secondary captions */

--color-brand:        #6366f1;  /* indigo — primary actions */
--color-brand-hover:  #818cf8;  /* lighter indigo on hover */
--color-brand-dim:    #312e81;  /* dark indigo — chip backgrounds */
--color-brand-glow:   rgba(99,102,241,0.15); /* focus rings, active halos */

/* Semantic item-type colours */
--color-link:     #38bdf8;   /* sky blue — URLs */
--color-note:     #a3e635;   /* lime — text snippets */
--color-file:     #fb923c;   /* orange — files/PDFs */
--color-media:    #e879f9;   /* fuchsia — images/video */
--color-reminder: #facc15;   /* yellow — time-sensitive */
```

**AGENT NOTE:** Recall is **dark-mode first**. Light mode is a future roadmap item — do not add light mode CSS unless the task explicitly says so.

**Item-type color usage**: Every Item has a `type` field. Always use the matching semantic colour for the left-border accent on cards, the type badge, and the canvas node stroke. Never swap them.

---

### 3.3 Border Radius
```
Cards:          border-radius: 10px
Modals:         border-radius: 14px
Buttons:        border-radius: 8px
Pill badges:    border-radius: 100px
Input fields:   border-radius: 8px
Canvas nodes:   border-radius: 12px
Avatar:         border-radius: 50%
Command bar:    border-radius: 12px (top) / 0 (bottom when results open)
```

**AGENT AVOID:** Never use `border-radius: 0` on interactive elements. Never use `border-radius: 24px` or more on cards — too "marketing", not "tool".

---

### 3.4 Spacing Scale
Follow Tailwind defaults strictly. Key values:
```
gap-2 (8px)  — inline chip gaps
gap-3 (12px) — card inner padding top
gap-4 (16px) — standard component gap
gap-6 (24px) — section spacing inside panels
p-3  (12px)  — compact card padding
p-4  (16px)  — standard card padding
p-5  (20px)  — modal padding
```

---

## 4. Data Models (Drizzle schema — source of truth)

### 4.1 Item (core entity — everything saved is an Item)
```typescript
// db/schema/items.ts
export const items = pgTable('items', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),  // cuid2
  userId:       text('user_id').notNull(),
  type:         text('type', { enum: ['url', 'note', 'file', 'image', 'video'] }).notNull(),
  rawContent:   text('raw_content').notNull(),       // original URL / text / file key
  title:        text('title'),                        // AI-enriched
  summary:      text('summary'),                      // AI-enriched, ≤160 chars
  fullText:     text('full_text'),                    // scraped or OCR text
  tags:         text('tags').array().default([]),      // AI-assigned
  faviconUrl:   text('favicon_url'),
  ogImageUrl:   text('og_image_url'),
  embedVector:  vector('embed_vector', { dimensions: 1536 }),  // pgvector
  enrichStatus: text('enrich_status', { enum: ['pending', 'done', 'failed'] }).default('pending'),
  sourceChannel:text('source_channel', { enum: ['web', 'pwa-share', 'telegram', 'email', 'api'] }),
  remindAt:     timestamp('remind_at'),
  archivedAt:   timestamp('archived_at'),
  createdAt:    timestamp('created_at').defaultNow(),
  updatedAt:    timestamp('updated_at').defaultNow(),
});
```

### 4.2 Collection
```typescript
export const collections = pgTable('collections', {
  id:        text('id').primaryKey().$defaultFn(() => createId()),
  userId:    text('user_id').notNull(),
  name:      text('name').notNull(),
  icon:      text('icon').default('📁'),
  color:     text('color').default('#6366f1'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const itemCollections = pgTable('item_collections', {
  itemId:       text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  collectionId: text('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
});
```

### 4.3 Connection (canvas edges / AI-suggested links)
```typescript
export const connections = pgTable('connections', {
  id:       text('id').primaryKey().$defaultFn(() => createId()),
  userId:   text('user_id').notNull(),
  sourceId: text('source_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  targetId: text('target_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  reason:   text('reason'),   // AI explanation: "Both about React Server Components"
  strength: real('strength').default(0.5),  // 0–1, cosine similarity score
  manual:   boolean('manual').default(false),
  createdAt:timestamp('created_at').defaultNow(),
});
```

**AGENT NOTE:** Always use `createId()` from `@paralleldrive/cuid2` for IDs. Never use `uuid()` or auto-increment integers.

---

## 5. File & Folder Structure

```
/app
  /(auth)           — Clerk sign-in/up pages
  /(app)
    /dashboard      — default view: card grid
    /canvas         — tldraw infinite canvas
    /chat           — AI chat over archive
    /settings       — user preferences, integrations
  /api
    /trpc/[trpc]    — tRPC handler
    /capture        — POST endpoint for Telegram bot, email pipe, share target
    /webhooks       — Clerk webhook (user create/delete)

/components
  /capture          — CaptureBar, QuickAddModal, ShareTargetHandler
  /items            — ItemCard, ItemDetail, ItemTypeIcon, EnrichBadge
  /canvas           — RecallCanvas, ItemNode, ConnectionEdge, AISuggestPanel
  /chat             — ChatDrawer, ChatMessage, SourceChip
  /collections      — CollectionSidebar, CollectionBadge
  /ui               — shadcn/ui re-exports + custom Recall primitives
  /layout           — AppShell, Sidebar, CommandBar

/lib
  /ai               — enrichItem.ts, embedText.ts, suggestConnections.ts, chatWithArchive.ts
  /capture          — parseUrl.ts, scrapeOg.ts, extractText.ts, ocrFile.ts
  /db               — drizzle client, schema index
  /trpc             — router, context, procedures

/stores
  useCapture.ts
  useCanvas.ts
  useChat.ts
  useFilter.ts
```

---

## 6. Component Patterns

### 6.1 CaptureBar (most important UI element)

The CaptureBar is the global entry point — always visible, always fast. It renders at the **top of every app screen** (not in a modal, not hidden behind a FAB).

```tsx
// Behaviour contract:
// - Auto-detects type (URL vs text) from paste
// - Submits on Enter or Cmd+Enter
// - Shows a loading spinner for ≤300ms then dismisses (optimistic insert)
// - Never shows a multi-step form — single input, single action
// - Keyboard shortcut: Cmd+K focuses it from anywhere

// Structure:
<div className="capture-bar">
  <TypeIcon />           {/* auto-detected, animated swap */}
  <input
    placeholder="Paste a link, drop text, or describe something..."
    // DM: 14px, color: --color-text-primary
  />
  <kbd>⌘K</kbd>          {/* shown only when unfocused */}
  <button>Save</button>
</div>
```

CSS:
```css
.capture-bar {
  background: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: 10px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: border-color 0.15s ease;
}
.capture-bar:focus-within {
  border-color: var(--color-brand);
  box-shadow: 0 0 0 3px var(--color-brand-glow);
}
```

**AGENT AVOID:** Never add a "category" dropdown, tags field, or notes field to the capture bar. The AI does that. One input, one Save.

---

### 6.2 ItemCard

```tsx
// Compact card for grid/list views
// Left border accent = item type colour
// Shows: favicon OR type icon, title, summary, domain + time, tags (max 3)

<article className="item-card" data-type={item.type}>
  <span className="type-accent" />     {/* 3px left border, var(--color-{type}) */}
  <div className="card-header">
    <img src={item.faviconUrl} className="favicon" />
    <span className="domain">{extractDomain(item.rawContent)}</span>
    <span className="time">{relativeTime(item.createdAt)}</span>
    <EnrichBadge status={item.enrichStatus} />
  </div>
  <h3 className="card-title">{item.title ?? item.rawContent}</h3>
  <p className="card-summary">{item.summary}</p>
  <div className="card-tags">
    {item.tags.slice(0, 3).map(tag => <Tag key={tag}>{tag}</Tag>)}
  </div>
</article>
```

CSS:
```css
.item-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-soft);
  border-radius: 10px;
  padding: 14px 16px 14px 19px;  /* extra left for accent border */
  position: relative;
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease;
}
.item-card:hover {
  background: var(--color-surface-2);
  border-color: var(--color-border);
}
.type-accent {
  position: absolute;
  left: 0; top: 10px; bottom: 10px;
  width: 3px;
  border-radius: 2px;
  background: var(--item-type-color);  /* set via inline style or data attr */
}
.card-title { font-size: 14px; font-weight: 600; color: var(--color-text-primary); line-height: 1.4; }
.card-summary { font-size: 13px; color: var(--color-text-mid); line-height: 1.5; margin-top: 4px; }
```

---

### 6.3 EnrichBadge

Visual indicator of AI enrichment status. Always shown in top-right of ItemCard.

```tsx
// pending  → spinning circle (indigo, 10px)
// done     → invisible (don't clutter with a green tick on every card)
// failed   → orange exclamation dot (hover shows "Enrichment failed — retry")

const EnrichBadge = ({ status }: { status: Item['enrichStatus'] }) => {
  if (status === 'done') return null;
  if (status === 'pending') return <span className="enrich-spinner" aria-label="Processing…" />;
  return <span className="enrich-failed" title="Enrichment failed — click to retry">!</span>;
};
```

---

### 6.4 CommandBar (Cmd+K)

Global search + action palette. Uses `cmdk` library.

```tsx
// Triggers: Cmd+K (focus), Cmd+J (jump to canvas), Cmd+Shift+C (capture)
// Shows: recent items, collections, commands ("Open canvas", "New reminder")
// Search: debounced tRPC call to items.search (semantic + keyword hybrid)

// Render pattern — always portal to document.body
<CommandDialog open={open} onOpenChange={setOpen}>
  <CommandInput placeholder="Search your archive or type a command…" />
  <CommandList>
    <CommandGroup heading="Recent">…</CommandGroup>
    <CommandGroup heading="Collections">…</CommandGroup>
    <CommandGroup heading="Actions">…</CommandGroup>
  </CommandList>
</CommandDialog>
```

---

### 6.5 Canvas (tldraw)

The canvas is Recall's **"second brain" view**. Each Item becomes a node; Connections become edges.

```tsx
// /app/(app)/canvas/page.tsx
// Loads ALL user items and connections into tldraw shapes

// Custom shape: RecallItemShape
// - White-on-dark card inside tldraw
// - Title (16px), domain/type badge, thumbnail if ogImage exists
// - Double-click → opens ItemDetail drawer (outside tldraw DOM)
// - Right-click context menu → "Find connections", "Open original", "Add to collection"

// AI panel (right sidebar, toggled):
// Shows top-5 AI-suggested connections for selected node
// Each suggestion shows reason + strength bar
// "Add connection" button inserts a tldraw arrow + writes to DB
```

**AGENT NOTE:** Never store canvas layout state in the database per-item. Store the full tldraw snapshot (JSON) in a single `canvasSnapshots` table row per user. Restore on load.

---

### 6.6 ChatDrawer

Sliding panel (right side, 420px wide) for "Chat with your archive".

```tsx
// Uses Vercel AI SDK `useChat` hook
// System prompt built server-side — includes user's top-200 items (title + summary)
//   + semantic search results for the user's latest message
// Each AI message cites source items as <SourceChip> components
// SourceChip: click → opens ItemDetail

// NEVER stream the full item content into the prompt — use summaries only
// NEVER expose the system prompt text to the client
```

---

## 7. tRPC Router Shape

```typescript
// server/routers/index.ts — canonical procedure list
// items
items.create       // POST — returns optimistic item immediately, enriches in background
items.list         // GET — paginated, filterable by type/tag/collection/dateRange
items.search       // GET — hybrid: pg_trgm keyword + pgvector semantic
items.get          // GET — single item with connections
items.update       // PATCH — title, tags, remindAt
items.archive      // PATCH — sets archivedAt
items.delete       // DELETE

// collections
collections.list
collections.create
collections.addItem
collections.removeItem

// connections
connections.listForItem
connections.createManual
connections.delete

// canvas
canvas.getSnapshot
canvas.saveSnapshot  // debounced on client — save every 3s on change

// chat
chat.getHistory
// note: streaming handled via /api/chat route, NOT tRPC
```

---

## 8. AI Enrichment Pipeline

**Rule: AI enrichment is always async and non-blocking. Items appear in the UI immediately with `enrichStatus: 'pending'`.**

```typescript
// lib/ai/enrichItem.ts
// Triggered by: items.create procedure (via background job / Inngest)

async function enrichItem(itemId: string) {
  const item = await db.query.items.findFirst({ where: eq(items.id, itemId) });

  // 1. Fetch content
  const content = item.type === 'url'
    ? await scrapeUrl(item.rawContent)    // playwright or jina.ai reader
    : item.rawContent;

  // 2. Generate title + summary + tags (single LLM call, JSON output)
  const enriched = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: z.object({
      title:   z.string().max(120),
      summary: z.string().max(160),
      tags:    z.array(z.string().max(24)).max(6),
    }),
    prompt: ENRICH_PROMPT(content),
  });

  // 3. Generate embedding (OpenAI text-embedding-3-small)
  const vector = await embedText(enriched.title + ' ' + enriched.summary);

  // 4. Persist
  await db.update(items).set({
    ...enriched.object,
    embedVector: vector,
    enrichStatus: 'done',
    updatedAt: new Date(),
  }).where(eq(items.id, itemId));

  // 5. Find + persist AI connections (top-3 similar items)
  await suggestAndSaveConnections(itemId, vector);
}
```

**AGENT AVOID:** Never call enrichment synchronously in the tRPC mutation. Never block the API response on scraping or AI calls.

---

## 9. Capture Channels

### 9.1 PWA Share Target
```json
// public/manifest.json share_target
{
  "share_target": {
    "action": "/api/capture",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": { "title": "title", "text": "text", "url": "url" }
  }
}
```
Handler at `/api/capture/route.ts` — authenticates via session cookie, calls `items.create`.

### 9.2 Telegram Bot
- Bot command `/save <url or text>` → POSTs to `/api/capture` with `sourceChannel: 'telegram'`
- On successful save, bot replies with: title, summary, and a "View on Recall" button
- Store `telegramChatId` on user profile to enable bot replies

### 9.3 Email Pipe
- User's unique capture email: `<userId>@capture.recall.yourdomain.com`
- Inbound email → Cloudflare Email Routing → `/api/capture/email`
- Extract subject as title, body as rawContent, attachments → R2

---

## 10. Reminders & Notifications

```typescript
// items have a `remindAt: timestamp` field
// A cron job (Inngest scheduled function, every 1 min) checks for due reminders

// Delivery priority:
// 1. Web Push (if subscribed) — via web-push library
// 2. Telegram (if connected) — bot message
// 3. Email fallback

// Notification payload:
{
  title: item.title,
  body: item.summary,
  icon: item.faviconUrl ?? '/icon-192.png',
  data: { itemId: item.id }
}
// Clicking notification opens /dashboard?item=<id> → auto-opens ItemDetail drawer
```

---

## 11. Anti-Patterns — AGENT AVOID

```
✗ Light mode CSS (Recall is dark-mode first — no light variants)
✗ Multi-step capture flows (one input, one Save, AI does the rest)
✗ Full-page loading spinners (use skeleton cards, never block the grid)
✗ Storing canvas layout per-item in the DB (use one snapshot per user)
✗ Calling AI enrichment synchronously inside tRPC mutations
✗ Raw SQL strings — always use Drizzle query builder
✗ UUIDs or auto-increment IDs — always use cuid2
✗ Exposing R2 bucket URLs directly — always use presigned URLs
✗ Blocking search on embedding generation (keyword fallback always available)
✗ Importing all of tldraw in non-canvas routes (dynamic import only)
✗ Rendering more than 50 ItemCards without virtualization (use @tanstack/virtual)
✗ Any gradient on the brand indigo (#6366f1) — flat fill only
✗ White cards on dark bg with colored borders — use surface fills instead
✗ Showing enrichment loading state as a modal or toast — EnrichBadge on card only
✗ More than 3 tags visible on an ItemCard
✗ Storing the OpenAI API key client-side or in env vars accessible to the browser
```

---

## 12. Do Not Touch (unless the task explicitly modifies these)

```
✗ Drizzle migration files (/drizzle/*.sql) — generate new ones, never edit old
✗ Clerk webhook handler (/api/webhooks/clerk) — user lifecycle logic
✗ PWA manifest share_target config — capture flow depends on exact shape
✗ pgvector index definitions — changing dimensions breaks all existing embeddings
✗ Auth middleware (/middleware.ts) — Clerk route protection config
```

---

## 13. Performance Rules

- **ItemCard grid**: Virtualize with `@tanstack/virtual` when list > 50 items
- **Canvas**: Lazy-load tldraw with `dynamic(() => import('tldraw'), { ssr: false })`
- **Search**: Debounce input 250ms before firing tRPC call
- **Enrichment**: Use Inngest for background jobs — never raw `setTimeout` or `Promise` fire-and-forget
- **Images**: Always use `next/image` with explicit `width`/`height` for OG images
- **Fonts**: `display=swap` on Google Fonts import — never block render

---

## 14. Quick Reference Cheat Sheet

| Element | Font | Size | Color |
|---|---|---|---|
| CaptureBar input | Inter | 14px / 400 | `--color-text-primary` |
| Card title | Inter | 14px / 600 | `--color-text-primary` |
| Card summary | Inter | 13px / 400 | `--color-text-mid` |
| Domain / timestamp | Geist Mono | 11px / 400 | `--color-text-muted` |
| Tag pill | Inter | 11px / 500 | `--color-brand` on `--color-brand-dim` |
| Button primary | Inter | 13px / 600 | white on `--color-brand` |
| CommandBar input | Inter | 14px / 400 | `--color-text-primary` |
| Canvas node title | Inter | 13px / 600 | `--color-text-primary` |
| Chat message | Inter | 14px / 400 | `--color-text-primary` |
| SourceChip | Geist Mono | 11px / 400 | `--color-link` |
| Stat / count | Inter | 22px / 600 | `--color-text-primary` |

| Item Type | CSS Var | Hex |
|---|---|---|
| url | `--color-link` | #38bdf8 |
| note | `--color-note` | #a3e635 |
| file | `--color-file` | #fb923c |
| image/video | `--color-media` | #e879f9 |
| reminder | `--color-reminder` | #facc15 |