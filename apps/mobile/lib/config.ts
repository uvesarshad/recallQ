import Constants from "expo-constants";

// API base URL resolution:
//   - production builds always hit recallq.xyz
//   - dev builds default to localhost:3008, but on a physical device localhost
//     resolves to the phone, not your laptop. Set `EXPO_PUBLIC_API_URL` to
//     your machine's LAN IP (e.g. `http://192.168.1.42:3008/api/v1`) when
//     testing on hardware.
//
// `EXPO_PUBLIC_*` env vars are inlined at bundle time by Metro.

const PROD_API = "https://recallq.xyz/api/v1";
const PROD_WEB = "https://recallq.xyz";

const explicitApi = process.env.EXPO_PUBLIC_API_URL;
const explicitWeb = process.env.EXPO_PUBLIC_WEB_URL;

const isDev = (Constants.expoConfig?.extra?.env ?? process.env.NODE_ENV) !== "production";

export const API_BASE_URL: string =
  explicitApi ?? (isDev ? "http://localhost:3008/api/v1" : PROD_API);

export const WEB_BASE_URL: string =
  explicitWeb ?? (isDev ? "http://localhost:3008" : PROD_WEB);
