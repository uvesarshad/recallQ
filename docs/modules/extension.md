# Module: Chrome Extension

> Scope: The WXT Chrome extension at `apps/extension/`: context-menu tab management, pinned-tab app, capture, and plan-gated cloud sync.
> Rendering context: Browser extension (Manifest V3), not Next.js.
> Project tier: 4
> Last updated: 2026-07-07

## Overview
The extension turns RecallQ into a local-first tab-management and capture tool. All users can save unlimited tabs/URLs into an on-device archive while signed out and offline. Cloud sync is the paid layer.

Main surfaces:
- Background service worker: `entrypoints/background.ts` owns the "RecallQ" context menu and bulk tab operations.
- Popup: `entrypoints/popup/` saves the current tab quickly.
- Pinned app page: `entrypoints/app/` renders the local feed, search, capture, and settings views.

Auth uses a personal access token minted by the web `/extension/connect` bridge and stored in `chrome.storage.local`. It is only required for cloud sync. Cloud API calls go through `packages/api-client/src/index.ts`.

## Local-First Model
- `lib/local-archive.ts` is the on-device source of truth in `chrome.storage.local` with `unlimitedStorage`. Each `LocalItem` carries `{ localId, serverId, type, url, title, note, summary?, tags?, imageUrl?, createdAt, updatedAt, deleted, dirty }`.
- Captures never require network access. Context-menu sends, popup saves, and app-page captures write locally, then fire-and-forget `runSync()` if cloud sync is enabled.
- URL saves deduplicate by normalized URL. Deletes are soft local tombstones until the server accepts the delete.
- Very large archives may later need IndexedDB; `chrome.storage.local` is acceptable while records remain URL-sized.

## Cloud Sync
- Gate: `cloudSyncEnabled`, stored token, and `canUseCloudSync(plan)`.
- Push creates: unsynced local items go to `POST /api/v1/ingest` batch chunks of 100 or fewer.
- Push edits: already-synced dirty items use bearer `PATCH /api/v1/items/[id]`, avoiding duplicate ingest rows.
- Edit scope: title, note, tags, folder ID, reminder time, and pulled archive/link-health metadata share the same client model as mobile.
- Push deletes: local tombstones use bearer `DELETE /api/v1/items/[id]`; acknowledged local tombstones are purged.
- Pull upserts: `GET /api/v1/items?since=<cursor>` returns changed items in sync order.
- Pull deletes: the same delta response includes `deletedItems` from `item_tombstones`; matching local `serverId`s are removed.
- Cursor: the sync cursor is the latest returned item update or tombstone timestamp.
- Conflict policy: server timestamp last-write-wins. The API stamps every accepted edit with `updated_at = NOW()`; dirty local extension rows are not overwritten by pulls and are pushed on the next sync, while clean rows accept the latest server version.

Plan caps still bind on the server. Large backfills on capped plans push what they can and leave remaining dirty items pending for a later retry.

AGENT NOTE: `GET /api/v1/me`, `GET /api/v1/items`, `PATCH /api/v1/items/[id]`, and `DELETE /api/v1/items/[id]` must remain bearer-enabled for extension sync.

## Performance Model
- No content scripts. Tab metadata comes from `chrome.tabs` and `chrome.tabGroups`.
- Stateless service worker. Long-lived state is stored in Chrome storage, not module globals.
- Bulk tab sends save locally and close tabs via batched `chrome.tabs.remove(ids[])`.
- The React app bundle loads only when the pinned app page is opened.

AGENT AVOID: Do not add content scripts or broad `host_permissions` to read tab metadata.

## Context Menu
The parent "RecallQ" menu supports:
- Open RecallQ.
- Send only this tab.
- Send all tabs in this window.
- Send all tabs except this tab.
- Send selected tabs.
- Send all tabs in this tab group.
- Send tabs on the left.
- Send tabs on the right.
- Send all tabs from all windows.
- Exclude/include the active tab for the current browser session.
- Save link and save selection context actions.

Every send saves locally first and works signed out. Cloud sync runs afterward only when enabled. `preventEmptyWindows` creates a blank tab before closing the last tab in a window.

## App Page
- Feed reads `getVisible()` / `search()` from `lib/local-archive.ts` and refreshes from `chrome.storage.onChanged`.
- Inline capture writes local URL/text records.
- Rows show Synced/Pending state when cloud sync is enabled and expose soft delete.
- Settings owns `closeTabsAfterSending`, cloud sync enablement, manual Sync now, and plan/sign-in state.

## Key Files
- `entrypoints/background.ts`: menu tree, click routing, dynamic exclude title, badge feedback.
- `lib/local-archive.ts`: local archive CRUD, URL dedup, tombstones, sync reconciliation.
- `lib/sync.ts`: push/pull/edit/delete cloud sync.
- `lib/tabs.ts`: tab send operations, empty-window protection, pinned app opener.
- `lib/exclusion.ts`: session exclusion set.
- `lib/settings.ts` / `lib/plan.ts`: prefs and plan-gated sync.
- `lib/auth-flow.ts`: `chrome.identity` sign-in bridge.
- `packages/api-client/src/index.ts`: typed API client wrappers used by the extension.

## Known Cuts
- Server tombstones currently retain deleted IDs indefinitely. Add retention after sync windows and account deletion policy are finalized.
- There is no conflict UI for same item edited on multiple devices. Current behavior is last writer wins by server sync order.

## Related Docs
- [docs/modules/capture.md](capture.md): ingest pipeline.
- [docs/modules/billing-settings.md](billing-settings.md): plan tiers.
- [docs/auth/authorization.md](../auth/authorization.md): auth guard boundaries.

AGENT UPDATE: docs/modules/extension.md, docs/overview.md
