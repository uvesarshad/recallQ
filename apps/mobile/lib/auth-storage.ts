import * as SecureStore from "expo-secure-store";

// Bearer token persistence. `expo-secure-store` writes to the iOS Keychain
// and Android Keystore — encrypted at rest, survives app restarts, and is
// scoped to the bundle id so other apps can't read it. The plaintext token
// only ever exists here.

const TOKEN_KEY = "recallq.auth.token";
const PREFIX_KEY = "recallq.auth.prefix";
const DEVICE_KEY = "recallq.auth.device_name";
const EMAIL_KEY = "recallq.auth.email";

export type StoredAuth = {
  token: string;
  prefix: string;
  deviceName: string;
  email: string | null;
};

export async function getStoredAuth(): Promise<StoredAuth | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return null;
  const [prefix, deviceName, email] = await Promise.all([
    SecureStore.getItemAsync(PREFIX_KEY),
    SecureStore.getItemAsync(DEVICE_KEY),
    SecureStore.getItemAsync(EMAIL_KEY),
  ]);
  return {
    token,
    prefix: prefix ?? "",
    deviceName: deviceName ?? "Mobile",
    email,
  };
}

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setStoredAuth(auth: StoredAuth): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, auth.token),
    SecureStore.setItemAsync(PREFIX_KEY, auth.prefix),
    SecureStore.setItemAsync(DEVICE_KEY, auth.deviceName),
    auth.email
      ? SecureStore.setItemAsync(EMAIL_KEY, auth.email)
      : SecureStore.deleteItemAsync(EMAIL_KEY),
  ]);
}

export async function clearStoredAuth(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(PREFIX_KEY),
    SecureStore.deleteItemAsync(DEVICE_KEY),
    SecureStore.deleteItemAsync(EMAIL_KEY),
  ]);
}
