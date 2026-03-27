---
name: recall-architecture-system
description: >
  Use this skill when editing Recall architecture, data models, APIs, routing,
  background jobs, and AI pipeline behavior. Covers the canonical stack,
  project structure, Drizzle schema, tRPC procedures, enrichment flow, and
  capture channel boundaries. Use the UI design skill for visual tokens and
  component patterns.
version: 1.0.0
---

# Recall Architecture System
> For AI coding agents generating or editing Recall application structure

## 1. Project Identity

Recall is a frictionless capture and intelligent organisation tool.

**Business model**: open-source core with a hosted SaaS layer.
**Jobs to be done**:
1. Capture anything from any surface.
2. Organise items with AI.
3. Recall items through search, chat, and canvas.
4. Act through reminders and notifications.

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | `/app` directory only, no `pages/` |
| Language | TypeScript (strict) | `noUncheckedIndexedAccess: true` |
| Styling | Tailwind CSS v3 | Use CSS vars for theme tokens |
| Component lib | shadcn/ui | Only import what you use |
| State (server) | tRPC v11 + React Query v5 | All API calls through tRPC |
| State (client) | Zustand | One store per domain |
| Database | PostgreSQL via Neon | Drizzle ORM, never raw SQL strings |
| File storage | Cloudflare R2 | Presigned URLs, never expose bucket directly |
| AI | Vercel AI SDK + OpenAI / Gemini | Model-agnostic via `ai` package |
| Canvas | tldraw v2 | Custom shape types |
| Auth | Clerk | `auth()` server helper in route handlers |
| Notifications | web-push + Telegram Bot API | |
| PWA | next-pwa | Share Target API for capture |

## 3. Data Models

### 3.1 Item

```typescript
export const items = pgTable('items', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull(),
  type: text('type', { enum: ['url', 'note', 'file', 'image', 'video'] }).notNull(),
  rawContent: text('raw_content').notNull(),
  title: text('title'),
  summary: text('summary'),
  fullText: text('full_text'),
  tags: text('tags').array().default([]),
  faviconUrl: text('favicon_url'),
  ogImageUrl: text('og_image_url'),
  embedVector: vector('embed_vector', { dimensions: 1536 }),
  enrichStatus: text('enrich_status', { enum: ['pending', 'done', 'failed'] }).default('pending'),
  sourceChannel: text('source_channel', { enum: ['web', 'pwa-share', 'telegram', 'email', 'api'] }),
  remindAt: timestamp('remind_at'),
  archivedAt: timestamp('archived_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### 3.2 Collection

```typescript
export const collections = pgTable('collections', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  icon: text('icon').default('folder'),
  color: text('color').default('#6366f1'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const itemCollections = pgTable('item_collections', {
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  collectionId: text('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
});
```

### 3.3 Connection

```typescript
export const connections = pgTable('connections', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull(),
  sourceId: text('source_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  targetId: text('target_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  reason: text('reason'),
  strength: real('strength').default(0.5),
  manual: boolean('manual').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});
```

**Rules:**
- Always use `createId()` from `@paralleldrive/cuid2` for IDs.
- Never use UUIDs or auto-increment integers.

## 4. File Structure

```
/app
  /(auth)
  /(app)
    /dashboard
    /canvas
    /chat
    /settings
  /api
    /trpc/[trpc]
    /capture
    /webhooks

/components
  /capture
  /items
  /canvas
  /chat
  /collections
  /ui
  /layout

/lib
  /ai
  /capture
  /db
  /trpc

/stores
  useCapture.ts
  useCanvas.ts
  useChat.ts
  useFilter.ts
```

## 5. tRPC Router Shape

```typescript
items.create
items.list
items.search
items.get
items.update
items.archive
items.delete

collections.list
collections.create
collections.addItem
collections.removeItem

connections.listForItem
connections.createManual
connections.delete

canvas.getSnapshot
canvas.saveSnapshot

chat.getHistory
```

## 6. AI Enrichment Pipeline

**Rule: enrichment is always async and non-blocking.** Items must appear immediately with `enrichStatus: 'pending'`.

```typescript
async function enrichItem(itemId: string) {
  const item = await db.query.items.findFirst({ where: eq(items.id, itemId) });

  const content = item.type === 'url'
    ? await scrapeUrl(item.rawContent)
    : item.rawContent;

  const enriched = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: z.object({
      title: z.string().max(120),
      summary: z.string().max(160),
      tags: z.array(z.string().max(24)).max(6),
    }),
    prompt: ENRICH_PROMPT(content),
  });

  const vector = await embedText(enriched.object.title + ' ' + enriched.object.summary);

  await db.update(items).set({
    ...enriched.object,
    embedVector: vector,
    enrichStatus: 'done',
    updatedAt: new Date(),
  }).where(eq(items.id, itemId));

  await suggestAndSaveConnections(itemId, vector);
}
```

**Rules:**
- Never call enrichment synchronously in the tRPC mutation.
- Never block the API response on scraping or AI calls.

## 7. Capture Channels

### 7.1 PWA Share Target

```json
{
  "share_target": {
    "action": "/api/capture",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": { "title": "title", "text": "text", "url": "url" }
  }
}
```

### 7.2 Telegram Bot

- Bot command `/save <url or text>` posts to `/api/capture` with `sourceChannel: 'telegram'`.
- On success, reply with title, summary, and a "View on Recall" button.

## 8. Guardrails

- Keep architecture guidance out of the UI design skill.
- Keep API and job boundaries explicit.
- Keep prompt content server-side.
- Keep storage access presigned and private.
