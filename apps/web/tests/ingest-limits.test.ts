import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(testsDir, "..");

let hooksRegistered = false;
let ingestItemPromise: Promise<(payload: any) => Promise<any>>;

type QueryRecord = {
  text: string;
  params: unknown[];
};

type FakeClient = {
  queries: QueryRecord[];
  released: boolean;
  query: (text: string, params?: unknown[]) => Promise<{ rowCount: number | null; rows: any[] }>;
  release: () => void;
};

function registerIngestTestHooks() {
  if (hooksRegistered) return;

  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "@/lib/db") {
        return { url: "mock:recall-db", shortCircuit: true };
      }

      if (context.parentURL?.endsWith("/lib/ingest.ts") && specifier === "./comment-actions") {
        return { url: "mock:recall-comment-actions", shortCircuit: true };
      }

      if (context.parentURL?.endsWith("/lib/ingest.ts") && specifier === "./storage") {
        return { url: "mock:recall-storage", shortCircuit: true };
      }

      if (context.parentURL?.endsWith("/lib/ingest.ts") && specifier === "@/lib/automation-rules") {
        return { url: "mock:recall-automation-rules", shortCircuit: true };
      }

      if (specifier.startsWith("@/")) {
        const relativePath = specifier.slice(2);
        const localPath = path.join(webRoot, path.extname(relativePath) ? relativePath : `${relativePath}.ts`);
        return { url: pathToFileURL(localPath).href, shortCircuit: true };
      }

      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url === "mock:recall-db") {
        return {
          format: "module",
          shortCircuit: true,
          source: `
            function state() {
              const value = globalThis.__ingestLimitTestState;
              if (!value) throw new Error("Missing ingest limit test state");
              return value;
            }

            export const db = {
              connect: async () => state().client
            };

            export default db;
          `,
        };
      }

      if (url === "mock:recall-comment-actions") {
        return {
          format: "module",
          shortCircuit: true,
          source: `
            function state() {
              const value = globalThis.__ingestLimitTestState;
              if (!value) throw new Error("Missing ingest limit test state");
              return value;
            }

            export async function inferCaptureActions() {
              return state().inferredActions;
            }

            export async function ensureCollection() {
              return state().collectionId ?? "collection-id";
            }
          `,
        };
      }

      if (url === "mock:recall-storage") {
        return {
          format: "module",
          shortCircuit: true,
          source: `
            function state() {
              const value = globalThis.__ingestLimitTestState;
              if (!value) throw new Error("Missing ingest limit test state");
              return value;
            }

            export function isAcceptedMimeType(mimeType) {
              return state().acceptedMimeTypes.has(mimeType);
            }

            export async function saveFile(userId, itemId, fileName) {
              const filePath = "mock-file://" + userId + "/" + itemId + "/" + fileName;
              state().savedFiles.push(filePath);
              return filePath;
            }

            export async function removeStoredFile(filePath) {
              state().removedFiles.push(filePath);
            }
          `,
        };
      }

      if (url === "mock:recall-automation-rules") {
        return {
          format: "module",
          shortCircuit: true,
          source: `
            export async function shouldSkipCaptureByRules() {
              return false;
            }

            export async function applyCaptureRules() {
              return [];
            }

            export async function applyAutomationRules() {
              return [];
            }
          `,
        };
      }

      return nextLoad(url, context);
    },
  });

  hooksRegistered = true;
}

async function loadIngestItem() {
  registerIngestTestHooks();
  ingestItemPromise ??= import("../lib/ingest.ts").then((module) => module.ingestItem);
  return ingestItemPromise;
}

function createClient({
  plan,
  savesThisMonth,
  storageUsedBytes,
  activeReminders,
}: {
  plan: "free" | "starter" | "pro";
  savesThisMonth: number;
  storageUsedBytes: number;
  activeReminders: number;
}): FakeClient {
  const client: FakeClient = {
    queries: [],
    released: false,
    async query(text, params = []) {
      const normalizedText = text.replace(/\s+/g, " ").trim();
      client.queries.push({ text: normalizedText, params });

      if (normalizedText === "BEGIN" || normalizedText === "COMMIT" || normalizedText === "ROLLBACK") {
        return { rowCount: null, rows: [] };
      }

      if (normalizedText.startsWith("SELECT plan, saves_this_month, storage_used_bytes FROM users")) {
        return {
          rowCount: 1,
          rows: [{ plan, saves_this_month: savesThisMonth, storage_used_bytes: storageUsedBytes }],
        };
      }

      if (normalizedText.startsWith("INSERT INTO items")) {
        return { rowCount: 1, rows: [{ id: "item-id" }] };
      }

      if (normalizedText.startsWith("UPDATE users SET saves_this_month")) {
        return { rowCount: 1, rows: [] };
      }

      if (normalizedText.startsWith("SELECT COUNT(*) AS count FROM reminders")) {
        return { rowCount: 1, rows: [{ count: String(activeReminders) }] };
      }

      if (normalizedText.startsWith("INSERT INTO reminders")) {
        return { rowCount: 1, rows: [] };
      }

      throw new Error(`Unexpected query: ${normalizedText}`);
    },
    release() {
      client.released = true;
    },
  };

  return client;
}

async function runIngestScenario({
  plan,
  savesThisMonth,
  storageUsedBytes = 0,
  activeReminders = 0,
  rawText = "captured text",
  reminderAt = null,
}: {
  plan: "free" | "starter" | "pro";
  savesThisMonth: number;
  storageUsedBytes?: number;
  activeReminders?: number;
  rawText?: string;
  reminderAt?: string | null;
}) {
  const ingestItem = await loadIngestItem();
  const client = createClient({ plan, savesThisMonth, storageUsedBytes, activeReminders });

  (globalThis as any).__ingestLimitTestState = {
    client,
    inferredActions: {
      tags: [],
      reminderAt,
      collectionId: null,
      categoryName: null,
      confidence: "low",
    },
    acceptedMimeTypes: new Set(["text/plain"]),
    savedFiles: [],
    removedFiles: [],
  };

  try {
    const result = await ingestItem({
      userId: "user-1",
      type: "text",
      raw_text: rawText,
      source: "web",
    });

    assert.equal(client.released, true);
    assertNoNonFiniteSqlParams(client.queries);

    return { result, queries: client.queries };
  } finally {
    delete (globalThis as any).__ingestLimitTestState;
  }
}

function assertNoNonFiniteSqlParams(queries: QueryRecord[]) {
  for (const query of queries) {
    for (const param of query.params) {
      assertNoNonFiniteValue(param);
    }
  }
}

function assertNoNonFiniteValue(value: unknown) {
  if (typeof value === "number") {
    assert.equal(Number.isFinite(value), true, `SQL parameter must be finite, got ${value}`);
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      assertNoNonFiniteValue(entry);
    }
  }
}

function hasQuery(queries: QueryRecord[], prefix: string) {
  return queries.some((query) => query.text.startsWith(prefix));
}

export async function runIngestLimitsTests() {
  // Free and starter save caps reject before item/counter SQL writes.
  {
    const { result, queries } = await runIngestScenario({ plan: "free", savesThisMonth: 50 });
    assert.equal(result.error, "limit_reached");
    assert.equal(hasQuery(queries, "INSERT INTO items"), false);
    assert.equal(hasQuery(queries, "UPDATE users SET saves_this_month"), false);
  }

  {
    const { result, queries } = await runIngestScenario({ plan: "starter", savesThisMonth: 100 });
    assert.equal(result.error, "limit_reached");
    assert.equal(hasQuery(queries, "INSERT INTO items"), false);
    assert.equal(hasQuery(queries, "UPDATE users SET saves_this_month"), false);
  }

  // Free and starter storage caps reject before item/counter SQL writes.
  {
    const freeLimit = 100 * 1024 * 1024;
    const { result, queries } = await runIngestScenario({
      plan: "free",
      savesThisMonth: 0,
      storageUsedBytes: freeLimit - 1,
      rawText: "xx",
    });
    assert.equal(result.error, "storage_limit_reached");
    assert.equal(hasQuery(queries, "INSERT INTO items"), false);
    assert.equal(hasQuery(queries, "UPDATE users SET saves_this_month"), false);
  }

  {
    const starterLimit = 1024 * 1024 * 1024;
    const { result, queries } = await runIngestScenario({
      plan: "starter",
      savesThisMonth: 0,
      storageUsedBytes: starterLimit - 1,
      rawText: "xx",
    });
    assert.equal(result.error, "storage_limit_reached");
    assert.equal(hasQuery(queries, "INSERT INTO items"), false);
    assert.equal(hasQuery(queries, "UPDATE users SET saves_this_month"), false);
  }

  // Free and starter reminder caps skip reminder creation but keep the item write.
  {
    const { result, queries } = await runIngestScenario({
      plan: "free",
      savesThisMonth: 0,
      activeReminders: 2,
      reminderAt: "2026-08-01T09:00:00.000Z",
    });
    assert.equal(result.success, true);
    assert.equal(result.reminder_at, null);
    assert.equal(hasQuery(queries, "INSERT INTO reminders"), false);
  }

  {
    const { result, queries } = await runIngestScenario({
      plan: "starter",
      savesThisMonth: 0,
      activeReminders: 30,
      reminderAt: "2026-08-01T09:00:00.000Z",
    });
    assert.equal(result.success, true);
    assert.equal(result.reminder_at, null);
    assert.equal(hasQuery(queries, "INSERT INTO reminders"), false);
  }

  // Pro has unlimited save and reminder branches; no Infinity is serialized to SQL params.
  {
    const { result, queries } = await runIngestScenario({
      plan: "pro",
      savesThisMonth: 1_000_000,
      activeReminders: 1_000_000,
      reminderAt: "2026-08-01T09:00:00.000Z",
    });
    assert.equal(result.success, true);
    assert.equal(result.reminder_at, "2026-08-01T09:00:00.000Z");
    assert.equal(hasQuery(queries, "INSERT INTO reminders"), true);
  }

  // Self-hosted mode bypasses hosted save, storage, and reminder caps without non-finite SQL params.
  {
    const previousSelfHosted = process.env.SELF_HOSTED;
    process.env.SELF_HOSTED = "true";
    try {
      const { result, queries } = await runIngestScenario({
        plan: "free",
        savesThisMonth: 1_000_000,
        storageUsedBytes: Number.MAX_SAFE_INTEGER,
        activeReminders: 1_000_000,
        rawText: "self-hosted capture",
        reminderAt: "2026-08-01T09:00:00.000Z",
      });
      assert.equal(result.success, true);
      assert.equal(result.reminder_at, "2026-08-01T09:00:00.000Z");
      assert.equal(hasQuery(queries, "INSERT INTO reminders"), true);
    } finally {
      if (previousSelfHosted === undefined) {
        delete process.env.SELF_HOSTED;
      } else {
        process.env.SELF_HOSTED = previousSelfHosted;
      }
    }
  }
}
