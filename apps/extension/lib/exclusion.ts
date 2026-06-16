// Session-scoped exclusion set: tab ids the user has explicitly opted out of
// bulk sends. Stored in `chrome.storage.session` (cleared when the browser
// closes) so it stays per-session and never persists — matching the "just
// this one tab" semantics. Keyed by tab id, so it resets naturally when a tab
// is closed (see the onRemoved cleanup in background.ts).

const EXCLUDED_KEY = "recallq.excluded.tabIds";

export async function getExcludedTabIds(): Promise<Set<number>> {
  const res = await chrome.storage.session.get(EXCLUDED_KEY);
  const arr = res[EXCLUDED_KEY];
  return new Set(
    Array.isArray(arr) ? arr.filter((x): x is number => typeof x === "number") : [],
  );
}

export async function isTabExcluded(tabId: number): Promise<boolean> {
  return (await getExcludedTabIds()).has(tabId);
}

// Toggles a tab in/out of the exclusion set. Returns the new excluded state.
export async function toggleExcludedTab(tabId: number): Promise<boolean> {
  const set = await getExcludedTabIds();
  const nowExcluded = !set.has(tabId);
  if (nowExcluded) set.add(tabId);
  else set.delete(tabId);
  await chrome.storage.session.set({ [EXCLUDED_KEY]: [...set] });
  return nowExcluded;
}

export async function forgetExcludedTab(tabId: number): Promise<void> {
  const set = await getExcludedTabIds();
  if (set.delete(tabId)) {
    await chrome.storage.session.set({ [EXCLUDED_KEY]: [...set] });
  }
}
