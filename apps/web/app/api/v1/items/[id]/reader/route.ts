import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { hasReaderText } from "@/lib/reader-state";
import { requireUser } from "@/lib/request-auth";
import { getFileBuffer } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(req);
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const { id } = await params;
  const item = await db.query<{
    id: string;
    title: string | null;
    summary: string | null;
    raw_url: string | null;
    raw_text: string | null;
    reading_progress: number;
    reading_state: string;
    reader_position: string | null;
    is_favorite: boolean;
    is_archived: boolean;
    is_read_later: boolean;
  }>(
    `SELECT id,
            title,
            summary,
            raw_url,
            raw_text,
            reading_progress,
            reading_state,
            reader_position,
            is_favorite,
            is_archived,
            is_read_later
     FROM items
     WHERE id = $1 AND user_id = $2`,
    [id, user.id],
  );

  const row = item.rows[0];
  if (!row) {
    return apiError("Item not found", 404);
  }

  const asset = await db.query<{
    id: string;
    file_path: string | null;
    source_url: string | null;
    metadata: Record<string, unknown> | null;
    captured_at: string | null;
  }>(
    `SELECT id, file_path, source_url, metadata, captured_at
     FROM archive_assets
     WHERE item_id = $1
       AND user_id = $2
       AND kind = 'extracted_text'
       AND status = 'available'
       AND file_path IS NOT NULL
     ORDER BY captured_at DESC NULLS LAST, created_at DESC
     LIMIT 1`,
    [id, user.id],
  );

  let text: string | null = null;
  let source: "archive" | "item" | "summary" | "none" = "none";
  const textAsset = asset.rows[0];
  if (textAsset?.file_path) {
    try {
      const buffer = await getFileBuffer(textAsset.file_path);
      const archivedText = buffer.toString("utf8");
      if (hasReaderText(archivedText)) {
        text = archivedText;
        source = "archive";
      }
    } catch {
      text = null;
    }
  }

  if (!text && hasReaderText(row.raw_text)) {
    text = row.raw_text;
    source = "item";
  }

  if (!text && hasReaderText(row.summary)) {
    text = row.summary;
    source = "summary";
  }

  return apiOk({
    reader: {
      item_id: row.id,
      title: row.title,
      raw_url: row.raw_url,
      text,
      source,
      asset: textAsset
        ? {
            id: textAsset.id,
            source_url: textAsset.source_url,
            metadata: textAsset.metadata,
            captured_at: textAsset.captured_at,
          }
        : null,
      state: {
        reading_progress: row.reading_progress,
        reading_state: row.reading_state,
        reader_position: row.reader_position,
        is_favorite: row.is_favorite,
        is_archived: row.is_archived,
        is_read_later: row.is_read_later,
      },
    },
  });
}
