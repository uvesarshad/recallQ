import assert from "node:assert/strict";
import { resolvePreviewImageUrl } from "../lib/item-preview.ts";

export function runItemPreviewTests() {
  assert.equal(
    resolvePreviewImageUrl("https://cdn.example.com/preview.png", "https://example.com/post"),
    "https://cdn.example.com/preview.png",
  );

  assert.equal(
    resolvePreviewImageUrl("/images/card.png", "https://example.com/articles/post"),
    "https://example.com/images/card.png",
  );

  assert.equal(resolvePreviewImageUrl(null, "https://example.com/post"), null);
  assert.equal(resolvePreviewImageUrl("/images/card.png", null), null);
}
