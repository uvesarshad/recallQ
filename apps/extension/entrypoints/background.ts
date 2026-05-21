// Background service worker. MV3 suspends idle workers after ~30s, so this
// must be event-driven only — no top-level state, no timers, no in-memory
// caches. All state lives in `chrome.storage`.

import { apiClient } from "../lib/client";
import { getStoredToken } from "../lib/auth-storage";

const MENU_SAVE_LINK = "recallq:save-link";
const MENU_SAVE_SELECTION = "recallq:save-selection";

export default defineBackground(() => {
  // Context menu setup on install + on every service worker boot (Chrome
  // re-creates menus per worker session).
  chrome.runtime.onInstalled.addListener(() => {
    ensureContextMenus();
  });
  ensureContextMenus();

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const token = await getStoredToken();
    if (!token) {
      // Not signed in — open the popup so the user can connect their
      // account. Chrome doesn't programmatically open the popup, so we open
      // the connect page in a new tab instead.
      await chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
      return;
    }

    try {
      if (info.menuItemId === MENU_SAVE_LINK && info.linkUrl) {
        await apiClient.ingest.url({ url: info.linkUrl, source: "extension" });
        notify("Link saved to RecallQ");
      } else if (info.menuItemId === MENU_SAVE_SELECTION) {
        const text = info.selectionText?.trim();
        if (!text) return;
        await apiClient.ingest.text({
          text,
          capture_note: tab?.url ?? null,
          source: "extension",
        });
        notify("Selection saved to RecallQ");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Save failed";
      notify(message);
    }
  });
});

function ensureContextMenus() {
  // `removeAll` first because re-adding the same id throws.
  chrome.contextMenus.removeAll(() => {
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
  });
}

function notify(message: string) {
  // Lightweight badge-based feedback. We don't ship a notification permission
  // in v1 to keep the permissions list short; a 2s badge swap is enough
  // signal that the save worked.
  chrome.action.setBadgeText({ text: "✓" });
  chrome.action.setBadgeBackgroundColor({ color: "#6366f1" });
  chrome.action.setTitle({ title: message });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: "" });
    chrome.action.setTitle({ title: "Save to RecallQ" });
  }, 2000);
}
