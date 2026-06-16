// Background service worker. MV3 suspends idle workers after ~30s, so this
// must be event-driven only — no top-level state, no timers, no in-memory
// caches. All state lives in `chrome.storage` (`session` for the per-session
// exclusion set + plan cache, `local`/`sync` for settings).

import { apiClient } from "../lib/client";
import { getStoredToken } from "../lib/auth-storage";
import { forgetExcludedTab, isTabExcluded, toggleExcludedTab } from "../lib/exclusion";
import {
  openOrFocusApp,
  selectedTabs,
  sendTabs,
  tabsAllWindows,
  tabsExceptThis,
  tabsInGroup,
  tabsInWindow,
  tabsToLeft,
  tabsToRight,
  type SendResult,
} from "../lib/tabs";

// --- Menu ids -------------------------------------------------------------
const MENU_ROOT = "recallq:root";
const MENU_OPEN = "recallq:open";
const MENU_SEND_THIS = "recallq:send-this";
const MENU_SEND_WINDOW = "recallq:send-window";
const MENU_SEND_EXCEPT = "recallq:send-except";
const MENU_SEND_SELECTED = "recallq:send-selected";
const MENU_SEND_GROUP = "recallq:send-group";
const MENU_SEND_LEFT = "recallq:send-left";
const MENU_SEND_RIGHT = "recallq:send-right";
const MENU_SEND_ALL_WINDOWS = "recallq:send-all-windows";
const MENU_EXCLUDE = "recallq:exclude";
// Context-specific (kept from v0.1).
const MENU_SAVE_LINK = "recallq:save-link";
const MENU_SAVE_SELECTION = "recallq:save-selection";

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => ensureContextMenus());
  ensureContextMenus();

  // Keep the "Exclude …" label pointed at whatever tab is currently active.
  chrome.tabs.onActivated.addListener(() => void updateExcludeMenuTitle());
  chrome.windows.onFocusChanged.addListener(() => void updateExcludeMenuTitle());
  chrome.tabs.onUpdated.addListener((_id, info, tab) => {
    if (info.title != null || info.status === "complete") {
      if (tab.active) void updateExcludeMenuTitle();
    }
  });
  // Drop closed tabs from the exclusion set so ids never leak across reuse.
  chrome.tabs.onRemoved.addListener((tabId) => void forgetExcludedTab(tabId));

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    void handleMenuClick(info, tab);
  });
});

function ensureContextMenus() {
  // `removeAll` first because re-adding the same id throws.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ROOT,
      title: "RecallQ",
      contexts: ["page", "action"],
    });

    const child = (id: string, title: string) =>
      chrome.contextMenus.create({ id, parentId: MENU_ROOT, title, contexts: ["page", "action"] });
    const separator = (id: string) =>
      chrome.contextMenus.create({ id, parentId: MENU_ROOT, type: "separator", contexts: ["page", "action"] });

    child(MENU_OPEN, "Open RecallQ");
    separator("recallq:sep-1");
    child(MENU_SEND_THIS, "Send only this tab to RecallQ");
    child(MENU_SEND_WINDOW, "Send all tabs in this window to RecallQ");
    child(MENU_SEND_EXCEPT, "Send all tabs except this tab to RecallQ");
    child(MENU_SEND_SELECTED, "Send selected tabs to RecallQ");
    child(MENU_SEND_GROUP, "Send all tabs in this tab group to RecallQ");
    child(MENU_SEND_LEFT, "Send tabs on the left to RecallQ");
    child(MENU_SEND_RIGHT, "Send tabs on the right to RecallQ");
    child(MENU_SEND_ALL_WINDOWS, "Send all tabs from all windows to RecallQ");
    separator("recallq:sep-2");
    child(MENU_EXCLUDE, "Exclude this tab from RecallQ");

    // Context-specific quick saves (only show on a link / selection).
    chrome.contextMenus.create({
      id: MENU_SAVE_LINK,
      title: "Save link to RecallQ",
      contexts: ["link"],
    });
    chrome.contextMenus.create({
      id: MENU_SAVE_SELECTION,
      title: "Save selection to RecallQ",
      contexts: ["selection"],
    });

    void updateExcludeMenuTitle();
  });
}

async function handleMenuClick(
  info: chrome.contextMenus.OnClickData,
  clickedTab: chrome.tabs.Tab | undefined,
) {
  const id = info.menuItemId;

  // "Open" works signed-out (the app page shows the sign-in CTA).
  if (id === MENU_OPEN) {
    await openOrFocusApp();
    return;
  }

  // Resolve the active tab the menu was invoked on (some contexts omit it).
  const active = clickedTab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

  if (id === MENU_EXCLUDE) {
    if (active?.id == null) return;
    await toggleExcludedTab(active.id);
    await updateExcludeMenuTitle();
    return;
  }

  // Everything below needs auth.
  const token = await getStoredToken();
  if (!token) {
    notify("Sign in to RecallQ first");
    await openOrFocusApp();
    return;
  }

  try {
    // Context-specific quick saves.
    if (id === MENU_SAVE_LINK && info.linkUrl) {
      await apiClient.ingest.url({ url: info.linkUrl, source: "extension" });
      notify("Link saved to RecallQ");
      return;
    }
    if (id === MENU_SAVE_SELECTION) {
      const text = info.selectionText?.trim();
      if (!text) return;
      await apiClient.ingest.text({
        text,
        capture_note: active?.url ?? null,
        source: "extension",
      });
      notify("Selection saved to RecallQ");
      return;
    }

    if (!active) {
      notify("No active tab");
      return;
    }

    // Bulk tab sends — build the target list, then send + close.
    const builders: Record<string, () => Promise<chrome.tabs.Tab[]>> = {
      [MENU_SEND_THIS]: async () => [active],
      [MENU_SEND_WINDOW]: () => tabsInWindow(active),
      [MENU_SEND_EXCEPT]: () => tabsExceptThis(active),
      [MENU_SEND_SELECTED]: () => selectedTabs(active),
      [MENU_SEND_GROUP]: () => tabsInGroup(active),
      [MENU_SEND_LEFT]: () => tabsToLeft(active),
      [MENU_SEND_RIGHT]: () => tabsToRight(active),
      [MENU_SEND_ALL_WINDOWS]: () => tabsAllWindows(active),
    };

    const build = builders[id as string];
    if (!build) return;

    const tabs = await build();
    if (tabs.length === 0) {
      notify(id === MENU_SEND_GROUP ? "This tab isn't in a group" : "No tabs to send");
      return;
    }

    const result = await sendTabs(tabs, { closeAfter: true });
    notify(formatResult(result));
  } catch (error) {
    notify(error instanceof Error ? error.message : "Save failed");
  }
}

function formatResult(result: SendResult): string {
  if (result.sent === 0) return "Nothing sent";
  const parts = [`Sent ${result.sent}`];
  if (result.sent < result.total) parts[0] = `Sent ${result.sent} of ${result.total}`;
  if (result.closed > 0) parts.push(`closed ${result.closed}`);
  let msg = parts.join(" · ");
  if (result.limitReached) msg += " · limit reached";
  return msg;
}

async function updateExcludeMenuTitle() {
  const active = (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  const label = truncate(active?.title || active?.url || "this tab", 40);
  const excluded = active?.id != null ? await isTabExcluded(active.id) : false;
  const title = excluded
    ? `Include "${label}" in RecallQ`
    : `Exclude "${label}" from RecallQ`;
  try {
    await chrome.contextMenus.update(MENU_EXCLUDE, { title });
  } catch {
    // Menu may not exist yet during first boot — ignore.
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function notify(message: string) {
  // Lightweight badge-based feedback — no notifications permission needed.
  chrome.action.setBadgeText({ text: "✓" });
  chrome.action.setBadgeBackgroundColor({ color: "#6366f1" });
  chrome.action.setTitle({ title: message });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: "" });
    chrome.action.setTitle({ title: "Save to RecallQ" });
  }, 2500);
}
