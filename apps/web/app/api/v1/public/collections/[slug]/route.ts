import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const collectionResult = await db.query(
    `SELECT id, name, color, icon, public_updated_at
     FROM collections
     WHERE public_enabled = TRUE AND public_slug = $1`,
    [slug],
  );
  const collection = collectionResult.rows[0];
  if (!collection) return apiError("Public collection not found", 404);

  const items = await db.query(
    `SELECT id, type, title, summary, tags, raw_url, image_url, created_at, updated_at
     FROM items
     WHERE collection_id = $1
       AND COALESCE(is_archived, FALSE) = FALSE
     ORDER BY created_at DESC
     LIMIT 100`,
    [collection.id],
  );

  return apiOk({
    collection: {
      name: collection.name,
      color: collection.color,
      icon: collection.icon,
      updated_at: collection.public_updated_at,
    },
    items: items.rows,
  });
}
