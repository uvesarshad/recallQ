# Module: Chrome Extension

> Scope: The WXT Chrome extension at `apps/extension/` — context-menu tab management, the pinned-tab app, capture, and plan-gated settings sync.
> Rendering context: Browser extension (Manifest V3), not Next.js.
> Project tier: 4

## Overview
The extension turns RecallQ into a tab-management + capture tool living in the browser. It has three surfaces:
- **Background service worker** (`entrypoints/background.ts`) — the "RecallQ" right-click menu with bulk tab operations.
- **Popup** (`entrypoints/popup/`) — one-tap capture of the current tab (from v0.1).
- **App page** (`entrypoints/app/`) — a full-page React app opened as a deduped, pinned tab ("Open RecallQ"): feed, search, capture, and settings.

Auth is a personal access token minted by the web `/extension/connect` bridge and stored in `chrome.storage.local` (`lib/auth-storage.ts`). All API calls go through the typed `@recall/api-client` singleton (`lib/client.ts`).

## Performance model (the design priority)
- **No content scripts.** Nothing is injected into pages. Every bit of tab data (url, title, index, groupId) comes from the `chrome.tabs` / `chrome.tabGroups` APIs, so per-page memory stays at zero.
- **Stateless service worker.** MV3 suspends idle workers after ~30s. `background.ts` registers listeners synchronously and keeps zero top-level state — all state is in `chrome.storage` (`session` for the exclusion set + plan cache, `local`/`sync` for settings).
- **Batched sends.** Bulk tab sends chunk into requests of ≤100 items (the server's `bulkIngestPayloadSchema` cap) via `apiClient.ingest.batch`, and close tabs in one `chrome.tabs.remove(ids[])` call.
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

Plus the v0.1 context-specific items: **Save link** (`link` context) and **Save selection** (`selection` context).

Key behaviors:
- **Offload-and-clear.** Sends close their sent tabs, gated by the `closeTabsAfterSending` setting (default on). The "window" reset works because `preventEmptyWindows` (`lib/tabs.ts`) seeds a blank tab into any window a bulk close would empty — which also prevents a stray "send only this tab" from closing the whole browser.
- **Exclusion** (`lib/exclusion.ts`) is per-tab-id, session-scoped (`chrome.storage.session`), cleared on tab close via `chrome.tabs.onRemoved`. Excluded tabs are neither sent nor closed by any bulk op. The menu title tracks the active tab via `onActivated`/`onUpdated`/`onFocusChanged` and flips Exclude⇄Include.
- **Partial sends.** A mid-batch plan save-cap returns 402 with `details.imported_count`; only those tabs close, and the badge reads "Sent X of N · limit reached".
- **Auth gate.** Sends require a stored token; without one, the badge says "Sign in to RecallQ first" and the app page opens.

## App page (`entrypoints/app/`)
A WXT HTML entrypoint (`index.html` → `app.html`). `App.tsx` renders Feed and Settings views; opened/deduped by `openOrFocusApp` in `lib/tabs.ts` (`chrome.tabs.query({ url: app.html })` → focus, else create pinned).
- **Feed** — `apiClient.items.list` with cursor pagination ("Load more", no virtualization lib to stay light), debounced search via `items.list({ q })`, inline quick-capture (URL → `ingest.url`, else `ingest.text`).
- **Settings** — the `closeTabsAfterSending` toggle and the plan-gated sync toggle (below).

## Settings + plan-gated sync
- `lib/settings.ts` — typed prefs persisted in `chrome.storage.local` (always) and mirrored to `chrome.storage.sync` when `syncEnabled`. Reads prefer the synced copy. `chrome.storage.sync` propagates across the user's signed-in Chrome profiles natively (no RecallQ backend).
- `lib/plan.ts` — `getPlan()` reads `apiClient.me.get()` and caches it in `chrome.storage.session` (5-min TTL) so the stateless worker doesn't hit `/me` repeatedly. `canSyncSettings(plan)` = `plan !== "free"`.
- The sync toggle is **disabled with an upgrade hint for free users**. This is a **client-side entitlement** — acceptable because the synced data lives in the user's own Google account, not RecallQ servers. The canonical tier definition is `canUseDeviceSync` in `apps/web/lib/plan-limits.ts`.

AGENT NOTE: `GET /api/v1/me` and `GET /api/v1/items` are bearer-enabled (`requireUser`) specifically so the extension can read plan + feed. If you re-scope either to `requireSessionUser`, the extension breaks.

## Manifest (`wxt.config.ts`)
Permissions: `activeTab`, `contextMenus`, `storage`, `identity`, `tabs`, `tabGroups`. Host permissions: `https://recallq.xyz/*` (+ `http://localhost:3008/*` in dev, stripped on Firefox). MV3.

## Key files
- `entrypoints/background.ts` — menu tree, click routing, dynamic exclude title, badge feedback.
- `lib/tabs.ts` — `sendTabs`, per-op tab-list builders, `preventEmptyWindows`, `openOrFocusApp`.
- `lib/exclusion.ts` — session exclusion set.
- `lib/settings.ts` / `lib/plan.ts` — prefs + plan gating.
- `lib/auth-flow.ts` — shared `signInWithRecallQ` (chrome.identity → `/extension/connect`).
- `entrypoints/app/` — pinned-tab app (Feed, Settings).
- `packages/api-client/src/index.ts` — `ingest.batch`, `me.get`, `items.list`.

## Related Docs
- [docs/modules/capture.md](capture.md) — the ingest pipeline these sends feed into.
- [docs/modules/billing-settings.md](billing-settings.md) — plan tiers behind the sync gate.
- [docs/auth/authorization.md](../auth/authorization.md) — `requireUser` vs `requireSessionUser`.

AGENT UPDATE: docs/modules/extension.md, docs/overview.md
