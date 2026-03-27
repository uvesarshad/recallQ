---
name: recall-ui-design-system
description: >
  Use this skill when designing or editing Recall UI, layout, styling, and
  component behaviour. Covers visual tokens, spacing, and core interaction
  patterns for the app shell, capture bar, item cards, canvas surfaces, and
  chat drawer. Use the architecture skill for schema, API, and stack guidance.
version: 1.1.0
---

# Recall UI Design System
> For AI coding agents generating or editing Recall interfaces

## 1. Product Identity

Recall is a fast, minimal, trustworthy capture and recall tool.

**Tone**: dense, app-like, calm, and efficient.
**Goal**: make high-density information feel searchable without visual clutter.

### Core UI Priorities
1. Capture must be immediate and visible.
2. Search and recall must feel one step away.
3. Dense data views should stay readable at a glance.
4. Dark-first visual balance should remain consistent across screens.

## 2. Design Tokens

### 2.1 Fonts
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
- Body font-size: 14px, line-height: 1.55
- Headings inside modals/cards: Inter 16px / 600
- The product name "Recall" always renders in Inter 600

### 2.2 Color System

```css
/* CSS variables - define in :root */
--color-bg:          #0f0f11;
--color-surface:     #18181b;
--color-surface-2:   #27272a;
--color-border:      #3f3f46;
--color-border-soft: #27272a;

--color-text-primary: #fafafa;
--color-text-mid:     #a1a1aa;
--color-text-muted:   #71717a;

--color-brand:        #6366f1;
--color-brand-hover:  #818cf8;
--color-brand-dim:    #312e81;
--color-brand-glow:   rgba(99,102,241,0.15);

--color-link:     #38bdf8;
--color-note:     #a3e635;
--color-file:     #fb923c;
--color-media:    #e879f9;
--color-reminder: #facc15;
```

**Rules:**
- Recall is dark-mode first.
- Use semantic item-type colors for type accents, badges, and node strokes.
- Do not introduce light mode unless the task explicitly asks for it.

### 2.3 Border Radius
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

### 2.4 Spacing Scale
Follow Tailwind defaults strictly.

```
gap-2 (8px)  - inline chip gaps
gap-3 (12px) - card inner padding top
gap-4 (16px) - standard component gap
gap-6 (24px) - section spacing inside panels
p-3  (12px)  - compact card padding
p-4  (16px)  - standard card padding
p-5  (20px)  - modal padding
```

## 3. Component Patterns

### 3.1 CaptureBar

The CaptureBar is the global entry point. It should be visible at the top of every app screen.

```tsx
// Behaviour contract:
// - Auto-detects type from paste
// - Submits on Enter or Cmd+Enter
// - Shows a loading spinner briefly, then dismisses optimistically
// - Never shows a multi-step form
// - Keyboard shortcut: Cmd+K focuses it from anywhere
```

**Rules:**
- One input, one action.
- Do not add category dropdowns, tag fields, or notes fields.
- Keep focus states obvious and fast.

### 3.2 ItemCard

```tsx
<article className="item-card" data-type={item.type}>
  <span className="type-accent" />
  <div className="card-header">...</div>
  <h3 className="card-title">{item.title ?? item.rawContent}</h3>
  <p className="card-summary">{item.summary}</p>
  <div className="card-tags">...</div>
</article>
```

**Rules:**
- Use a left-border accent for the item type color.
- Keep titles compact and summaries short.
- Show at most 3 tags in the grid card.

### 3.3 EnrichBadge

AI enrichment status should stay subtle.

```tsx
const EnrichBadge = ({ status }: { status: Item['enrichStatus'] }) => {
  if (status === 'done') return null;
  if (status === 'pending') return <span className="enrich-spinner" aria-label="Processing..." />;
  return <span className="enrich-failed" title="Enrichment failed - click to retry">!</span>;
};
```

### 3.4 CommandBar

The command bar is the global search and action palette.

```tsx
// Triggers: Cmd+K, Cmd+J, Cmd+Shift+C
// Shows: recent items, collections, commands
// Search: debounced semantic + keyword hybrid
```

### 3.5 Canvas

The canvas is Recall's second-brain view. It should feel dense, navigable, and dark-first.

**Rules:**
- Keep nodes readable inside tldraw.
- Use semantic item colors consistently.
- Open detail views outside the canvas DOM when needed.

### 3.6 ChatDrawer

The chat drawer is a right-side panel for chat over the archive.

**Rules:**
- Keep it concise and source-backed.
- Never expose prompt text to the client.
- Use summaries and citations, not full content dumps.

## 4. UI Guardrails

- Avoid heavy shadows.
- Avoid marketing-style rounded cards.
- Avoid full-page loaders when optimistic UI is possible.
- Avoid opinionated onboarding flows in core surfaces.

If you need project architecture, schema, API, or AI pipeline guidance, use [`.agents/skills/architecture/SKILL.md`](/Users/uveskhan/Documents/projects/recally/.agents/skills/architecture/SKILL.md).
