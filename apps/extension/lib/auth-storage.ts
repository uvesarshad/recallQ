// Token persistence for the extension. Uses `chrome.storage.local` (encrypted
// at rest by Chrome under MV3) so the bearer token survives across service
// worker restarts, popup re-opens, and Chrome relaunches.
//
// The plaintext token is set ONLY here. The background service worker, popup,
// and any future side panel all read it through `getStoredToken()`.

const TOKEN_KEY = "recallq.auth.token";
const PREFIX_KEY = "recallq.auth.prefix";
const DEVICE_NAME_KEY = "recallq.auth.device_name";

export type StoredAuth = {
  token: string;
  prefix: string;
  deviceName: string;
};

export async function getStoredAuth(): Promise<StoredAuth | null> {
  const result = await chrome.storage.local.get([
    TOKEN_KEY,
    PREFIX_KEY,
    DEVICE_NAME_KEY,
  ]);
  const token = result[TOKEN_KEY];
  if (typeof token !== "string" || !token) return null;
  return {
    token,
    prefix: typeof result[PREFIX_KEY] === "string" ? result[PREFIX_KEY] : "",
    deviceName:
      typeof result[DEVICE_NAME_KEY] === "string"
        ? result[DEVICE_NAME_KEY]
        : "Chrome",
  };
}

export async function getStoredToken(): Promise<string | null> {
  return (await getStoredAuth())?.token ?? null;
}

export async function setStoredAuth(auth: StoredAuth): Promise<void> {
  await chrome.storage.local.set({
    [TOKEN_KEY]: auth.token,
    [PREFIX_KEY]: auth.prefix,
    [DEVICE_NAME_KEY]: auth.deviceName,
  });
}

export async function clearStoredAuth(): Promise<void> {
  await chrome.storage.local.remove([TOKEN_KEY, PREFIX_KEY, DEVICE_NAME_KEY]);
}
