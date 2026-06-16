// Extension preferences, stored in `chrome.storage.local`. With the local-first
// model, "sync" now means **cloud** sync (push the on-device archive to the
// RecallQ server + pull cross-device changes back), which is the paid feature.
// Free users save unlimited tabs locally with this off.

export type ExtensionSettings = {
  // Close tabs after sending them to RecallQ (offload-and-clear). Default on —
  // the whole point of the bulk sends is to clear the window.
  closeTabsAfterSending: boolean;
  // Push the local archive to the cloud and pull cross-device changes (paid).
  cloudSyncEnabled: boolean;
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  closeTabsAfterSending: true,
  cloudSyncEnabled: false,
};

const SETTINGS_KEY = "recallq.settings";

export async function getSettings(): Promise<ExtensionSettings> {
  const res = await chrome.storage.local.get(SETTINGS_KEY);
  const val = res[SETTINGS_KEY];
  const stored = val && typeof val === "object" ? (val as Partial<ExtensionSettings>) : {};
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function setSettings(
  patch: Partial<ExtensionSettings>,
): Promise<ExtensionSettings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}
