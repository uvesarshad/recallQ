# RecallQ UI/UX Motion and Animation Audit

> Date: 2026-07-14
> Scope: Client motion surface across two apps — the Next.js web app (`apps/web`) and the WXT Chrome extension (`apps/extension`). Covers easing/duration, physicality, interruptibility, performance, accessibility, cohesion/tokens, and missed opportunities. Mobile (`apps/mobile`) out of scope.
> Method: Static code audit run as six parallel category subagents against the `improve-animations`, `apple-design`, and `emil-design-eng` skill bars. Every cited `file:line` was re-read and confirmed before inclusion. No runtime profiling, frame-rate capture, or real-device gesture testing was available — perf severities are code-derived and flagged where feel can only be confirmed by profiling.

## Executive Summary

The app's motion is competent but uncodified. Springs are used correctly in several places (`FloatingMenu`, `CaptureBar`, the ChatDock panel), no bare `ease-in` exists on any UI element, and `prefers-reduced-motion` is at least attempted. The problems are systemic rather than isolated: there is no motion token layer, so ~27 files hand-type durations (120–500 ms), duplicate a keyframe, and carry five near-identical spring configs. Two defects are real quality issues, not polish: the reduced-motion strategy is simultaneously too blunt (it kills helpful fades) and too weak (it misses every framer-motion spring), and the always-on glass/blur load composites continuously on the highest-frequency scroll path.

Highest-priority issues:
- No `--ease-*` / `--duration-*` / spring tokens; motion values are duplicated and inconsistent across the app (root cause of most findings).
- Reduced-motion is a blanket `!important` clamp that nukes comprehension-aiding opacity fades yet leaves all JS/spring motion running at full strength; `useReducedMotion()` is used in zero files.
- Three full-viewport `blur(80px)` blobs animate behind the entire authenticated app, stacked under per-card `backdrop-filter: blur(14px)` on the scrolling feed.
- Canvas pan animates `left`/`top` (layout) plus `background-position` (paint) via React state every mousemove.
- A literal `scale(0)` entrance on the ChatDock button, and no press feedback on most pressable controls.

The extension is clean on performance (short property-specific transitions, zero infinite loops) — consistent with its documented low-memory posture. Its gaps are press feedback, absent reduced-motion CSS, and flat state-change moments.

## Evidence Reviewed

- Global styles/tokens: `apps/web/app/globals.css`, `packages/tokens` (`@recall/tokens`).
- Web components: `ChatDock.tsx`, `Atmosphere.tsx`, `ItemCard.tsx`, `ItemDetailModal.tsx`, `CreateItemDialog.tsx`, `CaptureBar.tsx`, `ControlBar.tsx`, `FloatingMenu.tsx`, `Tooltip.tsx`, `SettingsNav.tsx`, `KnowledgeMap.tsx`, `FeedPageClient.tsx`, `AppShell.tsx`; `packages/ui/src/Pill.tsx`.
- Web pages: `app/page.tsx` (landing), `app/(app)/app/canvas/canvas-client.tsx`, `settings/*-client.tsx`.
- Extension: `entrypoints/app/{App.tsx,app.css}`, `entrypoints/popup/{Popup.tsx,popup.css}`.

## P0 — Systemic and Accessibility

1. Establish a motion token layer. `apps/web/app/globals.css` tokenizes color/radius/shadow but defines no `--ease-*` or `--duration-*` variables, so ~27 files hand-type motion. Symptoms: `@keyframes float` defined twice with different values (`globals.css:272` `-6px` vs `ChatDock.tsx:25` `-7px`); five near-duplicate spring configs (`{300,24}`, `{260,28}`, `{280,26}`, `{280,28}`, `{300,28}` across ChatDock/CaptureBar/ItemCard/FloatingMenu); durations typed as 0.15/0.18/0.2/0.3/0.5 s and 160 ms for the same classes of transition. Add a small set (2 durations, one strong `ease-out` = `cubic-bezier(0.23,1,0.32,1)`, one or two shared springs) to `@recall/tokens` and converge call sites onto it. This unblocks most findings below.

2. Fix reduced-motion — it is both over-broad and under-powered. `globals.css:312-318` is the only reduced-motion handling in the web app: a blanket `*{animation-duration:.01ms; transition-duration:.01ms} !important`. It nukes comprehension-aiding opacity/color fades (`fadeIn`, action-icon reveals at `ItemCard.tsx:500`, `shimmer`) that reduced-motion should keep, and it does not touch framer-motion springs (inline transforms via JS/rAF), `@xyflow/react` viewport tweens, or `scrollIntoView({behavior:"smooth"})`. `useReducedMotion()` appears in zero files. Scope the CSS rule to movement only, keep opacity/color fades, and add `useReducedMotion()` branches to `ItemCard`, `ChatDock`, `FloatingMenu`, and `CaptureBar`.

3. Tame always-on glass/blur on the feed scroll path. `Atmosphere.tsx:24,39,54` renders three full-viewport blobs at `filter: blur(80px)` (4× the ~20px budget) on infinite loops, mounted app-wide at `AppShell.tsx:84` — they composite continuously behind the scrolling feed. Every feed card additionally carries `backdrop-filter: blur(14px)` (`ItemCard.tsx:420`), so a masonry feed stacks dozens of blur layers over the animated Atmosphere. Reduce blob blur to ~24–40px (or gate Atmosphere to idle/landing surfaces), and reduce/flatten per-card blur on scroll. Frame-rate impact needs profiling to quantify, but the always-on cost is structural.

## P1 — Performance and Physicality

1. Rewrite canvas pan to a compositor transform. `canvas-client.tsx:114,123-124,181` animates `background-position` (paint) and the card layer's `left`/`top` (layout) via React `setPos` on every mousemove, forcing a full re-render plus relayout each frame over `blur(14px)` cards. Move the layer with a single `transform: translate3d()` and take pan position off React render state.

2. Fix the `scale(0)` entrance. `ChatDock.tsx:175,177` uses `initial={{scale:0}}` / `exit={{scale:0}}` on the chat FAB — the element appears from nothing. Start at `scale(0.9)` with opacity per the physicality rule.

3. Add a press-feedback system. Pressable controls lack any `:active` / `whileTap` response: `packages/ui/src/Pill.tsx:43` (toolbar pills), `apps/extension/entrypoints/popup/popup.css:81` and `app.css:33` (all extension buttons incl. the primary Save action), and the feed card `ItemCard.tsx:393`. Add a token'd `scale(0.97)` press state. Note existing correct examples to match: `FloatingMenu` and `CaptureBar` already use `whileTap`.

4. Use framer-motion `transform` strings, not `x`/`y` shorthand, on load-sensitive elements. `ItemCard.tsx:395` animates `whileHover={{ y: -3 }}` (main-thread rAF, not hardware-accelerated) on every feed card. Prefer the full `transform: "translateY(...)"` string.

5. Eliminate `transition: all`. Six occurrences animate unintended properties off-GPU: `SettingsNav.tsx:49`, `settings/appearance/…:93`, `settings/billing/…:361,380,452`, `settings/folders/…:416`, `EmailAddressCopy.tsx:47` (plus pervasive `transition-all` on the landing page, lower severity). Name exact properties.

6. Trim overlong/weak interactive transitions. `ItemCard.tsx:477` uses `transition: transform 0.5s ease` on the preview image — 500 ms exceeds the <300 ms interactive budget with a weak `ease` curve on a 100+/day element. Retarget to ~200 ms token'd `ease-out`.

## P2 — Interruptibility, Origin, and Cleanup

1. Tooltip should not restart on every hover. `Tooltip.tsx:45` mounts with a keyframe (`animate-in … zoom-in-95`) that replays from zero as the pointer crosses toolbar icons, and uses default center `transform-origin`. Use a transition (interruptible), anchor the origin toward the trigger, and make subsequent tooltips instant.

2. Reduce perpetual decorative motion on always-visible chrome. `ChatDock.tsx:196` runs `float 3.5s infinite` on the constantly-visible FAB (no functional purpose); it also focuses the input behind a fixed `setTimeout(…, 320)` (`ChatDock.tsx:45`) instead of on animation completion.

3. Add `prefers-reduced-transparency` / `prefers-contrast` fallbacks for the glass design (`backdrop-filter` is pervasive but neither media query is handled anywhere), and gate landing-page `hover:-translate`/`group-hover:scale` behind `@media (hover:hover) and (pointer:fine)` so the lift does not stick on touch.

4. Remove the dead keyframe reference. `ItemCard.tsx:764` sets `animation: "pulse …"` referencing a keyframe that does not exist in `globals.css` (only `pulse-ring`) — currently a no-op.

## Missed Opportunities (Additive)

1. Feed masonry has no exit/reflow/swap motion — the single biggest seam. `FeedPageClient.tsx:948-967` maps cards into a plain grid; deletes teleport, filter reflow jumps between columns, and search swaps hard-cut. Enter is already handled (`dropIn` on fresh inserts). Wrap in `AnimatePresence` + `layout` with a subtle `opacity`+`scale(0.97)` exit.
2. Modal exits are asymmetric. `ItemDetailModal.tsx` animates enter (`fadeIn`/`popIn`) but closes via `return null` (`:171`) with no exit; `CreateItemDialog.tsx:193` has no enter or exit at all. Give both the shared modal motion via `AnimatePresence`.
3. Extension delight moments render flat (all high-value, extension has no framer-motion — use CSS): feed rows teleport on every `storage.onChanged` reload (`App.tsx:177`); the Synced/Pending badge is an instant grey→green swap (`App.tsx:184`) — the core "it synced" payoff; the popup save confirmation appears with no motion (`Popup.tsx:108`) — the flow's one reward moment. Keep all three subtle and fast (high frequency).
4. Chat bubbles and end-of-stream citation chips pop in abruptly (`ChatDock.tsx:322,370`) — a subtle fade/rise would smooth the two most-watched moments.

## Verified Correct (Not Findings)

Modals stay centered (correct — exempt from origin-awareness); `FloatingMenu`/`CaptureBar` `whileTap` and origin-aware open; `KnowledgeMap` gestures are native `@xyflow/react` (interruptible, no lockout); the `.shimmer` skeleton utility is genuinely wired; `popIn` (scale .92→1) and `dropIn` avoid `scale(0)`; all framer transitions specify a spring type; no bare `ease-in` on any UI element. The extension has no performance findings.

## Recommended Execution Order

1. Foundation: motion tokens in `@recall/tokens`, dedup the `float` keyframe, converge the five springs, kill `transition: all`, fix the 500 ms image and dead `pulse` (P0.1, P1.5, P1.6, P2.4). Unblocks the rest.
2. Accessibility correctness: scope the reduced-motion rule, add `useReducedMotion()` branches, add transparency/contrast fallbacks, gate hover for touch (P0.2, P2.3).
3. Performance: Atmosphere blur, per-card blur on scroll, canvas pan compositor rewrite (P0.3, P1.1) — profile before/after to confirm frame-rate wins.
4. Physicality polish: `scale(0)` fix, press-feedback system, framer `transform` strings, Tooltip origin/interruptibility, ChatDock float/focus (P1.2–P1.4, P2.1–P2.2).
5. Additive delight: feed `AnimatePresence`/`layout`, modal exits, extension row/badge/popup-save motion, chat bubbles (Missed Opportunities 1–4).

## Documentation Follow-Ups

- Update `docs/ui/theming.md` when motion tokens (`--ease-*`, `--duration-*`, spring presets) are added to the token layer.
- Update `docs/ui/component-library.md` after the press-feedback, modal-exit, and Tooltip changes land.
- Update `docs/modules/extension.md` if extension row/badge/popup motion is added (currently documented as motion-light for performance).
- Note in `docs/architecture/rendering-strategy.md` any reduced-motion / `useReducedMotion()` conventions adopted app-wide.

AGENT OWNER: docs/plan/
AGENT UPDATE: docs/overview.md
