import { randomBytes } from "crypto";
import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/request-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const shareSchema = z.object({
  enabled: z.boolean(),
  regenerate: z.boolean().optional().default(false),
});

function newSlug() {
  return randomBytes(12).toString("base64url");
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(req);
  if (!user) return apiError("Unauthorized", 401);

  const parsed = shareSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("Invalid share settings", 400);
  const { id } = await params;

  const existing = await db.query<{ public_slug: string | null }>(
    "SELECT public_slug FROM collections WHERE id = $1 AND user_id = $2",
    [id, user.id],
  );
  if (existing.rowCount === 0) return apiError("Collection not found", 404);

  const slug =
    parsed.data.enabled && (parsed.data.regenerate || !existing.rows[0].public_slug)
      ? newSlug()
      : existing.rows[0].public_slug;

  const result = await db.query(
    `UPDATE collections
     SET public_enabled = $1,
         public_slug = CASE WHEN $1 THEN $2 ELSE public_slug END,
         public_updated_at = CASE WHEN $1 THEN NOW() ELSE public_updated_at END
     WHERE id = $3 AND user_id = $4
     RETURNING id, name, public_enabled, public_slug, public_updated_at`,
    [parsed.data.enabled, slug, id, user.id],
  );

  return apiOk({
    collection: result.rows[0],
    public_url: result.rows[0].public_enabled
      ? `/api/v1/public/collections/${result.rows[0].public_slug}`
      : null,
  });
}
