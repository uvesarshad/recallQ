import { apiError } from "@/lib/api";
import { db } from "@/lib/db";
import { ingestItem } from "@/lib/ingest";
import {
  browserBookmarksToImportRecords,
  buildJsonExportPayload,
  buildNetscapeBookmarksHtml,
  parseCsvImport,
  parseLinkwardenExport,
  parseNetscapeBookmarksHtml,
  parseOmnivoreExport,
  parsePocketExport,
  type BookmarkExportItem,
  type ImportSource,
  type ParsedImportRecord,
} from "@/lib/import-export";

const IMPORT_OPTIONS = {
  folderMapping: "ancestor folders joined as collection path with ' / '",
  tagMapping: "Netscape TAGS attribute",
  duplicateStrategy: "skip exact URL matches already owned by user or repeated in this import",
};

type ImportCounters = {
  processed: number;
  imported: number;
  duplicate: number;
  failed: number;
  errors: Array<{ source_url?: string; error: string }>;
};

type ExternalImportInput = {
  userId: string;
  source: ImportSource;
  records: ParsedImportRecord[];
  fileName?: string | null;
  dryRun?: boolean;
  options?: Record<string, unknown>;
};

export async function importBrowserBookmarksHtml(input: {
  userId: string;
  html: string;
  fileName?: string | null;
  dryRun?: boolean;
}) {
  const bookmarks = parseNetscapeBookmarksHtml(input.html);
  return importExternalRecords({
    userId: input.userId,
    source: "browser_html",
    records: browserBookmarksToImportRecords(bookmarks),
    fileName: input.fileName,
    dryRun: input.dryRun,
    options: IMPORT_OPTIONS,
  });
}

export async function importPocketExport(input: {
  userId: string;
  content: string;
  fileName?: string | null;
  dryRun?: boolean;
}) {
  return importExternalRecords({
    userId: input.userId,
    source: "pocket",
    records: parsePocketExport(input.content),
    fileName: input.fileName,
    dryRun: input.dryRun,
    options: {
      tagMapping: "Pocket tags",
      duplicateStrategy: IMPORT_OPTIONS.duplicateStrategy,
    },
  });
}

export async function importOmnivoreExport(input: {
  userId: string;
  content: string;
  fileName?: string | null;
  dryRun?: boolean;
}) {
  return importExternalRecords({
    userId: input.userId,
    source: "omnivore",
    records: parseOmnivoreExport(input.content),
    fileName: input.fileName,
    dryRun: input.dryRun,
    options: {
      folderMapping: "Omnivore state/folder/collection fields",
      tagMapping: "Omnivore labels",
      duplicateStrategy: IMPORT_OPTIONS.duplicateStrategy,
    },
  });
}

export async function importLinkwardenExport(input: {
  userId: string;
  content: string;
  fileName?: string | null;
  dryRun?: boolean;
}) {
  return importExternalRecords({
    userId: input.userId,
    source: "linkwarden",
    records: parseLinkwardenExport(input.content),
    fileName: input.fileName,
    dryRun: input.dryRun,
    options: {
      folderMapping: "Linkwarden collection name",
      tagMapping: "Linkwarden tags",
      duplicateStrategy: IMPORT_OPTIONS.duplicateStrategy,
    },
  });
}

export async function importCsvExport(input: {
  userId: string;
  content: string;
  fileName?: string | null;
  dryRun?: boolean;
}) {
  return importExternalRecords({
    userId: input.userId,
    source: "csv",
    records: parseCsvImport(input.content),
    fileName: input.fileName,
    dryRun: input.dryRun,
    options: {
      columnMapping: "url/title/tags/folder/note/created_at aliases",
      duplicateStrategy: IMPORT_OPTIONS.duplicateStrategy,
    },
  });
}

export async function importExternalRecords(input: ExternalImportInput) {
  const session = await db.query(
    `INSERT INTO import_sessions (
       user_id, source, status, file_name, total_count, options, started_at
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
     RETURNING *`,
    [
      input.userId,
      input.source,
      input.dryRun ? "previewing" : "importing",
      input.fileName ?? null,
      input.records.length,
      JSON.stringify({
        ...(input.options ?? {}),
        dryRun: input.dryRun === true,
      }),
    ],
  );
  const sessionId = session.rows[0].id as string;
  const counters: ImportCounters = {
    processed: 0,
    imported: 0,
    duplicate: 0,
    failed: 0,
    errors: [],
  };

  try {
    const urls = Array.from(new Set(input.records.map((record) => record.url)));
    const existing = urls.length > 0
      ? await db.query<{ id: string; raw_url: string }>(
          "SELECT id, raw_url FROM items WHERE user_id = $1 AND type = 'url' AND raw_url = ANY($2::text[])",
          [input.userId, urls],
        )
      : { rows: [] };

    const existingUrls = new Set(existing.rows.map((row) => row.raw_url));
    const seenUrls = new Set<string>();

    for (const [index, record] of input.records.entries()) {
      if (existingUrls.has(record.url) || seenUrls.has(record.url)) {
        counters.duplicate++;
        counters.processed++;
        await recordImportItem({
          sessionId,
          sourceId: record.sourceId || String(index + 1),
          sourceUrl: record.url,
          status: "duplicate",
        });
        await updateImportSession(sessionId, counters, input.dryRun ? "previewing" : "importing");
        continue;
      }

      if (input.dryRun) {
        counters.processed++;
        await recordImportItem({
          sessionId,
          sourceId: record.sourceId || String(index + 1),
          sourceUrl: record.url,
          status: "skipped",
        });
        await updateImportSession(sessionId, counters, "previewing");
        continue;
      }

      const result = await ingestItem({
        userId: input.userId,
        type: "url",
        raw_url: record.url,
        title: record.title,
        tags: record.tags,
        capture_note: record.note ?? undefined,
        source: "manual",
        automationEvent: "import",
        actionOverrides: {
          tags: record.tags,
          categoryName: record.collectionName,
        },
      });

      counters.processed++;
      if (result.error || !result.success) {
        const error = result.error ?? "import_failed";
        counters.failed++;
        counters.errors.push({ source_url: record.url, error });
        await recordImportItem({
          sessionId,
          sourceId: record.sourceId || String(index + 1),
          sourceUrl: record.url,
          status: "failed",
          error,
        });
      } else {
        counters.imported++;
        seenUrls.add(record.url);
        await recordImportItem({
          sessionId,
          itemId: result.id,
          sourceId: record.sourceId || String(index + 1),
          sourceUrl: record.url,
          status: "imported",
        });
      }

      await updateImportSession(sessionId, counters, input.dryRun ? "previewing" : "importing");
    }

    const status = input.dryRun ? "previewing" : "succeeded";
    const finalSession = await updateImportSession(sessionId, counters, status, true);
    return {
      session: finalSession,
      mapping: input.options ?? IMPORT_OPTIONS,
      preview: input.dryRun
        ? input.records.slice(0, 50).map(({ sourceId, url, title, collectionName, tags }) => ({
            sourceId,
            url,
            title,
            collectionName,
            tags,
            duplicate: existingUrls.has(url),
          }))
        : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected import failure";
    counters.errors.push({ error: message });
    const finalSession = await updateImportSession(sessionId, counters, "failed", true, message);
    return {
      session: finalSession,
      mapping: IMPORT_OPTIONS,
    };
  }
}

export async function getImportSession(userId: string, sessionId: string) {
  const session = await db.query(
    "SELECT * FROM import_sessions WHERE id = $1 AND user_id = $2",
    [sessionId, userId],
  );
  if (session.rowCount === 0) return null;

  const items = await db.query(
    `SELECT *
     FROM import_session_items
     WHERE import_session_id = $1
     ORDER BY created_at ASC`,
    [sessionId],
  );

  return {
    ...session.rows[0],
    items: items.rows,
  };
}

export async function buildUserJsonExport(userId: string) {
  const [items, collections, reminders, archiveAssets] = await Promise.all([
    db.query(
      `SELECT id, type, title, summary, tags, source, created_at, updated_at,
              raw_url, raw_text, collection_id, reminder_at, reminder_sent,
              file_path, file_name, file_mime_type, capture_note, image_url,
              blur_data_url, enriched, enriched_at, canvas_x, canvas_y, canvas_pinned
       FROM items
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId],
    ),
    db.query(
      "SELECT id, name, color, icon, created_at FROM collections WHERE user_id = $1 ORDER BY created_at ASC",
      [userId],
    ),
    db.query(
      `SELECT id, item_id, remind_at, channels, sent, sent_at, created_at
       FROM reminders
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId],
    ),
    db.query(
      `SELECT id, item_id, kind, status, file_path, content_type, byte_size,
              content_hash, source_url, metadata, error, captured_at, created_at, updated_at
       FROM archive_assets
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId],
    ),
  ]);

  return buildJsonExportPayload({
    items: items.rows,
    collections: collections.rows,
    reminders: reminders.rows,
    archiveAssets: archiveAssets.rows,
  });
}

export async function buildUserBookmarksExport(userId: string) {
  const result = await db.query<BookmarkExportItem>(
    `SELECT i.raw_url AS "url",
            i.title AS "title",
            i.tags AS "tags",
            c.name AS "collectionName",
            i.created_at AS "createdAt"
     FROM items i
     LEFT JOIN collections c ON c.id = i.collection_id
     WHERE i.user_id = $1 AND i.type = 'url' AND i.raw_url IS NOT NULL
     ORDER BY c.name ASC NULLS FIRST, i.created_at ASC`,
    [userId],
  );

  return buildNetscapeBookmarksHtml(result.rows);
}

export function exportFilename(extension: "json" | "html") {
  const date = new Date().toISOString().slice(0, 10);
  return `recallq-export-${date}.${extension}`;
}

export function importPayloadTooLarge() {
  return apiError("Import file must be 15 MB or smaller", 413);
}

async function recordImportItem(input: {
  sessionId: string;
  itemId?: string | null;
  sourceId?: string | null;
  sourceUrl: string;
  status: "imported" | "duplicate" | "failed" | "skipped";
  error?: string | null;
}) {
  await db.query(
    `INSERT INTO import_session_items (
       import_session_id, item_id, source_id, source_url, status, error
     )
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.sessionId,
      input.itemId ?? null,
      input.sourceId ?? null,
      input.sourceUrl,
      input.status,
      input.error ?? null,
    ],
  );
}

async function updateImportSession(
  sessionId: string,
  counters: ImportCounters,
  status: "previewing" | "importing" | "succeeded" | "failed",
  finished = false,
  errorSummary?: string,
) {
  const result = await db.query(
    `UPDATE import_sessions
     SET status = $2,
         processed_count = $3,
         imported_count = $4,
         duplicate_count = $5,
         failed_count = $6,
         errors = $7::jsonb,
         error_summary = $8,
         finished_at = CASE WHEN $9 THEN NOW() ELSE finished_at END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      sessionId,
      status,
      counters.processed,
      counters.imported,
      counters.duplicate,
      counters.failed,
      JSON.stringify(counters.errors.slice(0, 100)),
      errorSummary ?? (counters.errors[0]?.error ?? null),
      finished,
    ],
  );

  return result.rows[0];
}
