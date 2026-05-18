import assert from "node:assert/strict";
import { hasIntentSignals } from "../lib/capture-signals.ts";

export function runCommentActionsTests() {
  // No signals: plain URL or bare note
  assert.equal(hasIntentSignals("https://example.com"), false);
  assert.equal(hasIntentSignals("Just a plain note with no markup"), false);
  assert.equal(hasIntentSignals(""), false);

  // Hashtag trigger
  assert.equal(hasIntentSignals("Check #design mockups"), true);
  assert.equal(hasIntentSignals("Save this #product idea"), true);

  // tags: prefix
  assert.equal(hasIntentSignals("https://example.com tags: work, research"), true);
  assert.equal(hasIntentSignals("tag: project"), true);

  // folder:/category: prefix
  assert.equal(hasIntentSignals("https://example.com folder: work"), true);
  assert.equal(hasIntentSignals("category: personal"), true);

  // reminder phrases
  assert.equal(hasIntentSignals("remind me to review this"), true);
  assert.equal(hasIntentSignals("Reminder: check back in a week"), true);
  assert.equal(hasIntentSignals("follow up on this next week"), true);

  // Case insensitivity
  assert.equal(hasIntentSignals("REMIND ME LATER"), true);
  assert.equal(hasIntentSignals("Folder: research"), true);
}
