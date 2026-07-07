import Constants from "expo-constants";

// API base URL resolution:
//   - production builds always hit recallq.xyz
//   - dev builds use EXPO_PUBLIC_API_URL when set
//   - otherwise Expo Go derives the LAN host from Metro and swaps to the web
//     app's port, so physical devices do not accidentally call themselves.
//
// `EXPO_PUBLIC_*` env vars are inlined at bundle time by Metro.

const PROD_API = "https://recallq.xyz/api/v1";
const PROD_WEB = "https://recallq.xyz";
const DEV_WEB_PORT = "3008";

const explicitApi = process.env.EXPO_PUBLIC_API_URL;
const explicitWeb = process.env.EXPO_PUBLIC_WEB_URL;

const isDev = (Constants.expoConfig?.extra?.env ?? process.env.NODE_ENV) !== "production";

function getMetroHost(): string | null {
  const expoConfig = Constants.expoConfig as { hostUri?: string } | null;
  const hostUri = expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoGo?.debuggerHost;
  const host = typeof hostUri === "string" ? hostUri.split(":")[0] : null;
  return host || null;
}

function getDevWebOrigin(): string {
  const host = getMetroHost() ?? "localhost";
  return `http://${host}:${DEV_WEB_PORT}`;
}

export const API_BASE_URL: string =
  explicitApi ?? (isDev ? `${getDevWebOrigin()}/api/v1` : PROD_API);

export const WEB_BASE_URL: string =
  explicitWeb ?? (isDev ? getDevWebOrigin() : PROD_WEB);

export const IS_EXPO_GO = Constants.appOwnership === "expo";
