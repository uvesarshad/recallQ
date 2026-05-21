import assert from "node:assert/strict";
import { clampStrength, getHostname, orderRelationPair } from "../lib/relations.ts";

export function runRelationsTests() {
  // orderRelationPair: lexicographically smaller id is always first
  assert.deepEqual(orderRelationPair("aaa", "bbb"), ["aaa", "bbb"]);
  assert.deepEqual(orderRelationPair("bbb", "aaa"), ["aaa", "bbb"]);
  assert.deepEqual(orderRelationPair("same", "same"), ["same", "same"]);

  // clampStrength: clamped to [0, 1]
  assert.equal(clampStrength(0), 0);
  assert.equal(clampStrength(1), 1);
  assert.equal(clampStrength(0.5), 0.5);
  assert.equal(clampStrength(-1), 0);
  assert.equal(clampStrength(2), 1);
  assert.equal(clampStrength(NaN), 0);
  assert.equal(clampStrength(Infinity), 0);

  // getHostname: strips www, handles missing/invalid input
  assert.equal(getHostname("https://www.example.com/path"), "example.com");
  assert.equal(getHostname("https://sub.example.com"), "sub.example.com");
  assert.equal(getHostname("https://example.com"), "example.com");
  assert.equal(getHostname(null), null);
  assert.equal(getHostname(undefined), null);
  assert.equal(getHostname("not-a-url"), null);
  assert.equal(getHostname(""), null);
}
