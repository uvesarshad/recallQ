# Module: Chrome Extension

> Scope: The WXT Chrome extension at `apps/extension/` — context-menu tab management, the pinned-tab app, capture, and plan-gated settings sync.
> Rendering context: Browser extension (Manifest V3), not Next.js.
> Project tier: 4

## Overview
The extension turns RecallQ into a tab-management + capture tool living in the browser. **It is local-first:** all users save unlimited tabs/URLs into an on-device archive, free, fully signed-out and offline. The **cloud** (saving to the RecallQ server + cross-device sync) is the **paid** layer. Three surfaces:
- **Background service worker** (`entrypoints/background.ts`) — the "RecallQ" right-click menu with bulk tab operations.
- **Popup** (`entrypoints/popup/`) — one-tap local save of the current tab.
- **App page** (`entrypoints/app/`) — a full-page React app opened as a deduped, pinned tab ("Open RecallQ"): feed, search, capture, and settings — all reading the local archive.

Auth (a personal access token minted by the web `/extension/connect` bridge, stored in `chrome.storage.local` via `lib/auth-storage.ts`) is **only needed to enable cloud sync** — every capture path works without it. Cloud API calls go through the typed `@recall/api-client` singleton (`lib/client.ts`).

## Data model: local-first
- **`lib/local-archive.ts`** is the on-device source of truth — a JSON array in `chrome.storage.local` (the `unlimitedStorage` permission lifts the quota). Each `LocalItem` carries `{ localId, serverId, type, url, title, note, summary?, tags?, imageUrl?, createdAt, updatedAt, deleted, dirty }`. Saves dedup by normalized URL; deletes are soft (tombstones) until their delete is pushed.
- **Captures never hit the network directly.** Context-menu sends (`lib/tabs.ts`), the popup, and the app's capture box all write to the local archive, then fire-and-forget `runSync()` (a no-op unless cloud is on).
- **`lib/sync.ts`** — two-way cloud sync, gated by `cloudSyncEnabled` + a stored token + `canUseCloudSync(plan)`. **Push:** new local items → `ingest.batch` (≤100/req, record `serverId`s); soft-deletes → `DELETE /items/:id`. **Pull:** `GET /items?since=<cursor>` delta (updated_at ASC), upserting into the local store, dedup by `serverId` then URL. **Backfill** happens for free since every un-synced item is `dirty` until its first push.
- **Plan caps still bind on the server.** `ingestItem` enforces the per-plan monthly save cap, so a large backfill on a capped plan (Starter 100/mo) pushes what it can and leaves the rest `dirty` to retry — surfaced as "N pending (monthly cloud limit)", never silently dropped. A partial push self-heals: the next pull reconciles the server-created rows to local items by URL, so they're never re-pushed as duplicates.

## Performance model (the design priority)
- **No content scripts.** Nothing is injected into pages. Every bit of tab data (url, title, index, groupId) comes from the `chrome.tabs` / `chrome.tabGroups` APIs, so per-page memory stays at zero.
- **Stateless service worker.** MV3 suspends idle workers after ~30s. `background.ts` registers listeners synchronously and keeps zero top-level state — all state is in `chrome.storage` (`session` for the exclusion set + plan cache, `local`/`sync` for settings).
- **Local-first + batched sync.** Bulk tab sends write to the local archive (instant, offline) and close tabs in one `chrome.tabs.remove(ids[])` call. Cloud sync (when on) pushes in chunks of ≤100 (`bulkIngestPayloadSchema` cap) and pulls via a delta cursor — never per-item requests.
- **Lazy app page.** The app React bundle only loads when the pinned tab is opened. The background bundle ships no React.

AGENT AVOID: Do not add a content script or `host_permissions` for `<all_urls>` to read tab metadata — the `tabs` permission already provides url/title for all tabs. Adding content scripts breaks the zero-per-page-memory guarantee.

## Context menu (`entrypoints/background.ts`)
A parent **"RecallQ"** menu (contexts `page` + `action`) with these children. The active tab `T` is the tab the menu was invoked on.

| Item | Tabs sent | After send |
|---|---|---|
| Open RecallQ | — | focus-or-create the pinned app tab (works signed-out) |
| Send only this tab | `[T]` | close T |
| Send all tabs in this window | all in window (incl. T) | close all → one fresh blank tab (full reset) |
| Send all tabs except this tab | window minus T | close them; T stays |
| Send selected tabs | highlighted tabs | close them |
| Send all tabs in this tab group | tabs sharing `T.groupId` | close them |
| Send tabs on the left | `index < T.index` | close them; T stays |
| Send tabs on the right | `index > T.index` | close them; T stays |
| Send all tabs from all windows | every tab in every window minus T | close them; T stays |
| Exclude/Include [tab] | — | toggle T's id in the session exclusion set |

Plus the context-specific items: **Save link** (`link` context) and **Save selection** (`selection` context).

Key behaviors:
- **Local-first, no auth gate.** Every send saves to the local archive (`addUrls`) and works fully signed-out; a cloud sync runs afterward only if enabled. The badge reads "Saved N · closed N".
- **Offload-and-clear.** Sends close their saved tabs, gated by the `closeTabsAfterSending` setting (default on). The "window" reset works because `preventEmptyWindows` (`lib/tabs.ts`) seeds a blank tab into any window a bulk close would empty — which also prevents a stray "send only this tab" from closing the whole browser.
- **Exclusion** (`lib/exclusion.ts`) is per-tab-id, session-scoped (`chrome.storage.session`), cleared on tab close via `chrome.tabs.onRemoved`. Excluded tabs are neither saved nor closed by any bulk op. The menu title tracks the active tab via `onActivated`/`onUpdated`/`onFocusChanged` and flips Exclude⇄Include.

## App page (`entrypoints/app/`)
A WXT HTML entrypoint (`index.html` → `app.html`). `App.tsx` renders Feed and Settings views; opened/deduped by `openOrFocusApp` in `lib/tabs.ts` (`chrome.tabs.query({ url: app.html })` → focus, else create pinned).
- **Feed** — reads the **local archive** (`getVisible` / `search`), refreshing on `chrome.storage.onChanged` for the archive key (so background saves + sync pulls appear live). Inline capture writes local (URL → `addUrls`, else `addText`). Each row shows a Synced/Pending badge when cloud sync is on, and a Delete (soft-delete) action.
- **Settings** — `closeTabsAfterSending` toggle, the plan-gated **Sync to cloud** toggle, a **Sync now** button (when enabled), and the plan/sign-in state.

## Settings + plan-gated cloud sync
- `lib/settings.ts` — typed prefs (`closeTabsAfterSending`, `cloudSyncEnabled`) in `chrome.storage.local`.
- `lib/plan.ts` — `getPlan()` reads `apiClient.me.get()` and caches it in `chrome.storage.session` (5-min TTL) so the stateless worker doesn't hit `/me` repeatedly. `canUseCloudSync(plan)` = `plan !== "free"`.
- Enabling **Sync to cloud** signs the user in if needed, re-checks the plan, then runs a sync (backfilling all local items). The toggle is **disabled with an upgrade hint for free users**. The gate is client-side, but the server's `ingestItem` plan cap is the real backstop. Canonical tier definition: `canUseCloudSync` in `apps/web/lib/plan-limits.ts`.

AGENT NOTE: `GET /api/v1/me`, `GET /api/v1/items` (incl. the `?since=` delta), and `DELETE /api/v1/items/:id` are bearer-enabled (`requireUser`) specifically so the extension can read plan + feed and run two-way sync. If you re-scope any of them to `requireSessionUser`, sync breaks.

## Known v1 cuts (logged, not silent)
- **Server→local deletions don't propagate** (no tombstones on the server); the `?since=` delta catches new + edited items only. Local→server deletes do propagate.
- **Edits to already-synced items aren't re-pushed** (no cloud update path via ingest without duplicating); `dirty` is cleared without pushing.
- Very large archives may warrant an IndexedDB backing later; `chrome.storage.local` is fine while items are URL-sized.

## Manifest (`wxt.config.ts`)
Permissions: `activeTab`, `contextMenus`, `storage`, `identity`, `tabs`, `tabGroups`, `unlimitedStorage`. Host permissions: `https://recallq.xyz/*` (+ `http://localhost:3008/*` in dev, stripped on Firefox). MV3.

## Key files
- `entrypoints/background.ts` — menu tree, click routing, dynamic exclude title, badge feedback.
- `lib/local-archive.ts` — on-device store (CRUD, URL dedup, soft-delete, sync reconcile).
- `lib/sync.ts` — two-way cloud sync (push/pull/backfill), gated.
- `lib/tabs.ts` — `sendTabs` (local save + sync), per-op tab-list builders, `preventEmptyWindows`, `openOrFocusApp`.
- `lib/exclusion.ts` — session exclusion set.
- `lib/settings.ts` / `lib/plan.ts` — prefs + cloud-sync gating.
- `lib/auth-flow.ts` — shared `signInWithRecallQ` (chrome.identity → `/extension/connect`).
- `entrypoints/app/` — pinned-tab app (local Feed, Settings).
- `packages/api-client/src/index.ts` — `ingest.batch`, `me.get`, `items.list({ since })`, `items.delete`.

## Related Docs
- [docs/modules/capture.md](capture.md) — the ingest pipeline these sends feed into.
- [docs/modules/billing-settings.md](billing-settings.md) — plan tiers behind the sync gate.
- [docs/auth/authorization.md](../auth/authorization.md) — `requireUser` vs `requireSessionUser`.

AGENT UPDATE: docs/modules/extension.md, docs/overview.md
