# Client State Management

> Scope: Documents client-side React states, prop drilling callbacks, window events, browser local storage, and search input debouncing.
> Rendering context: Client-side
> Project tier: 4
> Last updated: 2026-05-17

## Overview
Recall manages client-side application states without a global state store (such as Zustand or Redux). It depends entirely on React state hooks, structured prop drilling, callback functions, and custom window events to update sibling components. This approach reduces bundle overhead and guarantees instant, local interactive responses.

## UI Local States and Throttling
State variables are isolated inside the components that own them and propagated down through props:
- State Containers: Page managers like FeedPageClient hold central states for items lists, folder records, active filters (tag selections, folder IDs), sort orders, and infinite-scrolling paginations. Dialog containers (ItemDetailModal) maintain states for drafts (titles, summaries, tag inputs, category targets, and reminders).
- Spacing & Throttling: Throttling keyboard searches and semantic inputs is handled via use-debounce hooks to avoid thrashing REST API handlers.
- Modal Controls: Dismissals and view toggles are managed through local boolean states passed down to overlays.

## Component Interaction and Event System
To synchronize states between separate view segments (such as updating feed item grids when cards are patched inside the details modal drawer):
- Prop Drilling Callbacks: Components accept callback hooks (e.g. onItemCreated or onItemUpdated) to propagate mutations upward to parent state managers.
- Browser Custom Events: Components dispatch custom events on the browser window object. This enables distant sibling views (such as the feed list, search dashboard, or interactive graph map) to capture events and reload their local state caches automatically without requiring full-page refreshes.
- Undo Buffer Management: Batch operations (like bulk archiving or deletions) use local timers to store deleted items in a short-term buffer, giving users a brief window to click "Undo" before requests are permanently posted to the database.

## Persistent Local Storage
- Shared Hook: useStoredState in lib/hooks.ts renders the server-safe default first, then hydrates from local storage after mount. This avoids server/client markup mismatches for persisted UI controls.
- Theme Preference: User theme settings are saved under the recall-theme key inside local storage. It is read by the root layout initializer script before hydration, then client controls hydrate to the stored value after React mounts. Without a saved preference, the landing page defaults to light and authenticated app routes default to dark.
- Chat History: Message logs are stored locally in the browser's local storage under unique user keys, keeping AI chat histories secure, isolated, and local to the active device.

## Security Constraints
- AGENT AVOID: Do not introduce Zustand, Redux, or complex state managers. Always prioritize local React states, prop drilling, and custom event dispatches to synchronize UI blocks.
- AGENT NOTE: Always clear local storage caches for chat logs on user sign-out to prevent session leakage on shared devices.

## Update Triggers
- When introducing global state tools or context providers.
- When changing the schema of keys saved inside local storage.
- When changing useStoredState hydration or persistence behavior in lib/hooks.ts.
- When modifying custom window events used to trigger state refetches.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Connects states to tech stack.
- [docs/ui/component-library.md](file:///e:/Projects/recallQ/docs/ui/component-library.md) — Renders interactive modules.
- [docs/state/server-state.md](file:///e:/Projects/recallQ/docs/state/server-state.md) — Details the server fetch flows.

AGENT OWNER: components/FeedPageClient.tsx, lib/hooks.ts
AGENT UPDATE: docs/state/client-state.md
