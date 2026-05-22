// Mobile OAuth helpers. Exchange a provider ID token for a RecallQ PAT via
// the web's /api/v1/auth/oauth/token endpoint (see lib/oauth-verify.ts on
// the server). Apple is iOS-only (uses native sheet); Google is
// cross-platform via expo-auth-session.

import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import { API_BASE_URL } from "./config";
import type { StoredAuth } from "./auth-storage";

export type OAuthProvider = "google" | "apple";

type TokenIssueResponse = {
  token: string;
  id: string;
  prefix: string;
  device_name: string;
  created_at: string;
};

// POSTs the verified ID token to the server, returns the StoredAuth shape
// the AuthProvider expects.
async function exchangeIdToken(input: {
  provider: OAuthProvider;
  id_token: string;
  device_name: string;
  email: string | null;
  name?: string | null;
}): Promise<StoredAuth> {
  const response = await fetch(`${API_BASE_URL}/auth/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: input.provider,
      id_token: input.id_token,
      device_name: input.device_name,
      name: input.name ?? undefined,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `OAuth exchange failed with ${response.status}`);
  }
  const data = (await response.json()) as TokenIssueResponse;
  return {
    token: data.token,
    prefix: data.prefix,
    deviceName: data.device_name,
    email: input.email,
  };
}

// ── Apple ───────────────────────────────────────────────────────────────

export function isAppleSignInAvailable(): boolean {
  // expo-apple-authentication only ships on iOS. On Android / web the SDK
  // throws at import-time-not-quite-but-its-not-useful, so we gate strictly.
  return Platform.OS === "ios";
}

export async function signInWithApple(deviceName: string): Promise<StoredAuth> {
  if (!isAppleSignInAvailable()) {
    throw new Error("Sign in with Apple is only available on iOS");
  }
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) {
    throw new Error("Apple did not return an identity token");
  }
  const name = credential.fullName
    ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(" ").trim() || null
    : null;
  return exchangeIdToken({
    provider: "apple",
    id_token: credential.identityToken,
    device_name: deviceName,
    email: credential.email ?? null,
    name,
  });
}

// ── Google ──────────────────────────────────────────────────────────────

// Exposed as a hook because expo-auth-session uses React state internally.
// Component calls `useGoogleAuth()` to get `{ request, promptAsync,
// exchange }`; on press, call `promptAsync()` and pass the resulting
// response to `exchange(response)` once it resolves.
export function useGoogleAuth(deviceName: string) {
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    // Force ID token in the response.
    responseType: "id_token",
  });

  async function exchange(): Promise<StoredAuth | null> {
    if (!response || response.type !== "success") return null;
    const idToken = response.params?.id_token ?? response.authentication?.idToken;
    if (!idToken) throw new Error("Google did not return an ID token");
    return exchangeIdToken({
      provider: "google",
      id_token: idToken,
      device_name: deviceName,
      email: null,
    });
  }

  return { request, response, promptAsync, exchange };
}
