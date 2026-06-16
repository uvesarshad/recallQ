// Two-way cloud sync (paid). Push the local archive to the server, then pull
// cross-device changes back. The local store stays the device source of truth;
// this just reconciles it with the cloud.
//
// Gated by `cloudSyncEnabled` + a stored token + a paid plan. The server is the
// real backstop: `ingestItem` still enforces per-plan monthly save caps, so a
// large backfill on a capped plan (e.g. Starter 100/mo) syncs what it can and
// leaves the rest `dirty` to retry — surfaced, never silently dropped.

import { RecallApiError } from "@recall/api-client";
import type { IngestItemInput, ListItem } from "@recall/api-client";
import { apiClient } from "./client";
import { getStoredToken } from "./auth-storage";
import { canUseCloudSync, getPlan } from "./plan";
import { getSettings } from "./settings";
import {
  applySyncResults,
  getDirty,
  type LocalItem,
  type RemoteUpsert,
} from "./local-archive";

const CURSOR_KEY = "recallq.sync.cursor"; // last pulled updated_at
const LOCK_KEY = "recallq.sync.inflight"; // soft cross-context lock
const PUSH_CHUNK = 100; // server bulk-ingest cap
const MAX_PULL_PAGES = 50; // safety bound per run; resumes next run via cursor
const EPOCH = "1970-01-01T00:00:00.000Z";

export type SyncOutcome = {
  ok: boolean;
  pushed: number;
  pulled: number;
  pending: number; // dirty items still unpushed (e.g. plan cap reached)
  reason?: "disabled" | "locked" | "error";
};

export async function isCloudEnabled(): Promise<boolean> {
  const settings = await getSettings();
  if (!settings.cloudSyncEnabled) return false;
  if (!(await getStoredToken())) return false;
  return canUseCloudSync(await getPlan());
}

export async function runSync(): Promise<SyncOutcome> {
  if (!(await isCloudEnabled())) {
    return { ok: false, pushed: 0, pulled: 0, pending: 0, reason: "disabled" };
  }
  if (!(await acquireLock())) {
    return { ok: false, pushed: 0, pulled: 0, pending: 0, reason: "locked" };
  }

  try {
    const { pushed, deletedPushed, pending } = await pushDirty();
    const pulled = await pullChanges();
    await applySyncResults({ pushed, deletedPushed, pulled });
    return { ok: true, pushed: pushed.length, pulled: pulled.length, pending };
  } catch {
    return { ok: false, pushed: 0, pulled: 0, pending: 0, reason: "error" };
  } finally {
    await releaseLock();
  }
}

function toIngestItem(item: LocalItem): IngestItemInput {
  if (item.type === "url" && item.url) {
    return {
      type: "url",
      raw_url: item.url,
      raw_text: item.url,
      title: item.title,
      capture_note: item.note,
      source: "extension",
    };
  }
  return {
    type: "text",
    raw_text: item.title ?? "",
    capture_note: item.note,
    source: "extension",
  };
}

async function pushDirty(): Promise<{
  pushed: { localId: string; serverId: string }[];
  deletedPushed: string[];
  pending: number;
}> {
  const dirty = await getDirty();
  const toCreate = dirty.filter((i) => !i.deleted && !i.serverId);
  const toDelete = dirty.filter((i) => i.deleted && i.serverId);
  // Already-synced items edited locally (e.g. a re-saved URL): there's no cloud
  // update path via ingest without creating a duplicate, so we clear `dirty`
  // without re-pushing. (v1 cut — server keeps the prior copy.)
  const toClear = dirty.filter((i) => !i.deleted && i.serverId);

  const pushed: { localId: string; serverId: string }[] = toClear.map((i) => ({
    localId: i.localId,
    serverId: i.serverId as string,
  }));
  const deletedPushed: string[] = [];
  let pending = 0;

  // Create — chunked. A plan-cap 402 stops the push; remaining items stay
  // dirty and the just-created ones reconcile by URL on the pull.
  for (let i = 0; i < toCreate.length; i += PUSH_CHUNK) {
    const chunk = toCreate.slice(i, i + PUSH_CHUNK);
    try {
      const res = await apiClient.ingest.batch(chunk.map(toIngestItem));
      res.items.forEach((r, idx) => {
        if (chunk[idx]) pushed.push({ localId: chunk[idx].localId, serverId: r.id });
      });
    } catch (err) {
      if (err instanceof RecallApiError && err.status === 402) {
        pending += toCreate.length - i; // this chunk + everything after
        break;
      }
      throw err;
    }
  }

  // Delete — propagate local deletes; treat a 404 as already gone.
  for (const item of toDelete) {
    try {
      await apiClient.items.delete(item.serverId as string);
      deletedPushed.push(item.localId);
    } catch (err) {
      if (err instanceof RecallApiError && err.status === 404) {
        deletedPushed.push(item.localId);
      } else {
        throw err;
      }
    }
  }

  return { pushed, deletedPushed, pending };
}

async function pullChanges(): Promise<RemoteUpsert[]> {
  let since = (await getCursor()) || EPOCH;
  const pulled: RemoteUpsert[] = [];

  for (let page = 0; page < MAX_PULL_PAGES; page++) {
    const res = await apiClient.items.list({ since, limit: PUSH_CHUNK });
    for (const it of res.items) pulled.push(toRemoteUpsert(it));
    if (res.items.length > 0) {
      since = res.items[res.items.length - 1].updated_at;
    }
    if (!res.hasMore || !res.nextCursor) break;
    since = res.nextCursor; // server returns last updated_at as the cursor
  }

  await setCursor(since);
  return pulled;
}

function toRemoteUpsert(it: ListItem): RemoteUpsert {
  return {
    serverId: it.id,
    type: it.type === "url" ? "url" : "text",
    url: it.raw_url,
    title: it.title,
    note: null,
    summary: it.summary,
    tags: it.tags,
    imageUrl: it.image_url,
    createdAt: it.created_at,
    updatedAt: it.updated_at,
  };
}

async function getCursor(): Promise<string | null> {
  const res = await chrome.storage.local.get(CURSOR_KEY);
  return typeof res[CURSOR_KEY] === "string" ? res[CURSOR_KEY] : null;
}

async function setCursor(value: string): Promise<void> {
  await chrome.storage.local.set({ [CURSOR_KEY]: value });
}

// Soft lock: a timestamp in session storage, auto-expiring so a crashed sync
// can't wedge future runs.
async function acquireLock(): Promise<boolean> {
  const res = await chrome.storage.session.get(LOCK_KEY);
  const at = res[LOCK_KEY];
  if (typeof at === "number" && Date.now() - at < 60_000) return false;
  await chrome.storage.session.set({ [LOCK_KEY]: Date.now() });
  return true;
}

async function releaseLock(): Promise<void> {
  await chrome.storage.session.remove(LOCK_KEY);
}
