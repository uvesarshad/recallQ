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
