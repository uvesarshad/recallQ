# Recall Implementation Todo

This checklist expands `PRD.md` into concrete implementation tasks. It preserves the required build order from Section 14 and includes setup, backend, frontend, worker, and verification work.

## Phase 1 - Foundation

### 1. Project bootstrap
- [x] Initialize Next.js 15 app with App Router and TypeScript.
- [x] Add Tailwind CSS and base styling setup.
- [x] Add core npm dependencies:
  - [x] `next`, `react`, `react-dom`
  - [x] `next-auth`
  - [x] `pg`
  - [x] `nanoid`
  - [x] `zod`
  - [x] `resend`
- [x] Create initial folder structure:
  - [x] `app/(auth)`
  - [x] `app/(app)`
  - [x] `app/api`
  - [x] `lib`
  - [x] `components`
  - [x] `workers`
  - [x] `migrations`
  - [x] `public`
- [x] Add `.env.example` with all variables from the PRD.
- [x] Add `.gitignore` entries for `.env*`, build output, logs, and local data.

### 2. Database and migration
- [x] Create `migrations/001_initial.sql`.
- [x] Copy the schema from the PRD exactly, including:
  - [x] `users`
  - [x] `collections`
  - [x] `items`
  - [x] `item_relations`
  - [x] `reminders`
  - [x] all required indexes
  - [x] `vector` and `uuid-ossp` extensions
- [x] Add a migration runner script, e.g. `npm run db:migrate`.
- [x] Create a reusable PostgreSQL connection module in `lib/db`.
- [x] Verify pgvector extension availability locally.

### 3. Auth and user bootstrap
- [x] Configure NextAuth.js v5 with JWT session strategy.
- [x] Add Google OAuth provider.
- [x] Add email magic link auth using Resend.
- [x] Create auth route handlers and session utilities.
- [x] Implement user creation/upsert flow on first sign-in.
- [x] Auto-generate `inbound_email_address` on signup using `nanoid(10) + '@saves.' + APP_DOMAIN`.
- [x] Ensure new users default to plan `free`.
- [x] Add protected route handling for all `/app` pages and protected `/api` routes.

### 4. Shared backend utilities
- [x] Add env validation module for required runtime variables.
- [x] Add request auth helpers for:
  - [x] session-based auth
  - [x] internal bot token / trusted internal ingestion flow if needed
- [x] Add standardized API response helpers.
- [x] Add validation schemas for ingest payloads and item updates.
- [x] Add plan-limit helper for saves, reminders, file uploads, and email gating.
- [x] Add date/time helper with IST-aware reminder parsing support.

### 5. Core ingest flow
- [x] Implement `POST /api/ingest`.
- [x] Accept URL and text/manual saves for Phase 1.
- [x] Validate authenticated session.
- [x] Check `users.saves_this_month` against plan limits.
- [x] Insert item with:
  - [x] `enriched = false`
  - [x] correct `type`
  - [x] `source` as `web` or `manual`
  - [x] raw content fields populated
- [x] Increment `users.saves_this_month` on successful save.
- [x] Return success immediately without enrichment.
- [x] Add placeholder enqueue trigger or worker-visible pending state.

### 6. Feed UI
- [x] Build authenticated app shell for `/app`.
- [x] Build quick capture bar for URL/text paste and submit-on-Enter.
- [x] Build reverse-chronological item list UI.
- [x] Add item card component showing:
  - [x] title
  - [x] summary placeholder/loading state
  - [x] type icon
  - [x] source badge
  - [x] tags when present
  - [x] relative created time
- [x] Show a subtle loading/shimmer state for unenriched items.
- [x] Fetch and render saved items from the backend.
- [x] Confirm that saving from the quick capture bar updates the feed correctly.

### 7. PWA setup
- [x] Add `public/manifest.json`.
- [x] Add the exact `share_target` config from the PRD.
- [x] Add service worker support.
- [x] Register service worker in the app.
- [x] Implement `POST /api/share-target` as multipart form handler.
- [x] Ensure share target returns `303` redirect to `/app?saved=true`.
- [x] Add success toast/banner when `saved=true` is present.

### 8. Phase 1 verification
- [x] Sign in with Google.
- [x] Sign in with magic link.
- [x] Confirm new user row is created with generated inbound email address.
- [x] Save a URL manually and see it appear in the feed.
- [x] Save plain text manually and see it appear in the feed.
- [x] Confirm response from `/api/ingest` returns before enrichment runs.
- [x] Verify Android share target posts into the app and redirects correctly.

## Phase 2 - Capture Surfaces

### 9. Telegram bot integration
- [x] Create Telegram bot configuration helpers.
- [x] Implement webhook registration script or setup instructions.
- [x] Implement `POST /api/telegram/webhook`.
- [x] Verify `X-Telegram-Bot-Api-Secret-Token` header on every request.
- [x] Parse Telegram update payload safely.
- [x] Handle `/connect {token}` command.
- [x] Match `telegram_link_token` to user.
- [x] Save `users.telegram_chat_id` and clear the token.
- [x] Send confirmation back to Telegram chat.

### 10. Telegram linking UX
- [x] Add Settings page under `/app/settings`.
- [x] Add Integrations page under `/app/settings/integrations`.
- [x] Add "Connect Telegram" action that generates `telegram_link_token`.
- [x] Display instruction text with `/connect {token}`.
- [x] Implement `GET /api/user/telegram-status`.
- [x] Poll every 3 seconds until the account is linked.
- [x] Show linked state in the UI when successful.

### 11. Telegram ingest handling
- [x] Support `message.text` containing a URL.
- [x] Support `message.text` without a URL as note/text item.
- [x] Support `message.document`:
  - [x] download file from Telegram
  - [x] store it on local filesystem
  - [x] create file item
- [x] Support `message.photo`:
  - [x] select the largest size
  - [x] download file
  - [x] create file item
- [x] Support forwarded messages and extract usable content.
- [x] Parse reminder intent from accompanying message text/caption into `capture_note`.
- [x] Reply with confirmation including saved title and reminder summary when applicable.

### 12. Email inbound
- [x] Implement `POST /api/email/inbound`.
- [x] Verify Resend inbound webhook signature.
- [x] Match inbound `to` address to `users.inbound_email_address`.
- [x] Ignore unknown addresses without failing loudly.
- [x] Parse:
  - [x] `subject` to title hint
  - [x] `text` and `html` body to content
  - [x] attachments to local filesystem
- [x] Create item records via shared ingest logic, not duplicate code paths.
- [x] Enforce plan gating so free users cannot use email capture.
- [x] Send save confirmation reply email to sender.

### 13. File storage foundation
- [x] Add filesystem storage utility rooted at `FILES_BASE_PATH`.
- [x] Save files under `/data/files/{user_id}/{item_id}/{original_filename}`.
- [x] Ensure directories are created recursively.
- [x] Enforce max upload sizes by plan.
- [x] Enforce accepted MIME types from the PRD.
- [x] Add authenticated streaming route `GET /api/files/[...path]`.
- [x] Ensure files are never publicly exposed as static assets.

### 14. Phase 2 verification
- [x] Link Telegram from the settings page.
- [x] Send URL to Telegram bot and confirm save.
- [x] Send plain text to Telegram bot and confirm save.
- [ ] Send a document and photo to Telegram bot and confirm files are stored.
- [ ] Forward an email into the unique inbound address and confirm save.
- [x] Confirm free-plan user is blocked from email capture.

## Phase 3 - AI Enrichment

### 15. Worker runtime
- [x] Create `workers/enrichment-worker.ts`.
- [x] Implement polling loop every 5 seconds.
- [x] Limit processing to max 5 unenriched items per batch.
- [x] Read model from `process.env.GEMINI_MODEL` with default `gemini-2.5-flash`.
- [x] Add worker-safe DB access and logging.
- [x] Ensure failures do not crash the full loop.

### 16. Content extraction
- [x] For URL items:
  - [x] fetch with 5-second timeout
  - [x] handle non-200 responses gracefully
  - [x] parse HTML with `cheerio`
  - [x] extract `og:title`, `og:description`, `og:image`, `<title>`, first 1000 chars of body text
- [x] For text/note items:
  - [x] use `raw_text` directly
- [x] For file items:
  - [x] parse PDFs with `pdf-parse`
  - [x] parse DOCX with `mammoth`
  - [x] parse XLS/XLSX with `xlsx`
  - [x] truncate extracted text to 3000 chars

### 17. Gemini enrichment
- [x] Add Gemini client wrapper.
- [x] Implement enrichment prompt exactly as specified.
- [x] Enforce JSON-only parsing and validation.
- [x] Populate:
  - [x] `title`
  - [x] `summary`
  - [x] `tags`
  - [x] detected reminder
- [x] Generate embedding with `text-embedding-004`.
- [x] Build embedding input from `title + summary + tags`.
- [x] Update item row with enriched fields and timestamps.
- [x] Insert reminder row when reminder intent is returned.

### 18. Relation building
- [x] Query top 10 nearest neighbors from pgvector for the current item.
- [x] Exclude the current item and scope by `user_id`.
- [x] Filter similarity threshold to greater than `0.75`.
- [x] Upsert `ai_similar` relations.
- [x] For URL items, compare domains and upsert `ai_same_domain` relations.
- [x] Ensure relation uniqueness matches DB constraint.

### 19. Feed enrichment UX
- [x] Refresh feed data or revalidate cache so items update after enrichment.
- [x] Replace shimmer/loading state with real title, summary, and tags.
- [x] Ensure items with enrichment failures degrade gracefully.

### 20. Phase 3 verification
- [x] Save a URL and confirm enrichment fills title, summary, and tags asynchronously.
- [x] Save a note and confirm enrichment works without scraping.
- [x] Save supported file types and confirm extracted text is processed.
- [ ] Confirm embedding is stored in DB.
- [x] Confirm reminder rows are created when capture note contains reminder intent.
- [ ] Confirm related items are inserted into `item_relations`.

## Phase 4 - Search and Chat

### 21. Search backend
- [x] Add full-text search support on title, summary, raw text, and tags.
- [x] Decide whether to use generated `tsvector` expression or inline SQL query.
- [x] Implement `GET /api/search?q=&mode=`.
- [x] Support `fulltext`.
- [x] Scope all search to authenticated `user_id`.
- [x] Embed query using Gemini `text-embedding-004` for semantic/hybrid search.
- [x] Query pgvector with cosine distance operator.
- [x] Merge and rank hybrid results.
- [x] Separate exact/full-text and semantic result groups for UI use.

### 22. Search UI
- [x] Create `/app/search`.
- [x] Add debounced search input with 300 ms delay.
- [x] Render grouped sections:
  - [x] exact matches
  - [x] semantic matches
- [x] Highlight matching snippets/terms where possible.
- [x] Add empty, loading, and no-results states.

### 23. Chat backend
- [x] Implement `POST /api/chat`.
- [x] Accept conversation messages and optional `conversation_id`.
- [x] Embed the latest user message.
- [x] Retrieve top 10 relevant items via pgvector.
- [x] Build system prompt with current date, IST timezone, and retrieved items.
- [x] Stream Gemini response as SSE.
- [x] Ensure answers are constrained to retrieved content only.
- [x] Add citation metadata so UI can show source items.

### 24. Chat UI
- [x] Create `/app/chat`.
- [x] Build chat layout with streaming assistant messages.
- [x] Add suggested prompts on empty state.
- [x] Render citations below assistant responses with links to saved items.
- [x] Handle loading, partial tokens, and error states.

### 25. Phase 4 verification
- [x] Confirm exact keyword matches are found through full-text search.
- [ ] Confirm semantically similar but non-identical items appear in semantic mode.
- [ ] Confirm hybrid mode merges both result sets.
- [ ] Confirm chat streams responses progressively.
- [ ] Confirm chat refuses to invent answers when content is absent.

## Phase 5 - Canvas View

### 26. Graph API and item detail support
- [x] Implement `GET /api/graph`.
- [x] Return only allowed node fields.
- [x] Return relation edges without embeddings or raw text.
- [x] Implement item detail fetch route if not already present.

### 27. tldraw setup
- [x] Install `tldraw`.
- [x] Create `/app/canvas`.
- [x] Add tldraw editor integration.
- [x] Create custom shapes:
  - [x] `UrlCard`
  - [x] `FileCard`
  - [x] `NoteCard`
- [x] Display icon, title, summary preview, and tag chips inside each shape.

### 28. Canvas behaviors
- [x] Load all items and relations from `/api/graph`.
- [x] Reconstruct initial tldraw document from saved data.
- [x] Render AI relation arrows for strengths greater than `0.75`.
- [x] Map relation labels.
- [x] Open right-side item detail drawer on card click.
- [x] PATCH `canvas_x` and `canvas_y` on drag-end with 500 ms debounce.
- [x] Allow pinning cards and persist `canvas_pinned`.
- [ ] Save user-drawn links as `user_linked` relations.

### 29. Auto-placement and graph view
- [x] Implement auto-placement for newly enriched items.
- [x] Prefer clustering near highest-strength related item when available.
- [x] Fall back to spiral-from-center layout when no related items exist.
- [x] Replace `tldraw` with a custom canvas/graph implementation suited to Recall.
- [x] Create `/app/graph` as secondary visualization.
- [ ] Color nodes by collection and vary shape by item type.
- [x] Scale edge thickness by relation strength.
- [ ] Add filter controls for tag, type, collection, and date range.

### 30. Phase 5 verification
- [x] Confirm canvas loads all items and relations.
- [x] Confirm dragging updates persisted positions.
- [ ] Confirm reloading preserves positions from DB.
- [ ] Confirm AI arrows render only for strong enough relations.
- [ ] Confirm manual links persist as `user_linked`.
- [ ] Confirm graph view opens item detail on node click.

## Cross-cutting backend APIs

### 42. Items and collections APIs
- [x] Implement `GET /api/items` with filters for query, tag, collection, and type.
- [x] Add cursor-based pagination for feed scrolling.
- [x] Implement `GET /api/items/[id]`.
- [x] Implement `PATCH /api/items/[id]` for title, tags, collection, reminder, and canvas positions.
- [ ] Implement `DELETE /api/items/[id]` as soft delete.
- [x] Implement `GET /api/items/[id]/related`.
- [x] Implement collections CRUD routes.
