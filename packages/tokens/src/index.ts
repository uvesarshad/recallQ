export const T = {
  // Backgrounds
  wash: "#F7F9FC",
  surface2: "#EEF2F8",

  // Text
  ink: "#0B1220",
  inkSoft: "#5A6478",
  inkFaint: "#9AA4B8",

  // Brand
  azure: "#3D7DFF",
  azureDeep: "#2B5FD9",

  // AI signal — reserved for machine-generated content only
  mint: "#22C9A8",

  // Structural
  line: "rgba(11,18,32,0.07)",
  glass: "rgba(255,255,255,0.55)",
  glassEdge: "rgba(255,255,255,0.75)",

  // Shadows
  shadowSoft: "0 2px 12px rgba(17,34,68,0.06)",
  shadow: "0 8px 30px rgba(17,34,68,0.08)",
  shadowLift: "0 18px 50px rgba(17,34,68,0.16)",
} as const;

export type TokenKey = keyof typeof T;

// CSS custom property names matching T
export const CSS = {
  wash: "var(--color-wash)",
  surface2: "var(--color-surface2)",
  ink: "var(--color-ink)",
  inkSoft: "var(--color-ink-soft)",
  inkFaint: "var(--color-ink-faint)",
  azure: "var(--color-azure)",
  azureDeep: "var(--color-azure-deep)",
  mint: "var(--color-mint)",
  line: "var(--color-line)",
  glass: "var(--color-glass)",
  glassEdge: "var(--color-glass-edge)",
  shadowSoft: "var(--shadow-soft)",
  shadow: "var(--shadow)",
  shadowLift: "var(--shadow-lift)",
} as const;

export const FONT = "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";
export const MONO = "'Geist Mono', ui-monospace, 'SF Mono', monospace";

// ── Motion ────────────────────────────────────────────────────────
// Single source of truth for durations and easing. Keep interactive UI
// transitions under ~200ms; use a strong ease-out for enter/response and
// ease-in-out for on-screen A→B movement. Mirrored as CSS custom properties
// (--duration-*, --ease-*) in globals.css / tokens.css for CSS call sites.
export const MOTION = {
  duration: {
    fast: "0.16s", // press feedback, hovers, color changes
    base: "0.2s", // dropdowns, small popovers, image reveals
  },
  ease: {
    out: "cubic-bezier(0.23, 1, 0.32, 1)", // strong ease-out — enter / response
    inOut: "cubic-bezier(0.77, 0, 0.175, 1)", // on-screen A→B movement
  },
} as const;

// Framer-motion spring presets. Reserve springs for interactive/gesture motion.
// SPRING_UI: critically damped, no overshoot — the default for menus, panels,
// cards, and hover lifts. SPRING_POP: a little bounce — only for momentum or
// celebratory motion, never for something that merely faded in.
export const SPRING_UI = { type: "spring", stiffness: 300, damping: 30 } as const;
export const SPRING_POP = { type: "spring", stiffness: 320, damping: 22 } as const;
