# UI/UX Motion Audit Task List

> Date: 2026-07-14
> Source report: `docs/plan/2026-07-14-uiux-motion-audit.md`
> Scope: Execution backlog generated from the UI/UX motion and animation audit (web app + Chrome extension).
> Status key: Done, Next, Planned, Later

## Guiding Direction

The audit found the motion problems are systemic, not isolated. Fix the foundation first (a motion token layer) so the per-component work converges instead of adding more one-off values. Accessibility correctness (reduced-motion) is a real defect, not polish, and ranks with the foundation. Performance items are code-derived and should be profiled before/after. Additive delight comes last, kept subtle because most of it sits on high-frequency surfaces. Preserve what the audit verified as already correct (centered modals, existing `whileTap` springs, native `@xyflow/react` gestures, the wired `.shimmer`).

## P0 - Systemic and Accessibility

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P0.1 | Done | Establish a motion token layer and converge call sites. | DONE (2026-07-14): `@recall/tokens` exports `MOTION` (`duration.fast/base`, `ease.out/inOut`) plus `SPRING_UI` (critically damped) and `SPRING_POP`; matching `--duration-*`/`--ease-*` CSS vars added to `globals.css` and `tokens.css`; `@keyframes float` defined once (ChatDock `FLOAT_KEYFRAMES` removed); all five spring configs (ChatDock ×2, CaptureBar, ItemCard, FloatingMenu) reference `SPRING_UI`; component transition strings use `var(--ease-out)`/`var(--duration-*)`. Typecheck + build green. |
| P0.2 | Done | Rebuild reduced-motion so it keeps fades and covers springs. | DONE (2026-07-14): the `globals.css` blanket no longer clamps `transition-duration` (opacity/color fades and the theme-change fade survive), still stops looping/decorative keyframes and adds `scroll-behavior: auto`; `useReducedMotion()` branches added to `ItemCard`, `ChatDock`, `FloatingMenu`, and `CaptureBar` so framer springs collapse to opacity-only; ChatDock smooth-scroll gated. Needs a manual OS-flag feel-check (deferred to QA). |
| P0.3 | Next | Reduce always-on glass/blur on the feed scroll path. | PARTIAL (2026-07-14): Atmosphere blob blur reduced `80px → 40px` and opacity `0.5 → 0.4` (the objectively over-budget part; no profiling needed); AppShell mount left in place with a comment flagging it composites app-wide. REMAINING: per-card `backdrop-filter: blur(14px)` reduction/removal on scroll needs a profiling pass + scroll detection — deliberately deferred, not code-reviewed away. |

## P1 - Performance and Physicality

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P1.1 | Done | Rewrite canvas pan to a compositor transform. | DONE (2026-07-14): pan no longer calls `setPos` per mousemove — the card layer moves via `transform: translate3d()` written straight to the DOM through refs (`willChange: transform`), with `posRef` as the live value and `pos` state synced only on release; the inner layer's `left/top` are gone. Grid `background-position` is written directly (not via React state). Typecheck + build green; still needs a manual profiling/feel-check pass on the canvas (deferred to QA). |
| P1.2 | Done | Fix the `scale(0)` ChatDock entrance. | DONE (2026-07-14): ChatDock FAB `initial`/`exit` now use `scale: 0.9` with opacity (reduced-motion collapses to opacity-only); no `scale(0)` remains in scope. Landed with P0.2. |
| P1.3 | Done | Add a token'd press-feedback system to pressables. | DONE (2026-07-14): `Pill.tsx` got a pointer-pressed `scale(0.97)` (React state fallback — framer-motion isn't a `@recall/ui` dep — reduced-motion aware); extension `button:active { scale(0.97) }` added to `app.css`/`popup.css` (reduced-motion gated); ItemCard card got `whileTap: 0.985` and `GlassActionBtn` got pressed-scale feedback. Transient text buttons (Cancel/Delete) left as-is. |
| P1.4 | Later | Use framer `transform` strings on load-sensitive motion. | DEFERRED (low value): `ItemCard` `whileHover={{ y: -3 }}` is already reduced-motion-gated and one-shot; converting the framer `y` shorthand to a raw `transform` string is a marginal micro-opt that fights framer's idiom. Revisit only if profiling shows dropped frames on feed hover. |
| P1.5 | Done | Eliminate `transition: all`. | DONE (2026-07-14): all six `transition: all` uses (SettingsNav, appearance/billing×3/folders settings, EmailAddressCopy) replaced with explicit token'd property lists (only properties that actually change; no transform/width/height). Landing-page `transition-all` accepted as marketing-surface (movement-hover gated for touch under P2.3). |
| P1.6 | Done | Trim overlong/weak interactive transitions. | DONE (2026-07-14): `ItemCard.tsx` preview-image transition is now `transform var(--duration-base) var(--ease-out)` (0.2s, was `0.5s ease`); other ItemCard/CaptureBar/ChatDock/FloatingMenu transition strings tokenized under budget. Landed with P0.1. |

## P2 - Interruptibility, Origin, and Cleanup

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P2.1 | Done | Make the Tooltip interruptible and origin-aware. | DONE (2026-07-14): tooltip is now always-mounted and driven by opacity/transform off `active` (interruptible CSS transition, not a restarting keyframe); `transform-origin` + a 4px hidden offset point toward the trigger per `position`; reduced-motion → opacity-only; added `role="tooltip"`/`aria-hidden`. Instant-on-subsequent-hover NOT done (no shared open-state; would need a provider) — noted. |
| P2.2 | Next | Reduce perpetual FAB motion and fix focus timing. | PARTIAL (2026-07-14): focus timing fixed — the fixed `setTimeout(320)` is replaced with a `requestAnimationFrame` focus so the input is usable immediately; the `float` bob is now gated off under reduced motion but is RETAINED for default users. Remaining: product decision on dropping/softening the idle bob for everyone. |
| P2.3 | Done | Add transparency/contrast fallbacks and gate touch hover. | DONE (2026-07-14): added `@media (prefers-reduced-transparency: reduce)` (raises glass token alphas toward opaque, drops class-based blur) and `@media (prefers-contrast: more)` (near-solid borders/surfaces) to globals.css; landing movement-hovers gated via a `no-touch-lift` class under `@media (not (hover:hover)),(pointer:coarse)`. KNOWN LIMIT: inline `backdrop-filter` on components (shell header etc.) can't be reached from CSS — token alpha bump helps inline `background` consumers but per-component blur removal is a follow-up. |
| P2.4 | Done | Remove the dead `pulse` keyframe reference. | DONE (2026-07-14): removed the no-op `animation: "pulse 1.5s ..."` from ItemCard's enriching dot (the `pulse` keyframe never existed). Landed with P1.3. |

## P3 - Additive Delight (Missed Opportunities)

| ID | Status | Task | Acceptance checks |
|---|---|---|---|
| P3.1 | Next | Animate feed removal, reflow, and swap. | DEFERRED (deliberate): framer `layout` animation over a CSS-columns masonry (`FeedPageClient`) is janky without visual iteration; this is the biggest additive win but wants a focused, feel-checked pass rather than a fire-and-forget edit. Not attempted in the fan-out. |
| P3.2 | Done | Give modals symmetric enter/exit. | DONE (2026-07-14): `ItemDetailModal` and `CreateItemDialog` wrapped in `AnimatePresence` (removed bare `if (!open) return null`; hooks kept unconditional, a11y/focus/scroll-lock intact); overlay opacity fade + box `opacity`+`scale(0.96)` on `SPRING_UI`, reduced-motion → opacity-only; both stay centered. All call sites render unconditionally so exits play. |
| P3.3 | Done | Add extension state-change motion (CSS only). | DONE (2026-07-14): plain-CSS only (no framer added). `button:active` press; `.item-row` `row-in` entrance; `.badge` Pending→Synced cross-fade (works because `App.tsx` keys rows by stable `localId`); popup + app `.status` save-confirmation rise/fade; reduced-motion blocks added to both extension stylesheets. |
| P3.4 | Done | Smooth chat bubble and citation entrances. | DONE (2026-07-14): message bubbles and end-of-stream citation chips fade/rise via `motion.div`/`motion.button` under `AnimatePresence initial={false}` (existing bubbles don't re-animate during streaming; stable keys), 40ms chip stagger, reduced-motion → opacity-only; streamed token text untouched. |

## Milestone Order

1. Foundation: P0.1, then P1.5, P1.6, P2.4 (converge onto tokens as they land).
2. Accessibility correctness: P0.2, P2.3.
3. Performance: P0.3, P1.1 (profile before/after).
4. Physicality polish: P1.2, P1.3, P1.4, P2.1, P2.2.
5. Additive delight: P3.1, P3.2, P3.3, P3.4.

## Notes

- Source audit: `docs/plan/2026-07-14-uiux-motion-audit.md`. Do not re-fix items the audit verified as correct (centered modals, `FloatingMenu`/`CaptureBar` `whileTap`, `@xyflow/react` gestures, the wired `.shimmer`, `popIn`/`dropIn`).
- Performance severities are code-derived; P0.3 and P1.1 acceptance requires an actual profiling pass, not just code review.
- Detailed, self-contained implementation specs (exact cubic-beziers, spring params, file excerpts) can be generated per task under `plans/` via the `improve-animations` workflow when execution starts.

AGENT OWNER: docs/plan/
AGENT UPDATE: docs/overview.md
