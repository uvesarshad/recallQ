# Recall v1 Plan — Web + Extension + Mobile Ecosystem

> Status: Draft for review. No code has been changed yet.
> Owner: Claude + uvesarshad
> Target deploy: Self-hosted EC2 + CloudPanel + same-server PostgreSQL.
> Clients in scope: Web (existing), Chrome extension (WXT), Mobile iOS/Android (Expo).
> iOS billing for v1: free-only, no Apple IAP. Razorpay stays web/extension/Android.
> Last updated: 2026-05-21

This plan takes Recall from its current single-app state to a multi-client ecosystem. It's organized in four parts:

- **Part A — Foundation** (monorepo, API v1, shared schemas, token auth). Everything depends on this.
- **Part B — Web v1** (UI simplification + production-ready). Ships first.
- **Part C — Client surfaces** (Chrome extension via WXT, mobile via Expo).
- **Part D — Deploy** (EC2 + CloudPanel + App Store/Play Store/Chrome Web Store).

Stages are sequenced. Each one is independently shippable — we can pause after any stage and the system is in a coherent state.

---

## Final shape of the ecosystem

```
                    ┌────────────────────────────────────┐
                    │   recall.<your-domain>             │
                    │   ┌──────────────┐  ┌───────────┐  │
                    │   │ Web (Next)   │  │ /api/v1   │  │
   ┌───────────────►│   │ cookie auth  │  │ token auth│  │◄───────────────┐
   │ Browser users  │   └──────────────┘  └─────┬─────┘  │                │
   │                └─────────────────────────────┼──────┘                │
   │                                              │                       │
   │                                              ▼                       │
   │            ┌──────────────────┐    ┌──────────────────────┐          │
   │            │  workers/        │    │  PostgreSQL          │          │
   │            │  enrichment +    │    │  + pgvector          │          │
   │            │  reminders       │    └──────────────────────┘          │
   │            └──────────────────┘                                      │
   │                                                                      │
   ▼                                                                      │
┌──────────────┐                                              ┌──────────────────┐
│ Chrome ext   │                                              │ Mobile (Expo)    │
│ (WXT)        │                                              │ iOS + Android    │
│ - context    │                                              │ - capture        │
│   menu save  │                                              │ - share intent   │
│ - popup      │                                              │ - push notifs    │
│ - side panel │                                              │ - offline queue  │
└──────────────┘                                              └──────────────────┘
```

| Surface | Auth | Hits |
|---|---|---|
| Web | NextAuth session cookie | Server Components + `/api/v1/*` |
| Extension | Bearer token (per-device) | `/api/v1/*` |
| Mobile | Bearer token (per-device) + refresh | `/api/v1/*` |
| Workers | Direct DB | — |
| Webhooks (Razorpay, Telegram) | Signature verification | `/api/v1/payments/*`, `/api/v1/telegram/*` |

---

# Part A — Foundation

## Stage 0 — Monorepo restructure

**Goal:** One repo, three apps, shared packages. Done as a single mechanical move so it's not entangled with feature work.

**Tooling:** pnpm workspaces + Turborepo. (pnpm because it handles workspace dependencies cleanly; Turborepo for cached builds across packages.)

**Target layout:**
```
recallQ/
├── apps/
│   ├── web/                 ← current root contents (app/, components/, lib/, public/, etc)
│   ├── extension/           ← new, WXT
│   └── mobile/              ← new, Expo
├── packages/
│   ├── api-schema/          ← Zod schemas for every API endpoint
│   ├── api-client/          ← typed fetch client (used by extension + mobile)
│   ├── core/                ← shared constants (plan limits, command parser, URL helpers)
│   └── tsconfig/            ← shared tsconfig presets
├── workers/                 ← stays at root (Node, not Next, runs on EC2 directly)
├── migrations/              ← stays at root
├── scripts/                 ← stays at root
├── docs/                    ← stays at root
├── package.json             ← workspace root, scripts orchestrate via Turborepo
├── pnpm-workspace.yaml
├── turbo.json
└── PLAN.md / DEPLOY.md / etc
```

**Migration steps (single PR):**
1. `git mv` everything currently at root into `apps/web/` except `workers/`, `migrations/`, `scripts/`, `docs/`, `tests/`, top-level dotfiles.
2. Add `pnpm-workspace.yaml` listing `apps/*`, `packages/*`.
3. Add `turbo.json` with `build`, `dev`, `lint`, `typecheck`, `test` pipelines.
4. Update root `package.json` to be the workspace root (private, no deps of its own beyond turbo + tooling).
5. Update root scripts: `dev` → `turbo run dev --filter=web`, etc.
6. Update CI / `tsconfig` `paths` / any `@/` imports — should mostly Just Work since `@/` is relative to each app's tsconfig.
7. Update `AGENTS.md`, `CLAUDE.md`, and `docs/architecture/folder-structure.md` to reflect the new layout.

**Risk:** Low-medium. The risk is a missed import path or a script that hardcodes `./app/` instead of `./apps/web/app/`. Mitigation: do this before any feature work, run full `turbo run build typecheck lint test` after.

**Acceptance:** `pnpm install && pnpm dev` boots the web app on :3008 exactly as before. Workers still run via `pnpm worker:enrich` / `pnpm worker:reminders` from root.

**Docs to update:**
- `AGENTS.md` — update key file paths (now under `apps/web/`).
- `CLAUDE.md` — same.
- `docs/architecture/folder-structure.md` — rewrite for monorepo.
- `docs/overview.md` — directory map.

---

## Stage 1 — API v1 + shared schemas + token auth

**Goal:** Make `/api/*` a first-class, versioned, externally-consumable API. Everything else (extension, mobile, future integrations) depends on this.

### Versioning

- All routes move from `app/api/*` to `app/api/v1/*`. The actual handler code is mostly unchanged — it's a folder move and a redirect.
- Add `app/api/[...catchall]/route.ts` returning a 404 with `{error: "API version required", code: "version_missing"}` for any non-`v1` API call.
- 301-redirect old unversioned routes (`/api/items/...` → `/api/v1/items/...`) for the web app's transition period; remove after Stage 5.

### Shared Zod schemas (`packages/api-schema`)

Why Zod-shared-REST over tRPC:
- Your API is already REST with ~15 routes — tRPC would mean rewriting all of them.
- Zod schemas give you end-to-end type safety with minimal churn: define once, import in both the server route and the client.
- Plays nicely with `curl`, Postman, future 3rd-party integrations, and AI agents — tRPC binary protocol doesn't.
- If we ever want tRPC, we can wrap these schemas in a tRPC router on top later.

Structure of `packages/api-schema`:
```
packages/api-schema/
├── src/
│   ├── items.ts         ← ItemCreateInput, ItemUpdateInput, Item, ItemList
│   ├── chat.ts          ← ChatRequest, ChatStreamChunk, ChatThread
│   ├── ingest.ts        ← IngestUrlInput, IngestTextInput, IngestFileInput
│   ├── auth.ts          ← LoginInput, TokenIssueRequest, TokenResponse
│   ├── settings.ts      ← ProfileInput, BillingInfo, etc
│   ├── errors.ts        ← Error envelope: { error: string, code: ErrorCode, details?: ... }
│   └── index.ts
└── package.json
```

Each API route handler:
```ts
// apps/web/app/api/v1/items/route.ts
import { ItemCreateInput, Item } from "@recall/api-schema";

export async function POST(req: Request) {
  const parsed = ItemCreateInput.safeParse(await req.json());
  if (!parsed.success) return fail("validation_error", parsed.error, 400);
  // ...
  return ok<Item>(result);
}
```

### Typed API client (`packages/api-client`)

Thin fetch wrapper:
```ts
const client = createRecallClient({
  baseUrl: "https://recall.example.com/api/v1",
  getAuthToken: () => /* extension: chrome.storage / mobile: SecureStore */,
});

const items = await client.items.list({ limit: 50 });   // fully typed
await client.items.create({ url: "https://..." });       // input validated against ItemCreateInput
```
- Used by extension and mobile. Web continues to use Server Components for reads and `fetch` directly for writes (or it can adopt the client too — uniformity is nice but not required).

### Token-based auth alongside cookie session

New table (migration `011_personal_access_tokens.sql`):
```sql
CREATE TABLE personal_access_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,                       -- e.g. "iPhone", "Chrome extension"
  token_hash    TEXT NOT NULL UNIQUE,                -- bcrypt/argon2 hash of the token
  prefix        TEXT NOT NULL,                       -- first 8 chars, shown in UI for identification
  scopes        TEXT[] NOT NULL DEFAULT '{"full"}',
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ
);
CREATE INDEX idx_pat_user ON personal_access_tokens (user_id) WHERE revoked_at IS NULL;
```

New endpoints:
- `POST /api/v1/auth/token` — exchange email+password (or OAuth code) for a token. Returns `{ token, prefix, name }`. Rate-limited.
- `DELETE /api/v1/auth/token/:id` — revoke a specific token.
- `GET /api/v1/auth/tokens` — list user's active tokens (no values, just metadata) for the Settings page.

`lib/request-auth.ts` extends to recognize bearer tokens:
```
1. Try NextAuth session cookie.
2. If absent, try Authorization: Bearer <token> → look up token_hash, return user.
3. Update last_used_at async.
```

Settings page gets a "Connected devices" section showing the active tokens with prefixes + last-used + revoke button.

### CORS

`next.config.ts` adds CORS headers for `/api/v1/*`:
- Allow `Origin: chrome-extension://<your-extension-id>` (we'll know this after Chrome Web Store assigns it; for dev, allow `*` only on `/api/v1/auth/token` and read-only routes; tighten before launch).
- Mobile makes requests without an `Origin` header → no CORS issue.
- Web is same-origin → no CORS issue.

### Rate limiting

Already in original plan (Stage 4 in v0). Token-bucket in Postgres. Key now includes token ID for non-cookie requests, IP for cookie/anon requests.

**Risk:** Medium. Versioning churn touches every route file. Easier if done before UI consolidation (Stage 2 onward) so all subsequent web changes target the new structure.

**Acceptance:**
- Every web feature still works (web goes through `/api/v1/*` now).
- `curl -H "Authorization: Bearer <token>" https://.../api/v1/items` returns the user's items.
- Login from a non-browser client returns a token that works for subsequent calls.
- A revoked token returns 401.

---

# Part B — Web v1 (UI simplification + production ready)

(Everything in this part happens inside `apps/web/`.)

## Stage 2 — Route dedup & feature cuts

**Delete:**
- `apps/web/app/(app)/canvas/` — duplicate route.
- `apps/web/app/(app)/graph/` — duplicate route.
- `apps/web/app/(app)/settings/` (whole tree) — duplicate route.
- `apps/web/app/app/login/` — stray duplicate.
- `apps/web/app/(app)/app/graph/` — feature cut. Canvas covers visualization.
- `apps/web/app/(app)/app/search/` — feature cut. Folds into Feed.

**Add `next.config.ts` redirects:**
- `/canvas` → `/app/canvas`
- `/graph` → `/app/canvas`
- `/settings/:rest*` → `/app/settings/:rest*`
- `/app/graph` → `/app/canvas`
- `/app/search` → `/app`
- `/app/login` → `/login`

**Update `AppShell.tsx`:** the header search bar's submit handler stops `router.push('/app/search?q=')` and instead navigates to `/app?q=` (Stage 3 wires Feed to read it).

**Risk:** Low. Pure structural cleanup.

**Acceptance:** Build + typecheck clean. All nav items reach correct pages. Old URLs redirect.

---

## Stage 3 — Feed = search + Canvas = freeform

### Feed with in-page search

- `apps/web/app/(app)/app/page.tsx` accepts `searchParams.q`.
- If `q` is present: server-side calls the existing search query, hydrates `FeedPageClient` in search-results mode.
- If `q` is absent: existing recent-items behavior.
- `FeedPageClient` renders a small "Searching: 'foo' — clear" pill at the top when in search mode.
- Header search bar's input is bound to `q` (controlled, updates URL via `router.replace` on submit; debounced live preview optional for v2).

### Canvas as Excalidraw-style infinite board

`components/KnowledgeMap.tsx` is heavily stripped:

**Keep:** pan, zoom, drag-to-place, persist `canvas_x` / `canvas_y` / `canvas_pinned`, click to open `ItemDetailModal`, `ARCHIVE_ITEM_CREATED_EVENT` listener.

**Remove:** type-column headers, type filter pills, in-canvas search panel, MiniMap, ReactFlow `Controls`, image-vs-text card height variants (one card style), all auto-layout logic.

**Add:** one floating dock bottom-right with `+ Capture` and `Fit to viewport`. New items appear at the center of the current viewport, not pinned to any column.

### Settings audit

Confirm each subroute (`profile`, `billing`, `integrations`, `appearance`) is meaningful. If `appearance` only contains the theme toggle that's already in the sidebar, fold into `profile` and delete the page.

**Risk:** Medium. Behavior change is subtractive but user-visible.

**Acceptance:** `/app?q=foo` produces the same search results the old `/app/search?q=foo` did. Canvas: drag item, reload, position persists. No more type columns.

---

## Stage 4 — Error / loading / not-found / health

- `apps/web/app/(app)/error.tsx`, `apps/web/app/(app)/loading.tsx`, `apps/web/app/(app)/app/canvas/loading.tsx`, `apps/web/app/(app)/app/chat/loading.tsx`.
- `apps/web/app/not-found.tsx`, `apps/web/app/global-error.tsx`.
- `lib/api-response.ts` with `ok(data)` / `fail(code, message, status)` — every `/api/v1/*` handler returns one of these shapes. Errors never carry stack traces in production.
- `lib/logger.ts` — structured stdout logger, level controlled by `LOG_LEVEL` env. CloudPanel surfaces stdout in its UI.
- New endpoint `/api/v1/health` returning `{ ok, db: 'up'|'down', workers: { enrichment, reminders } }` based on a `worker_heartbeats` table the workers write every 30s.
- Workers add `process.on('unhandledRejection')` + `process.on('uncaughtException')` handlers that log and exit non-zero, letting systemd restart cleanly.

**Risk:** Low.

**Acceptance:** A known error renders the friendly error page, not a stack trace. `/api/v1/health` returns `200 {ok: true}` when everything's running, `503` if a worker hasn't heartbeated in 5 min.

---

## Stage 5 — Security hardening

- **Security headers** in `next.config.ts`: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, CSP (start in `Content-Security-Policy-Report-Only`, flip to enforce after observation).
- CSP `connect-src` must include the production API origin so the extension and mobile can hit it. Web is same-origin.
- **Rate limiting** (Postgres token bucket, table `011_rate_limits.sql` — kept separate from `personal_access_tokens`):
  - `/api/v1/auth/*`: 5 / IP / 15 min.
  - `/api/v1/auth/token`: 5 / IP / 15 min + 10 / email / hour.
  - `/api/v1/ingest/*`: 60 / token / minute.
  - `/api/v1/chat/*`: 30 / user / hour.
- **Per-route audit** (produces `docs/security-audit.md`): for every `app/api/v1/*/route.ts`, confirm auth gate present, Zod validation present, plan limit checked, webhook signature verified.
- **CORS preflight** properly returns 204 for `OPTIONS /api/v1/*` from allowed origins.
- **Secrets:** verify `.env.production` gitignored, env validated through `lib/env.ts` Zod schema at boot, refuses to start in prod with dev-fallback `AUTH_SECRET`.
- **Cookies:** confirm `secure`, `sameSite: 'lax'`, `httpOnly` in production.
- **Token storage:** mobile uses Expo SecureStore (Keychain / EncryptedSharedPreferences). Extension uses `chrome.storage.local` (encrypted at rest by Chrome since MV3).

**Risk:** Medium (CSP). Mitigation: report-only first, observe a week, enforce.

**Acceptance:** `securityheaders.com` ≥ A. Rate-limit triggers return 429. Audit doc shows every route has all four checks ✅.

---

## Stage 6 — Performance & polish (web)

- `next/image` with `placeholder="blur"` for item thumbnails. New column `archive_items.blur_data_url` (migration `012_item_blur.sql`), populated by enrichment worker using `sharp`.
- `next/font/local` for self-hosted fonts.
- Bundle analysis → lazy-load `@xyflow/react` only inside `/app/canvas`. Remove `react-force-graph-2d` if unused after Stage 3.
- `s-maxage` + `stale-while-revalidate` on safe public GET API routes.
- `output: 'standalone'` in `next.config.ts` for smaller deploys.
- Mobile pass at 360px. A11y pass: focus rings, ARIA labels, focus trap in dialogs.

**Acceptance:** Lighthouse mobile ≥ 90 perf / ≥ 95 a11y / ≥ 95 best practices on `/app`. First-load JS for `/app` under 200 KB compressed.

---

## Stage 7 — Visual polish (web)

Done after 2-6 so we polish the final layout, not duplicates. Tighten spacing scale to 3-4 values; single heading font, single body font, single mono; semantic color tokens only (no hex literals in components); real empty states for every list; loading skeletons match final shape; one icon set (`lucide-react`).

May invoke `/design-review` skill here for an opinionated pass.

---

# Part C — Client surfaces

## Stage 8 — Chrome extension (WXT + React)

**Stack:** WXT + React + TypeScript + Tailwind (Tailwind config shared with web via a tiny preset in `packages/core` or duplicated — duplication is fine here).

**Surfaces:**
- **Popup** (toolbar icon click): one-tap "Save this page" with title preview, optional note, collection picker. Shows recent captures from this device.
- **Context menu**: right-click on any link or selection → "Save link to Recall" / "Save selection to Recall".
- **Side panel** (Chrome's new side panel API): full search of your archive without leaving the current tab. Reuses the same Feed UI patterns as web but in the narrower side panel layout.
- **Omnibox**: typing `recall` in the address bar opens search-as-you-type into your archive. (Optional v1.5.)

**Auth flow:**
1. First install → popup shows "Sign in" button.
2. Opens `https://recall.<domain>/extension/connect` (new web page that requires login, then issues a personal access token and posts it back via `window.opener.postMessage` or a custom URL handler).
3. Extension stores token in `chrome.storage.local`.
4. All API calls use it via `@recall/api-client`.

**Permissions (in `wxt.config.ts`):**
- `activeTab` — read URL/title of current tab.
- `contextMenus` — right-click items.
- `sidePanel` — side panel UI.
- `storage` — local storage of token + cache.
- `host_permissions: ['https://recall.<your-domain>/*']` — API calls.

**Manifest version:** 3 (mandatory).

**Code structure (WXT conventions):**
```
apps/extension/
├── entrypoints/
│   ├── popup/         ← React popup UI
│   ├── side-panel/    ← React side panel UI
│   ├── background.ts  ← MV3 service worker (context menu handler, message router)
│   └── content.ts     ← optional: page metadata extraction
├── public/            ← icons
└── wxt.config.ts
```

**Risk:** Low-medium. MV3 service worker lifecycle (it suspends after 30s idle) means stateful in-memory caches won't survive — keep ephemeral state in `chrome.storage.session`.

**Acceptance:** Install unpacked from `apps/extension/.output/chrome-mv3/`, sign in, save the current tab via popup and via context menu. Side panel lists saves. Reload Chrome, still signed in.

**Distribution:** Chrome Web Store (~$5 one-time dev fee). Also publish to Edge Add-ons (free) and Firefox AMO (free) since WXT outputs cross-browser builds.

---

## Stage 9 — Mobile app (Expo + React Native)

**Stack:** Expo SDK 51+ (or latest stable at build time), Expo Router, NativeWind for Tailwind-on-RN, `react-native-mmkv` for fast local storage, Expo SecureStore for tokens, Expo SQLite for offline queue.

**Why Expo (not bare RN):** managed workflow, OTA updates via EAS Update, easier credential management, dev builds without Xcode/Android Studio for most iteration. EAS Build is paid (free tier exists, ~30 builds/month).

**Screens:**
- Onboarding + Sign In (email/password and Google OAuth via `expo-auth-session`).
- Feed (mirror web Feed; reverse-chrono items list, infinite scroll, pull-to-refresh).
- Item detail.
- Capture screen (URL input, text note, file/photo from camera or library).
- Settings (profile, connected devices including the current device's PAT, sign out).

**Native integrations:**
- **iOS Share Extension** + **Android Intent Filter**: configured via Expo config plugins (`expo-share-extension` for iOS, Android intent filter in `app.json`). Tap "Share" in any app → Recall → posts to `/api/v1/ingest`.
- **Universal Links (iOS)** + **App Links (Android)**: `apple-app-site-association` and `assetlinks.json` files served from your web domain so `recall.<domain>/item/abc123` opens in the app if installed.
- **Push notifications** via Expo Push (Expo proxies to APNs and FCM for free):
  - New table `device_tokens(user_id, platform, expo_push_token, created_at, revoked_at)`.
  - Mobile registers token on login → POST `/api/v1/devices/register`.
  - `workers/reminder-worker.ts` adds a delivery branch: for each due reminder, fan out to all the user's registered push tokens via Expo's push API. Email and Telegram delivery stay as-is.
- **Camera / document picker** for file captures (`expo-image-picker`, `expo-document-picker`).
- **Deep links from emails/notifications**: tapping a reminder push opens the relevant item.

**Offline capture queue:**
- Local SQLite table (`pending_captures`) holds offline-created items.
- Background task syncs them on next online event (or app foreground).
- On success, swap the local id for the server id and remove from queue.
- Conflict resolution: server is authoritative; on collision, server wins.

**Auth on iOS/Android:**
- Email/password POST → `/api/v1/auth/token` → store token in SecureStore.
- Google sign-in via `expo-auth-session` (custom URL scheme `recall://auth/callback` registered).
- iOS: also add "Sign in with Apple" since Apple requires it if any 3rd-party social login is present (App Store rule).

**Billing on iOS:** none for v1. App shows "Manage subscription at recall.<domain>" linked-out (carefully — Apple's anti-steering rules; safest pattern: show a generic "Account" link in Settings). Free tier features only inside the app.

**Risk:** High vs the other stages. Mobile has the largest surface area, store review, device-specific quirks, and offline complexity. Suggest treating this as v1.5 (ships after web v1 + extension are live).

**Acceptance:** Both stores accept the build (TestFlight + Google Internal Track). Sign in, capture a link via in-app and via the share sheet, receive a reminder push notification.

**Distribution:**
- Apple Developer Program: $99/year.
- Google Play Developer: $25 one-time.
- TestFlight for iOS beta, Google Internal Track for Android beta — start here before public release.

---

# Part D — Deploy

## Stage 10 — EC2 + CloudPanel + stores

### Web app on EC2 + CloudPanel

**Postgres + pgvector:**
```bash
sudo apt update
sudo apt install -y postgresql-16-pgvector
sudo -u postgres psql -d recall -c "CREATE EXTENSION vector;"
```
Tune `postgresql.conf` for the instance size (suggested 4 GB box: `shared_buffers=1GB`, `effective_cache_size=3GB`, `work_mem=16MB`, `maintenance_work_mem=256MB`).

**Next app via CloudPanel Node.js site type:**
- `output: 'standalone'` in `apps/web/next.config.ts`.
- Document root → the standalone build output.
- Startup command: `node apps/web/.next/standalone/server.js`.
- Node 20 LTS.

**Workers as systemd services (CloudPanel can only supervise one process):**

`/etc/systemd/system/recall-enrichment.service`:
```ini
[Unit]
Description=Recall enrichment worker
After=network.target postgresql.service

[Service]
Type=simple
User=<cp-user>
WorkingDirectory=/home/<user>/htdocs/<domain>/recallQ
EnvironmentFile=/home/<user>/htdocs/<domain>/recallQ/.env.production
ExecStart=/usr/bin/pnpm worker:enrich
Restart=always
RestartSec=10
StandardOutput=append:/var/log/recall-enrichment.log
StandardError=append:/var/log/recall-enrichment.log

[Install]
WantedBy=multi-user.target
```
Same shape for `recall-reminders.service`. Enable + start, add logrotate.

**nginx (via CloudPanel custom config):**
- `client_max_body_size 25M` for uploads.
- `proxy_read_timeout 300s` for chat streaming.
- `proxy_http_version 1.1` + Upgrade/Connection headers.
- gzip text + json + js.

**SSL:** CloudPanel Let's Encrypt button. Then point DNS.

**Firewall:** UFW (OpenSSH + Nginx Full) + fail2ban (`sshd` jail at minimum).

**Backups:** nightly `pg_dump | age -r <pubkey> > /var/backups/recall-$(date +%F).sql.age`, rotation `find ... -mtime +30 -delete`. **Restore the backup once** before declaring deploy ready.

**Telegram webhook:** `pnpm telegram:webhook` after SSL is up.

**Universal Links / App Links files** served from the web domain:
- `https://recall.<domain>/.well-known/apple-app-site-association`
- `https://recall.<domain>/.well-known/assetlinks.json`
- Both static JSON. Add a Next route (no caching) or serve from `public/`.

### Extension distribution

- Chrome Web Store: register dev account ($5), upload `apps/extension/.output/chrome-mv3-production.zip`, fill listing, submit. Review takes 1-3 days typically.
- Edge Add-ons (free): same zip works.
- Firefox AMO (free): WXT outputs a Firefox-compatible build; submit.

### Mobile distribution

- Apple Developer ($99/yr), Google Play ($25 one-time).
- EAS Build for both iOS and Android binaries.
- TestFlight + Google Internal Track for beta.
- App Store + Play Store full submissions only after at least 2 weeks of TestFlight feedback.
- Privacy nutrition labels (Apple) + Data Safety section (Google) — both ask what data you collect; budget half a day filling them.

### Post-deploy checklist

1. `/api/v1/health` returns `{ok: true, db: up, workers: {enrichment: up, reminders: up}}`.
2. Sign up a fresh user on web, capture a URL, watch it enrich (worker logs).
3. Install extension, sign in, save a link from a real site.
4. Install mobile app via TestFlight, sign in, capture via share sheet from Safari, receive a test reminder push.
5. Razorpay sandbox payment via web.
6. Backup restore on a scratch DB succeeds.

---

## Sequencing & estimates

| Stage | What | Effort |
|---|---|---|
| 0 | Monorepo restructure | small (1 focused session, mechanical) |
| 1 | API v1 + shared schemas + token auth | medium-large (2-3 sessions) |
| 2 | Route dedup & cuts | small |
| 3 | Feed-search + freeform Canvas | medium |
| 4 | Error/loading/health | small |
| 5 | Security hardening | medium |
| 6 | Performance & polish (web) | medium |
| 7 | Visual polish (web) | medium, open-ended |
| 8 | Chrome extension (WXT) | medium (1-2 sessions for v1) |
| 9 | Mobile app (Expo) | large (multi-session; recommend v1.5) |
| 10 | EC2/CloudPanel + store submissions | medium |

**Suggested v1 cut line:** Stages 0-8 ship as v1 (web + extension). Stage 9 (mobile) ships as v1.5. Stage 10 (deploy) overlaps — web deploys at end of Stage 7, extension at end of Stage 8, mobile at end of Stage 9.

Stages within Part B (2-7) can be parallelized to some extent; Stages 0 and 1 are blockers for everything else.

---

## Open questions / things I'll confirm during implementation

- **Production domain** — what's the planned hostname? Affects CSP, OAuth redirect URIs, universal links, extension `host_permissions`. Need this before Stage 5.
- **Extension brand name** — same as Recall? Or a separate name for the Web Store listing?
- **`apps/web` vs root `web`** — sticking with `apps/web` per Turborepo convention. Speak up if you want a different layout.
- **Tailwind sharing** — duplicate the config in extension/mobile, or share a preset? Duplicating is simpler; preset is cleaner. Default to duplicate.
- **Search bar `?q=` in URL** — yes, for shareable links. Reverse with a clear-X button.

---

## What I need from you to start

1. **Approve this revised plan.**
2. **Production domain** for Stage 5 / CSP / OAuth.
3. **Confirm v1 = stages 0-8 (web + extension), mobile is v1.5.** If you want mobile in v1, that's fine — just changes the cut line, not the work order.

Once you green-light, I'll start with Stage 0 — the monorepo restructure — as a single dedicated PR before any feature work touches the codebase.
