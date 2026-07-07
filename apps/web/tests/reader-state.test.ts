import assert from "node:assert/strict";
import {
  clampReadingProgress,
  hasReaderText,
  inferReadingState,
  normalizeHighlightColor,
  normalizeHighlightQuote,
} from "../lib/reader-state.ts";

export function runReaderStateTests() {
  assert.equal(clampReadingProgress(-10), 0);
  assert.equal(clampReadingProgress(42.8), 42);
  assert.equal(clampReadingProgress(140), 100);
  assert.equal(clampReadingProgress(Number.NaN), 0);

  assert.equal(inferReadingState({ reading_progress: 0 }), "unread");
  assert.equal(inferReadingState({ reading_progress: 12 }), "reading");
  assert.equal(inferReadingState({ reading_progress: 100 }), "read");
  assert.equal(inferReadingState({ reading_progress: 10, reading_state: "unread" }), "unread");

  assert.equal(normalizeHighlightColor("blue"), "blue");
  assert.equal(normalizeHighlightColor("orange"), "yellow");
  assert.equal(normalizeHighlightQuote("  A   quoted\npassage  "), "A quoted passage");
  assert.equal(hasReaderText("short"), false);
  assert.equal(hasReaderText("This paragraph is long enough for reader mode."), true);
}
