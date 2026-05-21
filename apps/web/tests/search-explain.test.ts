import assert from "node:assert/strict";
import { getMatchReasons } from "../lib/search-explain.ts";

export function runSearchExplainTests() {
  const hybridReasons = getMatchReasons("product launch", {
    title: "Product launch checklist",
    summary: "Notes for the next launch review",
    raw_text: "The launch plan needs an updated owner.",
    raw_url: "https://example.com/product-launch",
    tags: ["launch", "ops"],
  });

  assert.deepEqual(hybridReasons, [
    "Title hit",
    "Summary hit",
    "Tag hit",
    "URL hit",
    "Content hit",
  ]);

  const emptyReasons = getMatchReasons("   ", {
    title: "Anything",
    summary: "Anything",
    raw_text: "Anything",
    raw_url: "https://example.com",
    tags: ["anything"],
  });

  assert.deepEqual(emptyReasons, []);

  const dedupedReasons = getMatchReasons("design prototype", {
    title: "Design prototype review",
    summary: "Weekly roundup",
    raw_text: "Discuss prototype variants",
    tags: ["design-system"],
  });

  assert.deepEqual(dedupedReasons, ["Title hit", "Tag hit", "Content hit"]);
}
