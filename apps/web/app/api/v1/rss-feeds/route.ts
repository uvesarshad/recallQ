import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { enqueueJob } from "@/lib/jobs";
import { requireUser } from "@/lib/request-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createFeedSchema = z.object({
  url: z.string().url(),
  title: z.string().trim().max(200).nullable().optional(),
  collection_id: z.string().uuid().nullable().optional(),
  poll_interval_minutes: z.number().int().min(15).max(24 * 60).optional(),
});

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return apiError("Unauthorized", 401);

  const result = await db.query(
    `SELECT id, url, title, collection_id, enabled, poll_interval_minutes,
            last_fetched_at, last_success_at, last_error, next_fetch_at,
            created_at, updated_at
     FROM rss_feeds
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [user.id],
  );

  return apiOk({ feeds: result.rows });
}

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return apiError("Unauthorized", 401);

  const parsed = createFeedSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("Invalid RSS feed request", 400);

  if (parsed.data.collection_id) {
    const collection = await db.query("SELECT id FROM collections WHERE id = $1 AND user_id = $2", [
      parsed.data.collection_id,
      user.id,
    ]);
    if (collection.rowCount === 0) return apiError("Collection not found", 404);
  }

  const result = await db.query<{ id: string }>(
    `INSERT INTO rss_feeds (user_id, url, title, collection_id, poll_interval_minutes)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, url) DO UPDATE
     SET title = COALESCE(EXCLUDED.title, rss_feeds.title),
         collection_id = EXCLUDED.collection_id,
         poll_interval_minutes = EXCLUDED.poll_interval_minutes,
         enabled = TRUE,
         updated_at = NOW()
     RETURNING id`,
    [
      user.id,
      parsed.data.url,
      parsed.data.title ?? null,
      parsed.data.collection_id ?? null,
      parsed.data.poll_interval_minutes ?? 60,
    ],
  );

  const feedId = result.rows[0].id;
  await enqueueJob({ type: "import", userId: user.id, payload: { kind: "rss_feed", feedId } });

  return apiOk({ id: feedId, queued: true });
}
