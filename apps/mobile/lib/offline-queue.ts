// Offline capture queue backed by expo-sqlite. When a capture POST fails
// (no network, server down, server returns 5xx) the row is written here
// instead and synced on next opportunity — app foreground OR a transition
// from offline → online via expo-network.
//
// Schema is intentionally tiny (no joins, no JSON) so a v1 migration can
// be a single `CREATE TABLE` and a v2 `ALTER TABLE` adds columns without
// drama.

import * as SQLite from "expo-sqlite";
import { api } from "./api";

const DB_NAME = "recallq.db";
const TABLE_NAME = "pending_captures";

export type PendingCapture = {
  id: number;
  type: "url" | "text";
  raw_url: string | null;
  raw_text: string;
  capture_note: string | null;
  created_at: string;        // ISO when the user captured it on-device
  synced_at: string | null;  // ISO when the server confirmed; null while pending
  error: string | null;      // Most recent sync failure for surfacing
  attempts: number;
};

type Row = {
  id: number;
  type: "url" | "text";
  raw_url: string | null;
  raw_text: string;
  capture_note: string | null;
  created_at: string;
  synced_at: string | null;
  error: string | null;
  attempts: number;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          raw_url TEXT,
          raw_text TEXT NOT NULL,
          capture_note TEXT,
          created_at TEXT NOT NULL,
          synced_at TEXT,
          error TEXT,
          attempts INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_pending_unsynced
          ON ${TABLE_NAME} (created_at)
          WHERE synced_at IS NULL;
      `);
      return db;
    });
  }
  return dbPromise;
}

export async function enqueueCapture(input: {
  type: "url" | "text";
  raw_url: string | null;
  raw_text: string;
  capture_note: string | null;
}): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO ${TABLE_NAME} (type, raw_url, raw_text, capture_note, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      input.type,
      input.raw_url,
      input.raw_text,
      input.capture_note,
      new Date().toISOString(),
    ],
  );
  return result.lastInsertRowId ?? 0;
}

export async function listPendingCaptures(): Promise<PendingCapture[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM ${TABLE_NAME} WHERE synced_at IS NULL ORDER BY created_at DESC`,
  );
  return rows;
}

export async function countPendingCaptures(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM ${TABLE_NAME} WHERE synced_at IS NULL`,
  );
  return row?.c ?? 0;
}

export async function deletePendingCapture(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
}

type SyncResult = { synced: number; failed: number };

// Drains every unsynced row by POSTing to the appropriate ingest endpoint.
// On success: the local row is deleted (server is authoritative). On
// failure: the error and attempt count are persisted so the user can see
// what's wrong on the Capture screen.
export async function syncPendingCaptures(): Promise<SyncResult> {
  const pending = await listPendingCaptures();
  let synced = 0;
  let failed = 0;

  for (const row of pending) {
    try {
      if (row.type === "url" && row.raw_url) {
        await api.ingest.url({
          url: row.raw_url,
          capture_note: row.capture_note,
          source: "mobile",
        });
      } else {
        await api.ingest.text({
          text: row.raw_text,
          capture_note: row.capture_note,
          source: "mobile",
        });
      }
      await deletePendingCapture(row.id);
      synced++;
    } catch (caught) {
      failed++;
      const message = caught instanceof Error ? caught.message : "Sync failed";
      const db = await getDb();
      await db.runAsync(
        `UPDATE ${TABLE_NAME} SET error = ?, attempts = attempts + 1 WHERE id = ?`,
        [message, row.id],
      );
    }
  }

  return { synced, failed };
}
