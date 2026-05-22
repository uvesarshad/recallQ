import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api-response";
import { generateToken } from "@/lib/auth-tokens";
import { logger } from "@/lib/logger";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyOAuthIdToken, type OAuthProvider } from "@/lib/oauth-verify";

const RequestSchema = z.object({
  provider: z.enum(["google", "apple"]),
  id_token: z.string().min(1).max(8192),
  device_name: z.string().min(1).max(64),
  // Apple returns the user's full name only on the very first sign-in,
  // outside the JWT. The mobile client surfaces it here so we can store it
  // on the freshly-created user row.
  name: z.string().min(1).max(120).optional(),
});

// POST /api/v1/auth/oauth/token
// Mobile clients (Expo) obtain an ID token from Sign in with Apple or Google
// Sign-In natively, then POST it here. We verify the signature + audience
// against the provider's JWKS, find or create the matching user, and mint
// a personal access token in the same shape as POST /auth/tokens.
export async function POST(req: Request): Promise<Response> {
  // IP throttle to match the credentials login path. Targeted credential
  // stuffing isn't really applicable here (you'd need to forge a signed ID
  // token), but generic spam is.
  const ip = getClientIp(req);
  const limit = await rateLimit({
    key: `oauth-token:ip:${ip}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) {
    return fail("rate_limited", "Too many sign-in attempts from this network.", 429);
  }

  const body = await parseBody(req, RequestSchema);
  if (!body.ok) return body.response;

  const { provider, id_token, device_name, name: clientName } = body.data;

  let identity;
  try {
    identity = await verifyOAuthIdToken(provider, id_token);
  } catch (error) {
    logger.warn("oauth-token", "ID token verification failed", {
      provider,
      error: error instanceof Error ? error.message : String(error),
    });
    return fail("unauthorized", "Invalid identity token", 401);
  }

  const effectiveName = identity.name ?? clientName ?? null;
  const userId = await findOrCreateUser(provider, identity, effectiveName);
  if (!userId) {
    return fail("unauthorized", "Could not link this identity to an account", 401);
  }

  const generated = generateToken();
  const insertRes = await db.query<{ id: string; created_at: Date }>(
    `INSERT INTO personal_access_tokens (user_id, device_name, token_hash, prefix)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [userId, device_name, generated.hash, generated.prefix],
  );
  const row = insertRes.rows[0];

  return ok(
    {
      token: generated.raw,
      id: row.id,
      prefix: generated.prefix,
      device_name,
      created_at: row.created_at.toISOString(),
    },
    { status: 201 },
  );
}

async function findOrCreateUser(
  provider: OAuthProvider,
  identity: {
    subject: string;
    email: string | null;
    emailVerified: boolean;
    name: string | null;
  },
  name: string | null,
): Promise<string | null> {
  // 1. Already-linked account: provider + providerAccountId match.
  const existingAccount = await db.query<{ userId: string }>(
    `SELECT "userId" FROM accounts WHERE provider = $1 AND "providerAccountId" = $2 LIMIT 1`,
    [provider, identity.subject],
  );
  if ((existingAccount.rowCount ?? 0) > 0) {
    return existingAccount.rows[0].userId;
  }

  // 2. Link to existing email-based account.
  if (identity.email) {
    const existingUser = await db.query<{ id: string }>(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [identity.email],
    );
    if ((existingUser.rowCount ?? 0) > 0) {
      const userId = existingUser.rows[0].id;
      await linkAccount(userId, provider, identity.subject);
      return userId;
    }
  }

  // 3. Create a brand-new user. Apple's private relay returns an email like
  //    `<random>@privaterelay.appleid.com`; we accept it just like any
  //    other email so the user has a way to be reached for transactional
  //    mail (Apple forwards it).
  if (!identity.email) {
    // Apple users can opt out of sharing email entirely. Without an email
    // we can't create a user (NextAuth + our schema both require it).
    return null;
  }

  const createdAt = new Date().toISOString();
  const newUser = await db.query<{ id: string }>(
    `INSERT INTO users (name, email, "emailVerified")
     VALUES ($1, $2, $3)
     RETURNING id`,
    [
      name,
      identity.email,
      identity.emailVerified ? createdAt : null,
    ],
  );
  const userId = newUser.rows[0].id;
  await linkAccount(userId, provider, identity.subject);
  return userId;
}

async function linkAccount(userId: string, provider: OAuthProvider, providerAccountId: string) {
  await db.query(
    `INSERT INTO accounts ("userId", type, provider, "providerAccountId")
     VALUES ($1, 'oauth', $2, $3)
     ON CONFLICT DO NOTHING`,
    [userId, provider, providerAccountId],
  );
}
