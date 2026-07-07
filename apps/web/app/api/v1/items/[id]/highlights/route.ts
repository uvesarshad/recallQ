import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { normalizeHighlightColor, normalizeHighlightQuote } from "@/lib/reader-state";
import { requireUser } from "@/lib/request-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const highlightSchema = z.object({
  quote: z.string().trim().min(1).max(2000),
  note: z.string().trim().max(1000).nullable().optional(),
  color: z.string().trim().max(20).optional(),
  range_start: z.number().int().min(0).nullable().optional(),
  range_end: z.number().int().min(0).nullable().optional(),
});

async function ensureOwnedItem(itemId: string, userId: string) {
  const item = await db.query("SELECT id FROM items WHERE id = $1 AND user_id = $2", [itemId, userId]);
  return (item.rowCount ?? 0) > 0;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(req);
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const { id } = await params;
  if (!(await ensureOwnedItem(id, user.id))) {
    return apiError("Item not found", 404);
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const paramsList: unknown[] = [id, user.id];
  const conditions = ["item_id = $1", "user_id = $2"];
  if (q) {
    paramsList.push(q);
    conditions.push(`to_tsvector('english', quote || ' ' || COALESCE(note, '')) @@ websearch_to_tsquery('english', $${paramsList.length})`);
  }

  const highlights = await db.query(
    `SELECT id,
            item_id,
            quote,
            note,
            color,
            range_start,
            range_end,
            created_at,
            updated_at
     FROM item_highlights
     WHERE ${conditions.join(" AND ")}
     ORDER BY created_at DESC`,
    paramsList,
  );

  return apiOk({ highlights: highlights.rows });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(req);
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const parsed = highlightSchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError("Invalid highlight", 400);
  }

  const { id } = await params;
  if (!(await ensureOwnedItem(id, user.id))) {
    return apiError("Item not found", 404);
  }

  const data = parsed.data;
  if (
    data.range_start !== undefined &&
    data.range_start !== null &&
    data.range_end !== undefined &&
    data.range_end !== null &&
    data.range_end < data.range_start
  ) {
    return apiError("Invalid highlight range", 400);
  }

  const result = await db.query(
    `INSERT INTO item_highlights (
       user_id, item_id, quote, note, color, range_start, range_end
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id,
               item_id,
               quote,
               note,
               color,
               range_start,
               range_end,
               created_at,
               updated_at`,
    [
      user.id,
      id,
      normalizeHighlightQuote(data.quote),
      data.note ?? null,
      normalizeHighlightColor(data.color),
      data.range_start ?? null,
      data.range_end ?? null,
    ],
  );

  return apiOk({ highlight: result.rows[0] }, { status: 201 });
}
