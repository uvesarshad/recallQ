// Core tab-management logic shared by the background context menu. No content
// scripts are used anywhere — every bit of tab data (url, title, index,
// groupId) comes from the `chrome.tabs` / `chrome.tabGroups` APIs, keeping
// per-page memory at zero.

import type { IngestItemInput } from "@recall/api-client";
import { apiClient } from "./client";
import { getExcludedTabIds } from "./exclusion";
import { getSettings } from "./settings";

// Server bulk ingest caps at 100 items per request (`bulkIngestPayloadSchema`).
const CHUNK_SIZE = 100;

export const APP_URL = chrome.runtime.getURL("app.html");

export type SendResult = {
  sent: number; // items the server accepted
  total: number; // capturable, non-excluded tabs targeted
  closed: number; // tabs removed afterward
  limitReached: boolean; // plan save-cap hit mid-batch
};

type CapturableTab = chrome.tabs.Tab & { url: string };

function isCapturable(tab: chrome.tabs.Tab): tab is CapturableTab {
  return typeof tab.url === "string" && /^https?:\/\//.test(tab.url);
}

// Ensure no window is left with zero tabs after a bulk close — Chrome would
// otherwise close the whole window (or the browser, for the last one). Any
// window that would be fully emptied gets a fresh blank tab first. This also
// implements the "Send all tabs in this window → reset to one blank tab"
// behavior for free, since that window gets emptied and re-seeded.
async function preventEmptyWindows(closingIds: Set<number>): Promise<void> {
  const all = await chrome.tabs.query({});
  const byWindow = new Map<number, chrome.tabs.Tab[]>();
  for (const t of all) {
    if (t.windowId == null) continue;
    const list = byWindow.get(t.windowId);
    if (list) list.push(t);
    else byWindow.set(t.windowId, [t]);
  }
  for (const [windowId, winTabs] of byWindow) {
    const remaining = winTabs.filter((t) => t.id == null || !closingIds.has(t.id));
    if (remaining.length === 0) {
      await chrome.tabs.create({ windowId, active: true });
    }
  }
}

// Sends a list of tabs to RecallQ in batched requests, then (optionally)
// closes the ones that were accepted.
export async function sendTabs(
  tabs: chrome.tabs.Tab[],
  opts: { closeAfter: boolean },
): Promise<SendResult> {
  const excluded = await getExcludedTabIds();
  const targets = tabs.filter(
    (t): t is CapturableTab =>
      isCapturable(t) && (t.id == null || !excluded.has(t.id)),
  );

  if (targets.length === 0) {
    return { sent: 0, total: 0, closed: 0, limitReached: false };
  }

  const settings = await getSettings();
  const sentTabIds: number[] = [];
  let sent = 0;
  let limitReached = false;

  for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
    const chunkTabs = targets.slice(i, i + CHUNK_SIZE);
    const items: IngestItemInput[] = chunkTabs.map((t) => ({
      type: "url",
      raw_url: t.url,
      title: t.title ?? null,
      source: "extension",
    }));
    try {
      const res = await apiClient.ingest.batch(items);
      sent += res.count;
      for (const t of chunkTabs) if (t.id != null) sentTabIds.push(t.id);
    } catch (error) {
      // Plan save-cap reached mid-batch — the server returns 402 with the
      // count it managed to import. Close only those, then stop.
      const details = (error as { details?: { imported_count?: number } }).details;
      const imported = typeof details?.imported_count === "number" ? details.imported_count : 0;
      sent += imported;
      for (let k = 0; k < imported; k++) {
        const t = chunkTabs[k];
        if (t?.id != null) sentTabIds.push(t.id);
      }
      limitReached = true;
      break;
    }
  }

  let closed = 0;
  if (opts.closeAfter && settings.closeTabsAfterSending && sentTabIds.length > 0) {
    const closingIds = new Set(sentTabIds);
    await preventEmptyWindows(closingIds);
    await chrome.tabs.remove(sentTabIds);
    closed = sentTabIds.length;
  }

  return { sent, total: targets.length, closed, limitReached };
}

// --- Tab list builders, each relative to the tab the menu was invoked on. ---

export function tabsInWindow(active: chrome.tabs.Tab): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query({ windowId: active.windowId });
}

export async function tabsExceptThis(active: chrome.tabs.Tab): Promise<chrome.tabs.Tab[]> {
  const tabs = await chrome.tabs.query({ windowId: active.windowId });
  return tabs.filter((t) => t.id !== active.id);
}

export async function tabsInGroup(active: chrome.tabs.Tab): Promise<chrome.tabs.Tab[]> {
  const NONE = chrome.tabGroups?.TAB_GROUP_ID_NONE ?? -1;
  if (active.groupId == null || active.groupId === NONE) return [];
  const tabs = await chrome.tabs.query({ windowId: active.windowId });
  return tabs.filter((t) => t.groupId === active.groupId);
}

export function selectedTabs(active: chrome.tabs.Tab): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query({ windowId: active.windowId, highlighted: true });
}

export async function tabsToLeft(active: chrome.tabs.Tab): Promise<chrome.tabs.Tab[]> {
  const tabs = await chrome.tabs.query({ windowId: active.windowId });
  return tabs.filter((t) => t.index < active.index);
}

export async function tabsToRight(active: chrome.tabs.Tab): Promise<chrome.tabs.Tab[]> {
  const tabs = await chrome.tabs.query({ windowId: active.windowId });
  return tabs.filter((t) => t.index > active.index);
}

export async function tabsAllWindows(active: chrome.tabs.Tab): Promise<chrome.tabs.Tab[]> {
  const tabs = await chrome.tabs.query({});
  return tabs.filter((t) => t.id !== active.id);
}

// Open the RecallQ app page, or focus it if it's already open. Pinned, and
// deduped so there's never more than one.
export async function openOrFocusApp(): Promise<void> {
  const existing = await chrome.tabs.query({ url: APP_URL });
  const tab = existing[0];
  if (tab?.id != null) {
    await chrome.tabs.update(tab.id, { active: true });
    if (tab.windowId != null) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    return;
  }
  await chrome.tabs.create({ url: APP_URL, pinned: true });
}
