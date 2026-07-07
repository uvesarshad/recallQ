import assert from "node:assert/strict";
import {
  parseAdvancedSearch,
  searchCursorForTests,
} from "../lib/search-query.ts";

export function runSearchParserTests() {
  const parsed = parseAdvancedSearch(
    'type:url tag:ai folder:"Reading List" source:extension after:2026-01-01 before:2026-02-01 has:reminder is:enriched "vector database" or postgres',
  );

  assert.deepEqual(parsed.filters.types, ["url"]);
  assert.deepEqual(parsed.filters.tags, ["ai"]);
  assert.deepEqual(parsed.filters.folders, ["Reading List"]);
  assert.deepEqual(parsed.filters.sources, ["extension"]);
  assert.equal(parsed.filters.after, "2026-01-01T00:00:00.000Z");
  assert.equal(parsed.filters.before, "2026-02-01T23:59:59.999Z");
  assert.equal(parsed.filters.hasReminder, true);
  assert.equal(parsed.filters.isEnriched, true);
  assert.equal(parsed.groups.length, 2);
  assert.deepEqual(parsed.groups[0]?.map((term) => term.value), ["vector database"]);
  assert.deepEqual(parsed.groups[1]?.map((term) => term.value), ["postgres"]);
  assert.equal(parsed.textQuery, '"vector database" OR postgres');

  const broken = parseAdvancedSearch("is:broken");
  assert.equal(broken.filters.isBroken, true);
  assert.equal(broken.textQuery, "");

  const encoded = searchCursorForTests.encodeCursor({
    v: 1,
    mode: "hybrid",
    query: "tag:ai postgres",
    offset: 50,
  });
  assert.deepEqual(
    searchCursorForTests.decodeCursor(encoded, "hybrid", "tag:ai postgres"),
    { v: 1, mode: "hybrid", query: "tag:ai postgres", offset: 50 },
  );
  assert.equal(searchCursorForTests.decodeCursor(encoded, "semantic", "tag:ai postgres"), null);
  assert.equal(searchCursorForTests.decodeCursor(encoded, "hybrid", "different"), null);
}
