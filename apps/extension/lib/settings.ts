// Extension preferences. Stored in `chrome.storage.local` always (the
// source-of-truth for the `syncEnabled` intent flag, available offline). When
// sync is enabled (paid plans only — gated in the UI via `lib/plan.ts`),
// settings are mirrored to `chrome.storage.sync`, which Chrome propagates
// across the user's signed-in profiles. Reads prefer the synced copy so a
// change on one device shows up on another.

export type ExtensionSettings = {
  // Close tabs after sending them to RecallQ (offload-and-clear). Default on —
  // the whole point of the bulk sends is to clear the window.
  closeTabsAfterSending: boolean;
  // Optional default collection id new captures land in (null = inbox).
  defaultCollectionId: string | null;
  // Whether to sync these settings across devices (paid feature).
  syncEnabled: boolean;
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  closeTabsAfterSending: true,
  defaultCollectionId: null,
  syncEnabled: false,
};

const SETTINGS_KEY = "recallq.settings";

async function readArea(
  area: chrome.storage.StorageArea,
): Promise<Partial<ExtensionSettings> | null> {
  const res = await area.get(SETTINGS_KEY);
  const val = res[SETTINGS_KEY];
  return val && typeof val === "object" ? (val as Partial<ExtensionSettings>) : null;
}

export async function getSettings(): Promise<ExtensionSettings> {
  const local = (await readArea(chrome.storage.local)) ?? {};
  const merged: ExtensionSettings = { ...DEFAULT_SETTINGS, ...local };
  if (merged.syncEnabled) {
    const synced = await readArea(chrome.storage.sync);
    if (synced) return { ...merged, ...synced, syncEnabled: true };
  }
  return merged;
}

export async function setSettings(
  patch: Partial<ExtensionSettings>,
): Promise<ExtensionSettings> {
  const current = await getSettings();
  const next: ExtensionSettings = { ...current, ...patch };
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  if (next.syncEnabled) {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: next });
  } else {
    // Sync just turned off — drop the synced copy so it stops propagating.
    await chrome.storage.sync.remove(SETTINGS_KEY);
  }
  return next;
}
