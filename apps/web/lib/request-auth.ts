import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { extractBearerToken, hashToken } from "@/lib/auth-tokens";

export type AuthedUser = {
  id: string;
  authType: "session" | "token" | "internal";
};

export async function requireSessionUser(): Promise<AuthedUser | null> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  return { id: userId, authType: "session" };
}

async function requireBearerUser(req: Request): Promise<AuthedUser | null> {
  const raw = extractBearerToken(req.headers.get("authorization"));
  if (!raw) return null;

  const hash = hashToken(raw);
  const result = await db.query<{ user_id: string }>(
    `UPDATE personal_access_tokens
        SET last_used_at = now()
      WHERE token_hash = $1 AND revoked_at IS NULL
      RETURNING user_id`,
    [hash],
  );

  if ((result.rowCount ?? 0) === 0) return null;
  return { id: result.rows[0].user_id, authType: "token" };
}

// Accepts either a NextAuth session cookie (web) or an Authorization bearer
// token (Chrome extension, mobile). Use this on any /api/v1/* route that
// should be reachable from non-browser clients.
export async function requireUser(req: Request): Promise<AuthedUser | null> {
  const session = await requireSessionUser();
  if (session) return session;
  return requireBearerUser(req);
}

export async function requireIngestUser(req: Request): Promise<AuthedUser | null> {
  const sessionUser = await requireUser(req);
  if (sessionUser) {
    return sessionUser;
  }

  const token = req.headers.get("x-internal-ingest-token");
  const userId = req.headers.get("x-recall-user-id");
  if (token && userId && env.INTERNAL_INGEST_TOKEN && token === env.INTERNAL_INGEST_TOKEN) {
    // Verify the userId actually exists to prevent privilege escalation if the token leaks.
    const result = await db.query("SELECT id FROM users WHERE id = $1", [userId]);
    if ((result.rowCount ?? 0) === 0) {
      return null;
    }
    return { id: userId, authType: "internal" };
  }

  return null;
}
