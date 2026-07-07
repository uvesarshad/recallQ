// On-device archive — the source of truth for saved tabs. All users get this
// unlimited, free, and fully offline (the `unlimitedStorage` permission lifts
// the quota). Cloud sync (paid) reconciles this store with the server; see
// `lib/sync.ts`. Stored as one JSON array under a single key — URLs are tiny,
// so this stays cheap for typical archives; an IndexedDB backing is the future
// path if archives grow huge.

const ARCHIVE_KEY = "recallq.archive.items";

export type LocalItem = {
  localId: string;
  serverId: string | null;
  type: "url" | "text";
  url: string | null;
  title: string | null;
  note: string | null;
  // Enriched fields, populated when pulled from the cloud.
  summary: string | null;
  tags: string[] | null;
  imageUrl: string | null;
  collectionId?: string | null;
  collectionName?: string | null;
  reminderAt?: string | null;
  reminderSent?: boolean | null;
  archiveStatus?: "not_requested" | "pending" | "processing" | "available" | "failed" | null;
  archiveRequestedAt?: string | null;
  archiveLastError?: string | null;
  linkBroken?: boolean | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO — drives sync ordering
  deleted: boolean; // tombstone, retained until its delete is pushed
  dirty: boolean; // has local changes not yet pushed to cloud
};

export type SaveEntry = { url: string; title?: string | null; note?: string | null };

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

// Normalize for dedup: lowercase host, drop a trailing slash and the hash.
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    let s = `${u.protocol}//${u.host.toLowerCase()}${u.pathname}${u.search}`;
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return url.trim();
  }
}

export async function getAll(): Promise<LocalItem[]> {
  const res = await chrome.storage.local.get(ARCHIVE_KEY);
  const arr = res[ARCHIVE_KEY];
  return Array.isArray(arr) ? (arr as LocalItem[]) : [];
}

async function writeAll(items: LocalItem[]): Promise<void> {
  await chrome.storage.local.set({ [ARCHIVE_KEY]: items });
}

// Non-deleted items, newest first — for the feed.
export async function getVisible(): Promise<LocalItem[]> {
  const items = await getAll();
  return items
    .filter((i) => !i.deleted)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function search(query: string): Promise<LocalItem[]> {
  const q = query.trim().toLowerCase();
  const visible = await getVisible();
  if (!q) return visible;
  return visible.filter((i) =>
    [i.title, i.url, i.note, i.summary, ...(i.tags ?? [])]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(q)),
  );
}

// Save a batch of URLs. Dedups by normalized URL against existing non-deleted
// items (refreshing the title + marking dirty rather than creating a copy).
// Returns how many were added vs. updated.
export async function addUrls(entries: SaveEntry[]): Promise<{ added: number; updated: number }> {
  if (entries.length === 0) return { added: 0, updated: 0 };
  const items = await getAll();
  const byUrl = new Map<string, LocalItem>();
  for (const i of items) {
    if (!i.deleted && i.url) byUrl.set(normalizeUrl(i.url), i);
  }

  let added = 0;
  let updated = 0;
  const ts = nowIso();
  for (const entry of entries) {
    const key = normalizeUrl(entry.url);
    const existing = byUrl.get(key);
    if (existing) {
      if (entry.title) existing.title = entry.title;
      if (entry.note) existing.note = entry.note;
      existing.updatedAt = ts;
      existing.dirty = true;
      updated++;
    } else {
      const item = newUrlItem(entry, ts);
      items.push(item);
      byUrl.set(key, item);
      added++;
    }
  }
  await writeAll(items);
  return { added, updated };
}

export async function addText(text: string, note?: string | null): Promise<LocalItem> {
  const items = await getAll();
  const ts = nowIso();
  const item: LocalItem = {
    localId: newId(),
    serverId: null,
    type: "text",
    url: null,
    title: text, // full text; the UI clamps display, push sends it as raw_text
    note: note ?? null,
    summary: null,
    tags: null,
    imageUrl: null,
    createdAt: ts,
    updatedAt: ts,
    deleted: false,
    dirty: true,
  };
  items.push(item);
  await writeAll(items);
  return item;
}

function newUrlItem(entry: SaveEntry, ts: string): LocalItem {
  return {
    localId: newId(),
    serverId: null,
    type: "url",
    url: entry.url,
    title: entry.title ?? entry.url,
    note: entry.note ?? null,
    summary: null,
    tags: null,
    imageUrl: null,
    createdAt: ts,
    updatedAt: ts,
    deleted: false,
    dirty: true,
  };
}

export async function softDelete(localId: string): Promise<void> {
  const items = await getAll();
  const item = items.find((i) => i.localId === localId);
  if (!item || item.deleted) return;
  item.deleted = true;
  item.dirty = true;
  item.updatedAt = nowIso();
  await writeAll(items);
}

export async function count(): Promise<{ total: number; pending: number }> {
  const items = await getAll();
  const visible = items.filter((i) => !i.deleted);
  return {
    total: visible.length,
    pending: items.filter((i) => i.dirty).length,
  };
}

// --- Sync support (used by lib/sync.ts) ----------------------------------

export async function getDirty(): Promise<LocalItem[]> {
  return (await getAll()).filter((i) => i.dirty);
}

// Apply the results of a sync pass atomically: server ids assigned to pushed
// items, pushed tombstones purged, and pulled remote items upserted. Done in a
// single read-modify-write to limit races with concurrent saves.
export async function applySyncResults(opts: {
  pushed?: { localId: string; serverId: string }[];
  deletedPushed?: string[]; // localIds whose delete was accepted by the server
  deletedRemote?: RemoteDelete[];
  pulled?: RemoteUpsert[];
}): Promise<void> {
  let items = await getAll();
  const byLocalId = new Map(items.map((i) => [i.localId, i]));

  for (const p of opts.pushed ?? []) {
    const item = byLocalId.get(p.localId);
    if (item) {
      item.serverId = p.serverId;
      item.dirty = false;
    }
  }

  // Purge tombstones the server has acknowledged.
  if (opts.deletedPushed?.length) {
    const purge = new Set(opts.deletedPushed);
    items = items.filter((i) => !purge.has(i.localId));
  }

  for (const remote of opts.pulled ?? []) {
    upsertRemote(items, remote);
  }

  if (opts.deletedRemote?.length) {
    const deletedIds = new Set(opts.deletedRemote.map((item) => item.serverId));
    items = items.filter((item) => !item.serverId || !deletedIds.has(item.serverId));
  }

  await writeAll(items);
}

export type RemoteUpsert = {
  serverId: string;
  type: "url" | "text";
  url: string | null;
  title: string | null;
  note: string | null;
  summary: string | null;
  tags: string[] | null;
  imageUrl: string | null;
  collectionId: string | null;
  collectionName: string | null;
  reminderAt: string | null;
  reminderSent: boolean | null;
  archiveStatus: "not_requested" | "pending" | "processing" | "available" | "failed" | null;
  archiveRequestedAt: string | null;
  archiveLastError: string | null;
  linkBroken: boolean | null;
  createdAt: string;
  updatedAt: string;
};

export type RemoteDelete = {
  serverId: string;
  deletedAt: string;
};

// Merge a server item into the local list. Three cases:
//  1. Known by serverId — refresh enriched fields (unless a local edit is
//     pending, which we don't clobber).
//  2. A never-pushed local save with the same URL — reconcile: link the server
//     id and clear `dirty`. This is what makes a partial push self-heal: even
//     if a chunk was created on the server without us capturing the ids (e.g. a
//     mid-batch plan-cap 402), the next pull links them by URL so they're never
//     re-pushed as duplicates.
//  3. Otherwise — insert (a save from another device / the web app).
function upsertRemote(items: LocalItem[], remote: RemoteUpsert): void {
  const byId = items.find((i) => i.serverId === remote.serverId);
  if (byId) {
    if (byId.dirty) return; // pending local edit — leave it for the next push
    byId.title = remote.title ?? byId.title;
    byId.summary = remote.summary;
    byId.tags = remote.tags;
    byId.imageUrl = remote.imageUrl;
    byId.collectionId = remote.collectionId;
    byId.collectionName = remote.collectionName;
    byId.reminderAt = remote.reminderAt;
    byId.reminderSent = remote.reminderSent;
    byId.archiveStatus = remote.archiveStatus;
    byId.archiveRequestedAt = remote.archiveRequestedAt;
    byId.archiveLastError = remote.archiveLastError;
    byId.linkBroken = remote.linkBroken;
    byId.updatedAt = remote.updatedAt;
    return;
  }

  if (remote.url) {
    const key = normalizeUrl(remote.url);
    const byUrl = items.find(
      (i) => !i.serverId && !i.deleted && i.url && normalizeUrl(i.url) === key,
    );
    if (byUrl) {
      byUrl.serverId = remote.serverId;
      byUrl.title = byUrl.title ?? remote.title;
      byUrl.summary = remote.summary;
      byUrl.tags = remote.tags;
      byUrl.imageUrl = remote.imageUrl;
      byUrl.collectionId = remote.collectionId;
      byUrl.collectionName = remote.collectionName;
      byUrl.reminderAt = remote.reminderAt;
      byUrl.reminderSent = remote.reminderSent;
      byUrl.archiveStatus = remote.archiveStatus;
      byUrl.archiveRequestedAt = remote.archiveRequestedAt;
      byUrl.archiveLastError = remote.archiveLastError;
      byUrl.linkBroken = remote.linkBroken;
      byUrl.updatedAt = remote.updatedAt;
      byUrl.dirty = false; // reconciled with the server copy
      return;
    }
  }

  items.push({
    localId: newId(),
    serverId: remote.serverId,
    type: remote.type,
    url: remote.url,
    title: remote.title,
    note: remote.note,
    summary: remote.summary,
    tags: remote.tags,
    imageUrl: remote.imageUrl,
    collectionId: remote.collectionId,
    collectionName: remote.collectionName,
    reminderAt: remote.reminderAt,
    reminderSent: remote.reminderSent,
    archiveStatus: remote.archiveStatus,
    archiveRequestedAt: remote.archiveRequestedAt,
    archiveLastError: remote.archiveLastError,
    linkBroken: remote.linkBroken,
    createdAt: remote.createdAt,
    updatedAt: remote.updatedAt,
    deleted: false,
    dirty: false,
  });
}

export { ARCHIVE_KEY };
