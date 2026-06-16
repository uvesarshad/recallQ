// Core tab-management logic shared by the background context menu. No content
// scripts are used anywhere — every bit of tab data (url, title, index,
// groupId) comes from the `chrome.tabs` / `chrome.tabGroups` APIs, keeping
// per-page memory at zero.

import { getExcludedTabIds } from "./exclusion";
import { addUrls } from "./local-archive";
import { getSettings } from "./settings";
import { runSync } from "./sync";

export const APP_URL = chrome.runtime.getURL("app.html");

export type SendResult = {
  saved: number; // tabs written to the local archive (added + de-duped updates)
  total: number; // capturable, non-excluded tabs targeted
  closed: number; // tabs removed afterward
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

// Saves a list of tabs to the local archive (unlimited, free, offline), kicks
// off a cloud sync if it's enabled, then optionally closes the saved tabs.
// No auth required — local save always works, even signed-out.
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
    return { saved: 0, total: 0, closed: 0 };
  }

  const { added, updated } = await addUrls(
    targets.map((t) => ({ url: t.url, title: t.title ?? null })),
  );
  // Fire-and-forget cloud push/pull; no-ops when cloud sync is off.
  void runSync().catch(() => {});

  let closed = 0;
  const settings = await getSettings();
  if (opts.closeAfter && settings.closeTabsAfterSending) {
    const ids = targets
      .map((t) => t.id)
      .filter((id): id is number => id != null);
    if (ids.length > 0) {
      await preventEmptyWindows(new Set(ids));
      await chrome.tabs.remove(ids);
      closed = ids.length;
    }
  }

  return { saved: added + updated, total: targets.length, closed };
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
