import {
  TokenIssueInputSchema,
  type TokenIssueOutput,
  type TokenListResponse,
} from "@recall/api-schema";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { generateToken } from "@/lib/auth-tokens";
import { fail, ok, parseBody } from "@/lib/api-response";
import { requireSessionUser } from "@/lib/request-auth";

// POST /api/v1/auth/tokens — exchange email + password for a personal access
// token used by the Chrome extension and the mobile apps. The raw token is
// only ever returned here; clients must persist it immediately.
export async function POST(req: Request): Promise<Response> {
  const body = await parseBody(req, TokenIssueInputSchema);
  if (!body.ok) return body.response;

  const { email, password, device_name } = body.data;

  const userRes = await db.query<{ id: string; password_hash: string | null }>(
    `SELECT id, password_hash FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email],
  );
  const user = userRes.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    return fail("unauthorized", "Invalid email or password", 401);
  }

  const generated = generateToken();
  const insertRes = await db.query<{ id: string; created_at: Date }>(
    `INSERT INTO personal_access_tokens (user_id, device_name, token_hash, prefix)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [user.id, device_name, generated.hash, generated.prefix],
  );
  const row = insertRes.rows[0];

  const response: TokenIssueOutput = {
    token: generated.raw,
    id: row.id,
    prefix: generated.prefix,
    device_name,
    created_at: row.created_at.toISOString(),
  };
  return ok(response, { status: 201 });
}

// GET /api/v1/auth/tokens — list the current user's active tokens. Always
// authed via NextAuth session cookie (the Settings → Connected Devices page);
// not reachable from a bearer token to prevent stolen-token reconnaissance.
export async function GET(): Promise<Response> {
  const user = await requireSessionUser();
  if (!user) return fail("unauthorized", "Sign in required", 401);

  const res = await db.query<{
    id: string;
    device_name: string;
    prefix: string;
    last_used_at: Date | null;
    created_at: Date;
  }>(
    `SELECT id, device_name, prefix, last_used_at, created_at
       FROM personal_access_tokens
      WHERE user_id = $1 AND revoked_at IS NULL
      ORDER BY created_at DESC`,
    [user.id],
  );

  const response: TokenListResponse = {
    tokens: res.rows.map((r) => ({
      id: r.id,
      device_name: r.device_name,
      prefix: r.prefix,
      last_used_at: r.last_used_at?.toISOString() ?? null,
      created_at: r.created_at.toISOString(),
    })),
  };
  return ok(response);
}
