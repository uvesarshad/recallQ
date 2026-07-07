import { z } from "zod";
import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/request-auth";
import { MAX_QUERY_LENGTH } from "@/lib/search";

export const dynamic = "force-dynamic";

const savedSearchSchema = z.object({
  name: z.string().trim().min(1).max(100),
  query: z.string().trim().min(1).max(MAX_QUERY_LENGTH),
  mode: z.enum(["hybrid", "fulltext", "semantic"]).default("hybrid"),
});

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const result = await db.query(
    `SELECT id, name, query, mode, created_at, updated_at
     FROM smart_saved_searches
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [user.id],
  );

  return apiOk({ smartSearches: result.rows });
}

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const parsed = savedSearchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return apiError("Invalid saved search", 400, { details: parsed.error.issues });
  }

  try {
    const result = await db.query(
      `INSERT INTO smart_saved_searches (user_id, name, query, mode)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, query, mode, created_at, updated_at`,
      [user.id, parsed.data.name, parsed.data.query, parsed.data.mode],
    );

    return apiOk({ smartSearch: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("idx_smart_saved_searches_user_name")) {
      return apiError("A saved search with that name already exists", 409);
    }
    throw error;
  }
}
