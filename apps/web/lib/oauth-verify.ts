// ID-token verification for the mobile OAuth → PAT exchange flow
// (`/api/v1/auth/oauth/token`). Validates the cryptographic signature
// against the provider's published JWKS and checks issuer + audience.
//
// Why this exists separately from NextAuth: NextAuth's web flow is browser-
// redirect-based and can't be triggered from a native app's Sign-in-with-
// Apple sheet or Google Sign-In SDK. The mobile clients obtain an ID token
// natively, then post it here. We verify it server-side and mint a PAT.

import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "@/lib/env";

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const APPLE_ISSUER = "https://appleid.apple.com";

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export type OAuthProvider = "google" | "apple";

export type VerifiedOAuthIdentity = {
  provider: OAuthProvider;
  subject: string;          // provider's stable user id (`sub`)
  email: string | null;     // may be null for Apple private-relay users
  emailVerified: boolean;
  name: string | null;      // may be null on Apple after the first sign-in
};

function splitAudienceList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function allowedGoogleAudiences(): string[] {
  return Array.from(
    new Set(
      [env.GOOGLE_CLIENT_ID, ...splitAudienceList(env.OAUTH_ALLOWED_GOOGLE_AUDIENCES)].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  );
}

function allowedAppleAudiences(): string[] {
  return Array.from(
    new Set(
      [env.APPLE_CLIENT_ID, ...splitAudienceList(env.OAUTH_ALLOWED_APPLE_AUDIENCES)].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  );
}

export async function verifyOAuthIdToken(
  provider: OAuthProvider,
  idToken: string,
): Promise<VerifiedOAuthIdentity> {
  const audiences = provider === "google" ? allowedGoogleAudiences() : allowedAppleAudiences();
  if (audiences.length === 0) {
    throw new Error(`No allowed audiences configured for ${provider} OAuth`);
  }

  const jwks = provider === "google" ? GOOGLE_JWKS : APPLE_JWKS;
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: provider === "google" ? GOOGLE_ISSUERS : APPLE_ISSUER,
    audience: audiences,
  });

  const sub = payload.sub;
  if (!sub) throw new Error("ID token missing `sub`");

  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  const emailVerified =
    payload.email_verified === true ||
    payload.email_verified === "true";

  // Google sticks the display name in `name`; Apple only includes the user's
  // name on the very first authorize and exposes it through a separate
  // request param (handled in the route, not here).
  const name = typeof payload.name === "string" ? payload.name : null;

  return {
    provider,
    subject: sub,
    email,
    emailVerified,
    name,
  };
}
