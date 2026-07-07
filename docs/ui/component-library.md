# UI Component Library

> Scope: Shared React components, interactive surfaces, and client UI boundaries.
> Rendering context: Client-side
> Project tier: 4
> Last updated: 2026-07-07

## Overview
RecallQ's web UI is implemented primarily under `apps/web/components/`, with app routes under `apps/web/app/(app)/app/`. The current product surface is a sticky capture header, a masonry archive feed, a freeform canvas, a floating RAG chat dock, settings pages, the Expo mobile app, and the WXT extension.

## Web Components

- `AppShell` (`apps/web/components/AppShell.tsx`): Authenticated wrapper mounted by `apps/web/app/(app)/layout.tsx`. Applies the stored theme, renders `Atmosphere`, `FloatingMenu`, sticky `CaptureBar`, `ChatDock`, `QueryProvider`, and a single global `CreateItemDialog`. `Cmd/Ctrl+Shift+C` opens capture from anywhere.
- `FloatingMenu` (`apps/web/components/FloatingMenu.tsx`): Fixed glass menu in the top-left. Current primary destinations are Feed (`/app`), Canvas (`/app/canvas`), and Settings (`/app/settings/profile`).
- `CaptureBar` (`apps/web/components/CaptureBar.tsx`): Global quick-capture input in the sticky header. Handles URL/text capture, file drag/drop, paste, optimistic status, and archive-created events through the versioned ingest endpoints.
- `CreateItemDialog` (`apps/web/components/CreateItemDialog.tsx`): Modal capture flow for manual text, URL, and file saves. Shares action-preview behavior with item comments and dispatches archive refresh events after successful ingestion.
- `FeedPageClient` (`apps/web/components/FeedPageClient.tsx`): Feed controller for `apps/web/app/(app)/app/page.tsx`. Owns type/source/folder/tag filters, sorting, inline folder creation, column count, selection mode, batch update/delete, load-more pagination, keyboard help, and the lifted `ItemDetailModal`.
- `ControlBar` (`apps/web/components/ControlBar.tsx`): Compact feed toolbar with sort, filter/source/type/folder pills, selection toggle, folder creation shortcut, and column slider. The mobile layout keeps the same controls wrapped rather than moving to a separate drawer.
- `ItemCard` (`apps/web/components/ItemCard.tsx`): Masonry card for archive items. Shows optional preview image with blur placeholder, type/source metadata, title, summary or enrichment shimmer, up to five tags, folder/reminder chips, relative date, desktop hover actions, and mobile overflow actions.
- `ItemDetailModal` (`apps/web/components/ItemDetailModal.tsx`): Centered modal opened from feed cards, canvas nodes, and keyboard shortcuts. Loads item, comments, and folders; supports inline title/summary/tag/folder/reminder edits; provides reminder presets, delete confirmation, comments, and action-preview overrides.
- `KnowledgeMap` (`apps/web/components/KnowledgeMap.tsx`): Freeform canvas for `/app/canvas`. Uses `@xyflow/react` only for pan, zoom, drag, background, and viewport helpers. It renders custom item cards, no edges, no minimap, no type filters, and no side options panel. Positions persist through `PATCH /api/v1/items/[id]`.
- `ChatDock` (`apps/web/components/ChatDock.tsx`): Floating archive chat panel mounted globally by `AppShell`. It streams `/api/v1/chat` responses, displays citations as chips, and remains available without a dedicated chat navigation route.
- `ActionPreview` (`apps/web/components/ActionPreview.tsx`): Preview panel for parsed commands such as folders, tags, and reminders before the user saves a comment or capture.
- `SettingsNav` (`apps/web/components/SettingsNav.tsx`): Settings navigation shared by profile, folders, integrations, billing, and appearance pages under `apps/web/app/(app)/app/settings/`.
- `PWASetup`, `ThemeToggle`, `ThemeToggleClient`, `PasswordField`, and `Tooltip`: Small shared utilities for service-worker registration, theme preference controls, auth forms, and hover labels.

## Cross-Surface UI

- Web settings: `profile`, `folders`, `integrations`, `billing`, and `appearance` live under `apps/web/app/(app)/app/settings/<sub>/`. Folder management is owned by Settings; the feed only has a quick-create shortcut.
- Mobile: `apps/mobile/app/(tabs)/index.tsx`, `capture.tsx`, and `settings.tsx` provide feed, capture, and account settings; `apps/mobile/app/item/[id].tsx` provides item detail. Expo Go covers sign-in, feed, detail, capture, and offline queue flows.
- Extension: `apps/extension/entrypoints/app/` is the pinned-tab local archive app with Feed and Settings; `entrypoints/popup/` saves the current tab; `entrypoints/background.ts` owns the RecallQ context menu and bulk tab offload flows.

## Component Patterns

- Modal overlays use Escape handling and `useModalA11y` where focus management matters.
- Feed and canvas item opening is centralized through a single modal instance per surface.
- Archive-changing UI dispatches archive events so feed and canvas refresh without a full page reload.
- Client components must call public REST routes and must never import `apps/web/lib/db.ts` or server-only environment values.

## Update Triggers
- When a shared component is added, renamed, or deleted inside `apps/web/components/`.
- When a core component prop interface, default state, keyboard shortcut, or archive refresh behavior changes.
- When a primary app, mobile, or extension UI surface is added, removed, or substantially redesigned.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) - Connects components to the product and stack.
- [docs/architecture/rendering-strategy.md](file:///e:/Projects/recallQ/docs/architecture/rendering-strategy.md) - Explains client/server component boundaries.
- [docs/ui/layout-system.md](file:///e:/Projects/recallQ/docs/ui/layout-system.md) - Details route and shell layout.

AGENT OWNER: apps/web/components/
AGENT UPDATE: docs/ui/component-library.md
