import { apiError, apiOk } from "@/lib/api";
import { applyCommentActions } from "@/lib/comment-actions";
import { db } from "@/lib/db";
import { requireSessionUser } from "@/lib/request-auth";
import { actionOverrideSchema } from "@/lib/validation";
import { z } from "zod";

export const dynamic = "force-dynamic";

const commentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  actionOverrides: actionOverrideSchema.optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const { id } = await params;
  const itemCheck = await db.query("SELECT id FROM items WHERE id = $1 AND user_id = $2", [id, user.id]);
  if (!itemCheck.rowCount) {
    return apiError("Item not found", 404);
  }

  const result = await db.query(
    `SELECT id, body, created_at
     FROM item_comments
     WHERE item_id = $1 AND user_id = $2
     ORDER BY created_at DESC`,
    [id, user.id],
  );

  return apiOk({ comments: result.rows });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const { id } = await params;
  const itemCheck = await db.query("SELECT id FROM items WHERE id = $1 AND user_id = $2", [id, user.id]);
  if (!itemCheck.rowCount) {
    return apiError("Item not found", 404);
  }

  const body = commentSchema.parse(await req.json());
  const inserted = await db.query(
    `INSERT INTO item_comments (item_id, user_id, body)
     VALUES ($1, $2, $3)
      RETURNING id, body, created_at`,
    [id, user.id, body.body],
  );
  const applied = await applyCommentActions({
    itemId: id,
    userId: user.id,
    body: body.body,
    overrides: body.actionOverrides,
  });

  return apiOk({ comment: inserted.rows[0], applied });
}
