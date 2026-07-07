import { apiError, apiOk } from "@/lib/api";
import { requestPageArchive } from "@/lib/archive-assets";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/request-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const linkReviewSchema = z.object({
  action: z.enum(["retry", "archive", "false_positive", "resolved"]),
  note: z.string().trim().max(500).nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(req);
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const parsed = linkReviewSchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError("Invalid link review action", 400);
  }

  const { id } = await params;
  const item = await db.query<{ id: string; raw_url: string | null; type: string }>(
    "SELECT id, raw_url, type FROM items WHERE id = $1 AND user_id = $2",
    [id, user.id],
  );
  if (item.rowCount === 0) {
    return apiError("Item not found", 404);
  }

  const { action, note } = parsed.data;
  if (action === "false_positive" || action === "resolved") {
    const status = action === "false_positive" ? "false_positive" : "resolved";
    const result = await db.query(
      `UPDATE items
       SET link_broken = FALSE,
           link_failure_reason = NULL,
           link_review_status = $3,
           link_reviewed_at = NOW(),
           link_review_note = $4,
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id,
                 link_broken,
                 link_review_status,
                 link_reviewed_at,
                 link_review_note`,
      [id, user.id, status, note ?? null],
    );
    return apiOk({ item: result.rows[0] });
  }

  const archiveResult = await requestPageArchive({ userId: user.id, itemId: id });
  if (archiveResult.error === "not_url") {
    return apiError("Only URL items can be checked", 400);
  }
  if (archiveResult.error === "not_found") {
    return apiError("Item not found", 404);
  }

  await db.query(
    `UPDATE items
     SET link_review_status = 'retrying',
         link_reviewed_at = NOW(),
         link_review_note = $3,
         updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [id, user.id, note ?? null],
  );

  return apiOk({
    success: true,
    archive_status: "pending",
    link_review_status: "retrying",
    job_id: archiveResult.jobId,
  });
}
