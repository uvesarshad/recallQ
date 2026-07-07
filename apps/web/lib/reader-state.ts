export type ReadingState = "unread" | "reading" | "read";
export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "purple";

export type ReadingStateInput = {
  reading_progress?: number | null;
  reading_state?: ReadingState | null;
};

const HIGHLIGHT_COLORS = new Set<HighlightColor>(["yellow", "green", "blue", "pink", "purple"]);

export function clampReadingProgress(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.trunc(value ?? 0)));
}

export function inferReadingState(input: ReadingStateInput): ReadingState {
  if (input.reading_state) return input.reading_state;
  const progress = clampReadingProgress(input.reading_progress);
  if (progress >= 100) return "read";
  if (progress > 0) return "reading";
  return "unread";
}

export function normalizeHighlightColor(value: string | null | undefined): HighlightColor {
  return HIGHLIGHT_COLORS.has(value as HighlightColor) ? (value as HighlightColor) : "yellow";
}

export function normalizeHighlightQuote(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 2000);
}

export function hasReaderText(value: string | null | undefined) {
  return Boolean(value && value.trim().length >= 20);
}
