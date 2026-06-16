// Shared sign-in flow used by the app page (and available to the popup).
// Opens the web `/extension/connect` bridge via chrome.identity, which mints a
// personal access token and redirects it back to the extension's reserved
// chromiumapp.org URL.

import { setStoredAuth, type StoredAuth } from "./auth-storage";
import { WEB_BASE_URL } from "./config";

export async function signInWithRecallQ(): Promise<StoredAuth> {
  const redirectUrl = chrome.identity.getRedirectURL();
  const connectUrl = new URL(`${WEB_BASE_URL}/extension/connect`);
  connectUrl.searchParams.set("return_url", redirectUrl);
  connectUrl.searchParams.set("device_name", "Chrome");

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: connectUrl.toString(),
    interactive: true,
  });
  if (!responseUrl) throw new Error("Sign-in cancelled");

  const parsed = new URL(responseUrl);
  const token = parsed.searchParams.get("token");
  const prefix = parsed.searchParams.get("prefix") ?? "";
  const deviceName = parsed.searchParams.get("device_name") ?? "Chrome";
  if (!token) throw new Error("No token in callback");

  const auth: StoredAuth = { token, prefix, deviceName };
  await setStoredAuth(auth);
  return auth;
}
