// Fixed-window rate limit backed by the `rate_limits` Postgres table (no
// Redis, no extra infra — keeps Stage 5 deployable on the same EC2 box that
// runs the app and the DB). The atomic INSERT ... ON CONFLICT decides
// whether the request resets the window or bumps the counter, then returns
// the new count and we compare against the limit in app code.
//
// This is fixed-window, not true token bucket, which means a client can
// burst up to 2x the limit at the window boundary. For the buckets we use
// it on (login attempts, chat, ingest) that's fine — the limits are
// generous enough that the boundary burst doesn't meaningfully change the
// abuse cost. Migrate to sliding-window or true token bucket if/when we
// outgrow it.

import { db } from "@/lib/db";

type RateLimitParams = {
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  // Milliseconds until the current window resets. Use as Retry-After hint
  // when denying with 429.
  retryAfterMs: number;
};

export async function rateLimit(params: RateLimitParams): Promise<RateLimitResult> {
  const { key, limit, windowMs } = params;
  const intervalLit = `${Math.max(1, Math.ceil(windowMs / 1000))} seconds`;

  try {
    const result = await db.query<{ count: number; window_started_at: Date }>(
      `INSERT INTO rate_limits (bucket_key, count, window_started_at)
       VALUES ($1, 1, now())
       ON CONFLICT (bucket_key) DO UPDATE
         SET count = CASE
               WHEN rate_limits.window_started_at < now() - ($2)::interval THEN 1
               ELSE rate_limits.count + 1
             END,
             window_started_at = CASE
               WHEN rate_limits.window_started_at < now() - ($2)::interval THEN now()
               ELSE rate_limits.window_started_at
             END
       RETURNING count, window_started_at`,
      [key, intervalLit],
    );

    const row = result.rows[0];
    const windowEndsAt = row.window_started_at.getTime() + windowMs;
    return {
      allowed: row.count <= limit,
      remaining: Math.max(0, limit - row.count),
      retryAfterMs: Math.max(0, windowEndsAt - Date.now()),
    };
  } catch {
    // Fail-open: a missing `rate_limits` table (migration 013 not yet
    // applied) or a transient DB error must not 500 every authed request.
    // The route is still protected by its other guards (auth, Zod, plan
    // limit), and the next request can attempt to rate-limit again.
    return { allowed: true, remaining: limit, retryAfterMs: 0 };
  }
}

// Best-effort client IP extraction. Trusts nginx's `X-Forwarded-For` (which
// CloudPanel sets); falls back to `X-Real-IP`. Use the result only for rate
// limiting, never for trust decisions.
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
