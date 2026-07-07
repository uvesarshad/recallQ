import { apiError, apiOk } from "@/lib/api";
import { ARCHIVE_ASSET_KINDS, requestPageArchive } from "@/lib/archive-assets";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/request-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const archiveRequestSchema = z.object({
  asset_kinds: z.array(z.enum(ARCHIVE_ASSET_KINDS)).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(req);
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const { id } = await params;
  const item = await db.query(
    `SELECT id,
            type,
            raw_url,
            archive_requested_at,
            archive_status,
            archive_last_error,
            archive_last_attempt_at,
            link_last_checked_at,
            link_http_status,
            link_broken,
            link_failure_reason
     FROM items
     WHERE id = $1 AND user_id = $2`,
    [id, user.id],
  );

  if (item.rowCount === 0) {
    return apiError("Item not found", 404);
  }

  const [assets, jobs] = await Promise.all([
    db.query(
      `SELECT id,
              kind,
              status,
              content_type,
              byte_size,
              content_hash,
              source_url,
              metadata,
              error,
              captured_at,
              created_at,
              updated_at
       FROM archive_assets
       WHERE item_id = $1 AND user_id = $2
       ORDER BY created_at DESC`,
      [id, user.id],
    ),
    db.query(
      `SELECT id,
              status,
              attempt_count,
              max_attempts,
              last_error,
              run_after,
              created_at,
              updated_at
       FROM jobs
       WHERE item_id = $1 AND user_id = $2 AND type = 'archive'
       ORDER BY created_at DESC
       LIMIT 5`,
      [id, user.id],
    ),
  ]);

  return apiOk({
    item: item.rows[0],
    assets: assets.rows,
    jobs: jobs.rows,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(req);
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const { id } = await params;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = archiveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid archive request", 400);
  }

  const result = await requestPageArchive({
    userId: user.id,
    itemId: id,
    assetKinds: parsed.data.asset_kinds,
  });

  if (result.error === "not_found") {
    return apiError("Item not found", 404);
  }
  if (result.error === "not_url") {
    return apiError("Only URL items can be archived", 400);
  }

  return apiOk({
    success: true,
    archive_status: "pending",
    job_id: result.jobId,
    asset_kinds: parsed.data.asset_kinds ?? ["html"],
  });
}
