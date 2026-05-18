# UI Theming and Design Tokens

> Scope: Documents typography fonts, color system variables, border radiuses, spacing, and styling constraints.
> Rendering context: Client-side
> Project tier: 4
> Last updated: 2026-05-17

## Overview
Recall is designed around a clean, app-like, dark-first visual aesthetic. Global styles are defined in app/globals.css, utilizing tailwind design classes and vanilla CSS variables loaded on the document element. Browser theme preference is stored under recall-theme, validated through lib/theme.ts, and applied by the root beforeInteractive Script plus hydrated client controls. This layout promotes readability, avoids heavy shadows, and enforces clean high-density text interfaces.

## Typography and Fonts
Recall implements a strict typographic scale using two primary fonts, ignoring general system defaults:
- UI and Body Font: Inter (weights 400, 500, 600) loaded dynamically from Google Fonts. Used across all interfaces, modal dialogs, buttons, and navigation blocks. Base size is set to 14px with a 1.55 line height.
- Monospace Font: Geist Mono (weights 400, 500) loaded via next/font/local from the geist package. Applied to data elements such as URLs, item identifiers, timestamps, vector lists, and code blocks.
- Logo and Titles: The brand name "Recall" is always rendered in Inter 600. Headings inside modals use Inter 16px with a font weight of 600.

## Color Token System
All color codes are defined inside app/globals.css as custom CSS variables in the root selector. The authenticated app uses app-* tokens, while the marketing landing page uses landing-* tokens so it can switch between a white light theme and the dark-first presentation without changing product-shell contrast.

### Structural Colors
- Background: color-bg is dark charcoal #0f0f11.
- Primary Surface: color-surface is dark zinc #18181b.
- Secondary Surface: color-surface-2 is zinc-zinc #27272a.
- Border Line: color-border is zinc-gray #3f3f46.
- Soft Border: color-border-soft is zinc-zinc #27272a.

### Text Hierarchy
- Primary Header: color-text-primary is off-white #fafafa.
- Mid Text: color-text-mid is neutral gray #a1a1aa.
- Muted Details: color-text-muted is dim gray #71717a.

### Brand Accents
- Brand Indigo: color-brand is #6366f1.
- Brand Hover: color-brand-hover is light indigo #818cf8.
- Brand Dim: color-brand-dim is dark navy #312e81.
- Brand Glow: color-brand-glow is a semi-transparent purple.

### Semantic Type Accents
- Web URLs: color-link is sky-blue #38bdf8.
- Notes and Text: color-note is lime-green #a3e635.
- Files: color-file is orange #fb923c.
- Media: color-media is pink-magenta #e879f9.
- Reminders: color-reminder is gold-yellow #facc15.

### Landing Page Theme Tokens
- Scope: app/page.tsx consumes landing-bg, landing-nav-bg, landing-surface, landing-control, landing-border, and landing-text variables from app/globals.css.
- Light Mode: html[data-theme="light"] keeps a white landing background but adds a subtle blue, indigo, pink, and teal wash, tinted controls, soft glass-like cards, and low-elevation colored shadows.
- Dark Mode: root and html[data-theme="dark"] preserve the original dark landing palette with white-alpha surfaces and indigo accent lighting.
- Theme Toggle: components/ThemeToggleClient.tsx on the landing navbar starts from light when no preference is saved, updates recall-theme, and the root beforeInteractive script plus hydrated client controls apply the matching data-theme.

## Border Radius and Spacing
- Cards: border-radius of 10px.
- Modals: border-radius of 14px.
- Interactive Buttons and Input Fields: border-radius of 8px.
- Badges and Chips: border-radius of 100px.
- Canvas Elements: border-radius of 12px.
- Spacing Constants: Uses Tailwind's grid scale. Inline gaps use gap-2. Modals and cards implement standard paddings from p-3 (compact) to p-4 (normal) and p-5 (modal interiors).

## Styling Constraints
- AGENT AVOID: Never introduce light-mode backgrounds or override text color schemes with absolute white backgrounds unless explicitly commanded.
- AGENT NOTE: Always apply semantic accent variables to items based on their type data attribute to maintain visual consistency.
- AGENT NOTE: Theme preference clients should reuse lib/theme.ts constants and helpers instead of duplicating dark/light/system parsing logic.
- AGENT NOTE: Client theme controls must not read localStorage during the first render; use useStoredState so server and hydration markup match.

## Update Triggers
- When the stylesheet app/globals.css is edited or global Tailwind configuration updates.
- When lib/theme.ts changes theme preference values, storage keys, or applied-theme logic.
- When colors are added, renamed, or their color hashes change.
- When landing-* tokens or landing page theme classes change.
- When border radiuses or spacing guidelines are restructured.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Connects high-level styles.
- [docs/ui/component-library.md](file:///e:/Projects/recallQ/docs/ui/component-library.md) — Renders the cards and shells.
- [docs/ui/layout-system.md](file:///e:/Projects/recallQ/docs/ui/layout-system.md) — Base HTML configuration.

AGENT OWNER: app/globals.css, lib/theme.ts
AGENT UPDATE: docs/ui/theming.md
