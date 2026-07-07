import assert from "node:assert/strict";
import type { QueryResultRow } from "pg";
import {
  ENRICHMENT_RETRY_BASE_SECONDS,
  MAX_ENRICHMENT_ATTEMPTS,
  claimEnrichmentItems,
  markEnrichmentFailed,
  markEnrichmentSucceeded,
  type EnrichmentClaimDb,
  type EnrichmentStatus,
} from "../lib/enrichment-claim.ts";

type TestItem = {
  id: string;
  user_id: string;
  type: "url" | "text" | "file" | "note";
  raw_url: string | null;
  url_host: string | null;
  raw_text: string | null;
  file_path: string | null;
  file_name: string | null;
  file_mime_type: string | null;
  capture_note: string | null;
  title: string | null;
  created_at: number;
  enriched: boolean;
  enriched_at: Date | null;
  enrichment_status: EnrichmentStatus;
  enrichment_locked_at: Date | null;
  enrichment_attempt_count: number;
  enrichment_last_error: string | null;
};

function makeItem(overrides: Partial<TestItem> = {}): TestItem {
  return {
    id: "item-1",
    user_id: "user-1",
    type: "text",
    raw_url: null,
    url_host: null,
    raw_text: "body",
    file_path: null,
    file_name: null,
    file_mime_type: null,
    capture_note: null,
    title: null,
    created_at: 1,
    enriched: false,
    enriched_at: null,
    enrichment_status: "pending",
    enrichment_locked_at: null,
    enrichment_attempt_count: 0,
    enrichment_last_error: null,
    ...overrides,
  };
}

class MockEnrichmentDb implements EnrichmentClaimDb {
  readonly queries: string[] = [];
  readonly now = new Date("2026-07-07T00:00:00.000Z");
  readonly items: TestItem[];

  constructor(items: TestItem[]) {
    this.items = items;
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
    this.queries.push(text);

    if (text.includes("WITH candidate_items")) {
      assert.match(text, /FOR UPDATE SKIP LOCKED/);

      const [batchSize, maxAttempts, staleLockSeconds, retryMaxSeconds, retryBaseSeconds] =
        params as number[];
      const nowMs = this.now.getTime();

      const eligible = this.items
        .filter((item) => {
          if (item.enriched || item.enrichment_attempt_count >= maxAttempts) {
            return false;
          }

          if (item.enrichment_status === "pending") {
            return true;
          }

          if (item.enrichment_status === "retrying") {
            if (!item.enrichment_locked_at) {
              return true;
            }
            const retryDelaySeconds = Math.min(
              retryMaxSeconds,
              Math.pow(2, Math.min(item.enrichment_attempt_count, 10)) * retryBaseSeconds,
            );
            return nowMs - item.enrichment_locked_at.getTime() >= retryDelaySeconds * 1000;
          }

          if (item.enrichment_status === "processing" && item.enrichment_locked_at) {
            return nowMs - item.enrichment_locked_at.getTime() >= staleLockSeconds * 1000;
          }

          return false;
        })
        .sort((a, b) => a.created_at - b.created_at)
        .slice(0, batchSize);

      for (const item of eligible) {
        item.enrichment_status = "processing";
        item.enrichment_locked_at = this.now;
      }

      return { rows: eligible as unknown as T[], rowCount: eligible.length };
    }

    if (text.includes("enrichment_attempt_count = enrichment_attempt_count + 1")) {
      const [itemId, error, maxAttempts] = params as [string, string, number];
      const item = this.find(itemId);
      item.enrichment_attempt_count += 1;
      item.enrichment_status =
        item.enrichment_attempt_count >= maxAttempts ? "failed" : "retrying";
      item.enrichment_locked_at = this.now;
      item.enrichment_last_error = error;

      return {
        rows: [
          {
            enrichment_status: item.enrichment_status,
            enrichment_attempt_count: item.enrichment_attempt_count,
          },
        ] as unknown as T[],
        rowCount: 1,
      };
    }

    if (text.includes("enrichment_status = 'enriched'")) {
      const [itemId] = params as [string];
      const item = this.find(itemId);
      item.enrichment_status = "enriched";
      item.enrichment_locked_at = null;
      item.enrichment_last_error = null;
      item.enriched = true;
      item.enriched_at ??= this.now;
      return { rows: [] as T[], rowCount: 1 };
    }

    throw new Error(`Unexpected query: ${text}`);
  }

  private find(itemId: string) {
    const item = this.items.find((candidate) => candidate.id === itemId);
    assert.ok(item, `Missing test item ${itemId}`);
    return item;
  }
}

export async function runEnrichmentClaimTests() {
  {
    const db = new MockEnrichmentDb([makeItem()]);
    const firstClaim = await claimEnrichmentItems(db, 1);
    const secondClaim = await claimEnrichmentItems(db, 1);

    assert.deepEqual(firstClaim.map((item) => item.id), ["item-1"]);
    assert.equal(secondClaim.length, 0);
    assert.equal(db.items[0].enrichment_status, "processing");
    assert.match(db.queries[0], /FOR UPDATE SKIP LOCKED/);
  }

  {
    const db = new MockEnrichmentDb([makeItem({ enrichment_status: "processing" })]);
    const failed = await markEnrichmentFailed(db, "item-1", new Error("transient"));

    assert.equal(failed?.enrichment_attempt_count, 1);
    assert.equal(failed?.enrichment_status, "retrying");
    assert.equal(db.items[0].enrichment_attempt_count, 1);
    assert.equal(db.items[0].enrichment_last_error, "transient");
    assert.equal((await claimEnrichmentItems(db, 1)).length, 0);

    db.items[0].enrichment_locked_at = new Date(
      db.now.getTime() - ENRICHMENT_RETRY_BASE_SECONDS * 3 * 1000,
    );
    assert.deepEqual((await claimEnrichmentItems(db, 1)).map((item) => item.id), ["item-1"]);
  }

  {
    const db = new MockEnrichmentDb([
      makeItem({
        enrichment_status: "processing",
        enrichment_attempt_count: MAX_ENRICHMENT_ATTEMPTS - 1,
      }),
    ]);
    const failed = await markEnrichmentFailed(db, "item-1", "permanent");

    assert.equal(failed?.enrichment_attempt_count, MAX_ENRICHMENT_ATTEMPTS);
    assert.equal(failed?.enrichment_status, "failed");
    db.items[0].enrichment_locked_at = new Date(db.now.getTime() - 24 * 60 * 60 * 1000);
    assert.equal((await claimEnrichmentItems(db, 1)).length, 0);
  }

  {
    const db = new MockEnrichmentDb([
      makeItem({
        enrichment_status: "processing",
        enrichment_locked_at: new Date("2026-07-06T23:59:00.000Z"),
        enrichment_last_error: "old failure",
      }),
    ]);

    await markEnrichmentSucceeded(db, "item-1");

    assert.equal(db.items[0].enrichment_status, "enriched");
    assert.equal(db.items[0].enriched, true);
    assert.equal(db.items[0].enrichment_locked_at, null);
    assert.equal(db.items[0].enrichment_last_error, null);
    assert.ok(db.items[0].enriched_at);
  }
}
