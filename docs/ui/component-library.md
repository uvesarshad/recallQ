# UI Component Library

> Scope: Catalogs all shared presentational and state-connected React components, props, interactive behaviors, and boundaries.
> Rendering context: Client-side
> Project tier: 4
> Last updated: 2026-05-17

## Overview
Recall features a dense, clean, app-like UI component library situated in the components folder. All components are optimized for dark-first high-density info displays, utilizing micro-animations, standard state-driven inputs, and direct REST API client fetches.

## Core Component Catalog

- AppShell: Path is components/AppShell.tsx. Serves as the primary authenticated layout wrapper. Accepts user prop containing id, name, email, and optional avatar image. It renders the vertical navigation sidebar, global search header, Capture button, mobile bottom navigation tab bar, theme controls, and sidebar toggle states. The sidebar primary navigation includes Feed, Canvas, Chat, and Settings; graph mode is reached from the Canvas view toggle instead of a separate sidebar item.
- CaptureBar: Path is components/CaptureBar.tsx. Standalone quick-capture form retained for focused capture surfaces. Features a text input matching pasted URLs, drag-and-drop bindings for local files, and an instant paste button. Triggers loading status on submit, posts to api/ingest, and triggers optimistic success events.
- ItemCard: Path is components/ItemCard.tsx. Standard grid card. Accepts item prop matching ArchiveItem type. Renders type accent left borders using semantic type colors, a title, brief summary, date tags, and up to three tag chips. Click events open the item details drawer.
- ItemDetailModal: Path is components/ItemDetailModal.tsx. Full drawer overlay. Accepts itemId and open controls. Displays full scraped text, editing forms for titles and summaries, tag managers, and reminder inputs. Dismisses instantly on overlay clicks or Escape key presses.
- FeedPageClient: Path is components/FeedPageClient.tsx. Central dashboard feed controller. Accepts initialItems, initialHasMore, initialNextCursor, and folders list. Manages sorting orders, category filters, tag filters, mobile drawer views, and batch-action select lists with a short undo deletion delay.
- KnowledgeMap: Path is components/KnowledgeMap.tsx. Interactive visualization graph. Imports react-force-graph-2d for 2D node-edge maps and reactflow for flowchart block views. Manages similarity score threshold sliders, search highlights, item filters, collapsible options panels, and links to item details modals on node clicks.
- ActionPreview: Path is components/ActionPreview.tsx. Small preview panel. Accepts preview items. Displays inferred folder targets, tags, and reminder times from the api/actions/preview endpoint to provide real-time feedback while writing notes.
- CreateItemDialog: Path is components/CreateItemDialog.tsx. Dialog block for manual item creation. Supports drag-and-drop file ingestion, notes fields, and category selections.
- Tooltip: Path is components/Tooltip.tsx. Simple hover tooltip bubble wrapper. Accepts children nodes and a label text.
- PasswordField: Path is components/PasswordField.tsx. Client password input used by auth pages. Keeps the standard input styling and adds a right-aligned lucide Eye/EyeOff button to toggle password visibility without moving layout.
- ThemeToggle and ThemeToggleClient: Paths are components/ThemeToggle.tsx and components/ThemeToggleClient.tsx. Client-only theme controls that cycle dark, light, and system preferences under recall-theme. ThemeToggleClient accepts an optional initialTheme prop; the landing page passes light so first-time visitors see the white landing theme while the app shell keeps its dark-first default.
- PWASetup: Path is components/PWASetup.tsx. Lightweight utility that loads service workers and registers share targets.
- SettingsNav: Path is components/SettingsNav.tsx. Vertical navigation sidebar for setting groups (profile, integrations, billing).

## Component Composition and Patterns
- Dialog Overlays: All modals (such as ItemDetailModal and CreateItemDialog) bind keydown event listeners to the window object to close on Escape key presses. They also check event targets on click to dismiss when users click outside the container.
- Semantic Accents: Item cards utilize custom data-type attributes that apply tailwind border strokes matching the item's semantic category color (blue for URLs, green for notes, orange for files).

## Security Constraints
- AGENT AVOID: Never hardcode user IDs inside component fetchers. All API calls must rely on server-side session resolution or authorization headers.
- AGENT NOTE: When using react-force-graph-2d inside components/KnowledgeMap.tsx, ensure the component checks window presence to bypass SSR failures.

## Update Triggers
- When a shared component is added, renamed, or deleted inside components/.
- When the prop interface or default states of a core component change.
- When an interactive behavior (like Escape key handlers or drag-and-drop bindings) is modified.
- When ThemeToggle preference cycling or initialTheme behavior changes.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Connects components to tech stack.
- [docs/architecture/rendering-strategy.md](file:///e:/Projects/recallQ/docs/architecture/rendering-strategy.md) — Explains client component rules.
- [docs/ui/layout-system.md](file:///e:/Projects/recallQ/docs/ui/layout-system.md) — Details the AppShell routing wrappers.

AGENT OWNER: components/
AGENT UPDATE: docs/ui/component-library.md
