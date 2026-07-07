// Two-way cloud sync (paid). Push the local archive to the server, then pull
// cross-device changes back. The local store stays the device source of truth;
// this just reconciles it with the cloud.

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
  type RemoteDelete,
  type RemoteUpsert,
} from "./local-archive";

const CURSOR_KEY = "recallq.sync.cursor";
const LOCK_KEY = "recallq.sync.inflight";
const PUSH_CHUNK = 100;
const MAX_PULL_PAGES = 50;
const EPOCH = "1970-01-01T00:00:00.000Z";

export type SyncOutcome = {
  ok: boolean;
  pushed: number;
  pulled: number;
  pending: number;
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
    const { upserts, deletes } = await pullChanges();
    await applySyncResults({ pushed, deletedPushed, pulled: upserts, deletedRemote: deletes });
    return { ok: true, pushed: pushed.length, pulled: upserts.length + deletes.length, pending };
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
  const toUpdate = dirty.filter((i) => !i.deleted && i.serverId);

  const pushed: { localId: string; serverId: string }[] = [];
  const deletedPushed: string[] = [];
  let pending = 0;

  for (let i = 0; i < toCreate.length; i += PUSH_CHUNK) {
    const chunk = toCreate.slice(i, i + PUSH_CHUNK);
    try {
      const res = await apiClient.ingest.batch(chunk.map(toIngestItem));
      res.items.forEach((r, idx) => {
        if (chunk[idx]) pushed.push({ localId: chunk[idx].localId, serverId: r.id });
      });
    } catch (err) {
      if (err instanceof RecallApiError && err.status === 402) {
        pending += toCreate.length - i;
        break;
      }
      throw err;
    }
  }

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

  for (const item of toUpdate) {
    await apiClient.items.update(item.serverId as string, {
      title: item.title ?? undefined,
      capture_note: item.note,
      tags: item.tags ?? undefined,
      collection_id: "collectionId" in item ? item.collectionId ?? null : undefined,
      reminder_at: "reminderAt" in item ? item.reminderAt ?? null : undefined,
    });
    pushed.push({ localId: item.localId, serverId: item.serverId as string });
  }

  return { pushed, deletedPushed, pending };
}

async function pullChanges(): Promise<{ upserts: RemoteUpsert[]; deletes: RemoteDelete[] }> {
  let since = (await getCursor()) || EPOCH;
  const upserts: RemoteUpsert[] = [];
  const deletes: RemoteDelete[] = [];

  for (let page = 0; page < MAX_PULL_PAGES; page++) {
    const res = await apiClient.items.list({ since, limit: PUSH_CHUNK });
    for (const it of res.items) upserts.push(toRemoteUpsert(it));
    for (const it of res.deletedItems ?? []) {
      deletes.push({ serverId: it.id, deletedAt: it.deleted_at });
    }
    if (res.nextCursor) since = res.nextCursor;
    if (!res.hasMore || !res.nextCursor) break;
  }

  await setCursor(since);
  return { upserts, deletes };
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
    collectionId: it.collection_id,
    collectionName: it.collection_name,
    reminderAt: it.reminder_at,
    reminderSent: it.reminder_sent,
    archiveStatus: it.archive_status,
    archiveRequestedAt: it.archive_requested_at,
    archiveLastError: it.archive_last_error,
    linkBroken: it.link_broken,
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
