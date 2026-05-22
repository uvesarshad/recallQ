// Apple's OAuth flow requires the `client_secret` to be a JWT signed with
// your Sign in with Apple private key (the .p8 you download from the
// Apple Developer console). The JWT is short-lived (6 months max), so we
// generate it lazily and cache it for the duration of the worker process.
//
// Env layout:
//   APPLE_CLIENT_ID       — your Services ID (e.g. `ai.montr.recallq.signin`).
//                           This is also the Apple `clientId` for NextAuth.
//   APPLE_TEAM_ID         — 10-char Apple Team ID (top-right of the Apple
//                           Developer dashboard).
//   APPLE_KEY_ID          — 10-char Key ID from the .p8 you generated.
//   APPLE_PRIVATE_KEY     — the full PEM contents of the .p8 file, including
//                           the BEGIN/END lines. When stored in .env with
//                           literal \n separators, this code restores them.

import { SignJWT, importPKCS8 } from "jose";

const APPLE_AUDIENCE = "https://appleid.apple.com";
const SECRET_TTL_SECONDS = 60 * 60 * 24 * 30 * 5; // 5 months, well under Apple's 6-month max

type AppleConfig = {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
};

function readAppleConfig(): AppleConfig | null {
  const clientId = process.env.APPLE_CLIENT_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const rawKey = process.env.APPLE_PRIVATE_KEY;
  if (!clientId || !teamId || !keyId || !rawKey) return null;
  // .env files store newlines as literal `\n`; restore them so the PEM
  // parser sees real BEGIN/END blocks.
  const privateKey = rawKey.replace(/\\n/g, "\n");
  return { clientId, teamId, keyId, privateKey };
}

export function isAppleSignInConfigured(): boolean {
  return readAppleConfig() !== null;
}

let cached: { secret: string; expiresAt: number } | null = null;

export async function getAppleClientSecret(): Promise<string | null> {
  const config = readAppleConfig();
  if (!config) return null;

  // Refresh ~10 minutes before expiry to avoid edge-of-window failures.
  if (cached && cached.expiresAt - Date.now() > 10 * 60 * 1000) {
    return cached.secret;
  }

  const key = await importPKCS8(config.privateKey, "ES256");
  const now = Math.floor(Date.now() / 1000);
  const secret = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + SECRET_TTL_SECONDS)
    .setAudience(APPLE_AUDIENCE)
    .setSubject(config.clientId)
    .sign(key);

  cached = { secret, expiresAt: (now + SECRET_TTL_SECONDS) * 1000 };
  return secret;
}

export async function getAppleProviderCredentials(): Promise<
  { clientId: string; clientSecret: string } | null
> {
  const config = readAppleConfig();
  if (!config) return null;
  const secret = await getAppleClientSecret();
  if (!secret) return null;
  return { clientId: config.clientId, clientSecret: secret };
}
