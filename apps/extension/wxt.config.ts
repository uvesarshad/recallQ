import { defineConfig } from "wxt";

// RecallQ Chrome extension — Manifest V3, cross-browser via WXT.
// Author: Montr AI. Production target: https://recallq.xyz.

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: ".",
  manifest: ({ browser }) => ({
    name: "RecallQ",
    short_name: "RecallQ",
    description:
      "Save anything from the web to RecallQ — links, notes, and selections from any page.",
    version: "0.1.0",
    author: { email: "hello@montr.ai" },
    homepage_url: "https://recallq.xyz",
    permissions: [
      "activeTab",
      "contextMenus",
      "storage",
      "identity",
      // Read url/title/index/groupId of non-active tabs (bulk tab sends) and
      // enumerate tab groups. No content scripts — all tab data comes from
      // these APIs, so nothing is injected into pages.
      "tabs",
      "tabGroups",
      // Unbounded on-device archive: all users save unlimited tabs locally,
      // free and offline, regardless of plan. Cloud sync is the paid layer.
      "unlimitedStorage",
    ],
    host_permissions: [
      "https://recallq.xyz/*",
      ...(browser === "firefox" ? [] : ["http://localhost:3008/*"]),
    ],
    action: {
      default_title: "Save to RecallQ",
    },
    // Chrome-only: side panel API. Firefox doesn't support it; WXT will
    // strip it from the firefox manifest automatically when we add it.
  }),
});
