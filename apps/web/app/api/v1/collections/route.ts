import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { requireSessionUser } from "@/lib/request-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const collectionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.string().trim().max(20).optional(),
  icon: z.string().trim().max(50).optional(),
});

export async function GET() {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const result = await db.query(
    "SELECT * FROM collections WHERE user_id = $1 ORDER BY created_at DESC",
    [user.id]
  );

  // The folder list almost never changes during a session, but the Feed
  // reloads it on every render. Browser-private cache keeps the response out
  // of any shared/CDN cache (it's user-scoped) while still saving the
  // round-trip for 60s.
  return apiOk(
    { collections: result.rows },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}

export async function POST(req: Request) {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const data = collectionSchema.parse(await req.json());

  const result = await db.query(
    "INSERT INTO collections (user_id, name, color, icon) VALUES ($1, $2, $3, $4) RETURNING *",
    [user.id, data.name, data.color || null, data.icon || null]
  );

  return apiOk({ collection: result.rows[0] });
}
