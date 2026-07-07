import { createHash } from "crypto";
import type { QueryResultRow } from "pg";
import {
  archiveMetadataFromResponse,
  isBrokenLinkStatus,
  sanitizeHtmlSnapshot,
} from "./archive-html.ts";
import { assertPublicFetchUrl } from "./url-safety.ts";

export const ARCHIVE_JOB_BATCH_SIZE = 2;
export const ARCHIVE_MAX_ATTEMPTS = 3;
export const ARCHIVE_STALE_LOCK_SECONDS = 20 * 60;
export const ARCHIVE_RETRY_BASE_SECONDS = 2 * 60;
export const ARCHIVE_RETRY_MAX_SECONDS = 60 * 60;
export const ARCHIVE_HTML_MAX_BYTES = 2 * 1024 * 1024;
export const ARCHIVE_ERROR_MAX_LENGTH = 1000;
export const ARCHIVE_DEFAULT_RETENTION_DAYS = 365;
export const ARCHIVE_FAILED_RETENTION_DAYS = 30;
export const ARCHIVE_VISUAL_TIMEOUT_MS = 15_000;
export const ARCHIVE_SCREENSHOT_MAX_BYTES = 8 * 1024 * 1024;
export const ARCHIVE_PDF_MAX_BYTES = 12 * 1024 * 1024;

export const ARCHIVE_ASSET_KINDS = [
  "html",
  "screenshot",
  "pdf",
  "video",
] as const;

export type RequestedArchiveAssetKind = (typeof ARCHIVE_ASSET_KINDS)[number];
type StoredArchiveAssetKind =
  | "html"
  | "screenshot"
  | "pdf"
  | "video"
  | "original_file"
  | "extracted_text"
  | "thumbnail";

type ArchiveDbResult<T extends QueryResultRow> = {
  rows: T[];
  rowCount?: number | null;
};

export type ArchiveDb = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<ArchiveDbResult<T>>;
};

export type ArchiveJob = QueryResultRow & {
  id: string;
  user_id: string;
  item_id: string;
  payload: {
    kind?: string;
    source_url?: string;
    requested_at?: string;
    asset_kinds?: unknown;
  } | null;
  attempt_count: number;
  max_attempts: number;
};

export type PageArchiveResult = {
  htmlAssetId: string;
  textAssetId: string;
  contentHash: string;
  canonicalUrl: string | null;
  finalUrl: string;
  httpStatus: number;
  htmlBytes: number;
  textBytes: number;
  requestedAssetKinds: RequestedArchiveAssetKind[];
};

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

async function getDb() {
  return (await import("./db.ts")).db;
}

async function getStorage() {
  return import("./storage.ts");
}

async function getSafeFetch() {
  return (await import("./url-safety.ts")).safeFetch;
}

function truncateError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, ARCHIVE_ERROR_MAX_LENGTH);
}

function sha256Hex(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function daysFromNow(days: number, from = new Date()) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export function retentionExpiresAt(days = ARCHIVE_DEFAULT_RETENTION_DAYS, from = new Date()) {
  return daysFromNow(days, from).toISOString();
}

export function failedAssetRetentionExpiresAt(from = new Date()) {
  return daysFromNow(ARCHIVE_FAILED_RETENTION_DAYS, from).toISOString();
}

export function normalizeArchiveAssetKinds(input: unknown): RequestedArchiveAssetKind[] {
  if (!Array.isArray(input)) {
    return ["html"];
  }

  const seen = new Set<RequestedArchiveAssetKind>();
  for (const value of input) {
    if (ARCHIVE_ASSET_KINDS.includes(value as RequestedArchiveAssetKind)) {
      seen.add(value as RequestedArchiveAssetKind);
    }
  }

  return seen.size > 0 ? [...seen] : ["html"];
}

export function isArchiveAssetRetentionDue(args: {
  status: string;
  createdAt: string | Date;
  retentionExpiresAt?: string | Date | null;
  now?: Date;
}) {
  const now = args.now ?? new Date();
  if (args.status === "deleted") {
    return true;
  }

  if (args.retentionExpiresAt) {
    return new Date(args.retentionExpiresAt).getTime() <= now.getTime();
  }

  if (args.status === "failed") {
    const failedCutoff = daysFromNow(-ARCHIVE_FAILED_RETENTION_DAYS, now).getTime();
    return new Date(args.createdAt).getTime() <= failedCutoff;
  }

  return false;
}

export async function enqueuePageArchive(args: {
  db?: ArchiveDb;
  userId: string;
  itemId: string;
  sourceUrl: string;
  assetKinds?: RequestedArchiveAssetKind[];
}) {
  const queryable = args.db ?? (await getDb());
  const assetKinds = normalizeArchiveAssetKinds(args.assetKinds);
  const payload = {
    kind: "page_archive",
    source_url: args.sourceUrl,
    requested_at: new Date().toISOString(),
    asset_kinds: assetKinds,
  };

  const job = await queryable.query<{ id: string }>(
    `INSERT INTO jobs (user_id, item_id, type, status, priority, payload, max_attempts)
     VALUES ($1, $2, 'archive', 'pending', 20, $3::jsonb, $4)
     RETURNING id`,
    [args.userId, args.itemId, JSON.stringify(payload), ARCHIVE_MAX_ATTEMPTS],
  );

  for (const kind of assetKinds) {
    if (kind !== "html") {
      await upsertAssetStatus({
        db: queryable,
        userId: args.userId,
        itemId: args.itemId,
        kind,
        status: "pending",
        sourceUrl: args.sourceUrl,
        metadata: { requested_by: "page_archive" },
      });
    }
  }

  await queryable.query(
    `UPDATE items
     SET archive_requested_at = NOW(),
         archive_status = 'pending',
         archive_last_error = NULL,
         updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [args.itemId, args.userId],
  );

  return job.rows[0]?.id ?? null;
}

export async function requestPageArchive(args: {
  userId: string;
  itemId: string;
  assetKinds?: RequestedArchiveAssetKind[];
}) {
  const db = await getDb();
  const item = await db.query<{ id: string; raw_url: string | null; type: string }>(
    "SELECT id, raw_url, type FROM items WHERE id = $1 AND user_id = $2",
    [args.itemId, args.userId],
  );

  const row = item.rows[0];
  if (!row) {
    return { error: "not_found" as const };
  }
  if (row.type !== "url" || !row.raw_url) {
    return { error: "not_url" as const };
  }

  const jobId = await enqueuePageArchive({
    userId: args.userId,
    itemId: args.itemId,
    sourceUrl: row.raw_url,
    assetKinds: args.assetKinds,
  });

  return { success: true as const, jobId };
}

export async function claimArchiveJobs(
  queryable: ArchiveDb,
  workerId: string,
  batchSize = ARCHIVE_JOB_BATCH_SIZE,
) {
  const result = await queryable.query<ArchiveJob>(
    `WITH candidate_jobs AS (
       SELECT id
       FROM jobs
       WHERE type = 'archive'
         AND COALESCE(payload->>'kind', 'page_archive') = 'page_archive'
         AND attempt_count < max_attempts
         AND (
           (status IN ('pending', 'retrying') AND run_after <= NOW())
           OR (
             status = 'processing'
             AND (
               locked_at IS NULL
               OR locked_at <= NOW() - ($3 * INTERVAL '1 second')
             )
           )
         )
       ORDER BY priority DESC, run_after ASC, created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE jobs
     SET status = 'processing',
         locked_by = $2,
         locked_at = NOW(),
         updated_at = NOW()
     FROM candidate_jobs
     WHERE jobs.id = candidate_jobs.id
     RETURNING jobs.id,
               jobs.user_id,
               jobs.item_id,
               jobs.payload,
               jobs.attempt_count,
               jobs.max_attempts`,
    [batchSize, workerId, ARCHIVE_STALE_LOCK_SECONDS],
  );

  return result.rows;
}

async function writeAsset(args: {
  userId: string;
  itemId: string;
  kind: StoredArchiveAssetKind;
  filename: string;
  contentType: string;
  bytes: Buffer;
  contentHash: string;
  sourceUrl: string;
  metadata: Record<string, unknown>;
}) {
  const db = await getDb();
  const { saveFile, removeStoredFile } = await getStorage();
  const existing = await db.query<{ id: string }>(
    `SELECT id
     FROM archive_assets
     WHERE item_id = $1 AND kind = $2 AND content_hash = $3
     LIMIT 1`,
    [args.itemId, args.kind, args.contentHash],
  );

  if (existing.rows[0]) {
    await db.query(
      `UPDATE archive_assets
       SET status = 'available',
           retention_expires_at = COALESCE(retention_expires_at, $3::timestamptz),
           metadata = $2::jsonb,
           error = NULL,
           captured_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [existing.rows[0].id, JSON.stringify(args.metadata), retentionExpiresAt()],
    );
    return { id: existing.rows[0].id, storedBytes: 0 };
  }

  const filePath = await saveFile(args.userId, args.itemId, args.filename, args.bytes);
  let inserted: { rows: Array<{ id: string }> };
  try {
    const placeholder = await db.query<{ id: string }>(
      `SELECT id
       FROM archive_assets
       WHERE user_id = $1
         AND item_id = $2
         AND kind = $3
         AND file_path IS NULL
         AND status IN ('pending', 'failed')
       ORDER BY created_at DESC
       LIMIT 1`,
      [args.userId, args.itemId, args.kind],
    );

    if (placeholder.rows[0]) {
      inserted = await db.query<{ id: string }>(
        `UPDATE archive_assets
         SET status = 'available',
             file_path = $2,
             content_type = $3,
             byte_size = $4,
             content_hash = $5,
             source_url = $6,
             metadata = $7::jsonb,
             error = NULL,
             captured_at = NOW(),
             retention_expires_at = $8::timestamptz,
             deleted_at = NULL,
             cleanup_reason = NULL,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id`,
        [
          placeholder.rows[0].id,
          filePath,
          args.contentType,
          args.bytes.length,
          args.contentHash,
          args.sourceUrl,
          JSON.stringify(args.metadata),
          retentionExpiresAt(),
        ],
      );
    } else {
      inserted = await db.query<{ id: string }>(
        `INSERT INTO archive_assets (
           user_id, item_id, kind, status, file_path, content_type, byte_size,
           content_hash, source_url, metadata, captured_at, retention_expires_at
         )
         VALUES ($1, $2, $3, 'available', $4, $5, $6, $7, $8, $9::jsonb, NOW(), $10::timestamptz)
         RETURNING id`,
        [
          args.userId,
          args.itemId,
          args.kind,
          filePath,
          args.contentType,
          args.bytes.length,
          args.contentHash,
          args.sourceUrl,
          JSON.stringify(args.metadata),
          retentionExpiresAt(),
        ],
      );
    }
  } catch (error) {
    await removeStoredFile(filePath).catch(() => undefined);
    throw error;
  }

  await db.query(
    "UPDATE users SET storage_used_bytes = storage_used_bytes + $1 WHERE id = $2",
    [args.bytes.length, args.userId],
  );

  return { id: inserted.rows[0].id, storedBytes: args.bytes.length };
}

async function upsertAssetStatus(args: {
  db?: ArchiveDb;
  userId: string;
  itemId: string;
  kind: StoredArchiveAssetKind;
  status: "pending" | "failed";
  sourceUrl?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const queryable = args.db ?? (await getDb());
  const existing = await queryable.query<{ id: string }>(
    `SELECT id
     FROM archive_assets
     WHERE user_id = $1
       AND item_id = $2
       AND kind = $3
       AND file_path IS NULL
       AND status IN ('pending', 'failed')
     ORDER BY created_at DESC
     LIMIT 1`,
    [args.userId, args.itemId, args.kind],
  );

  const metadata = JSON.stringify(args.metadata ?? {});
  if (existing.rows[0]) {
    await queryable.query(
      `UPDATE archive_assets
       SET status = $2,
           source_url = COALESCE($3, source_url),
           metadata = $4::jsonb,
           error = $5,
           retention_expires_at = CASE
             WHEN $2 = 'failed' THEN $6::timestamptz
             ELSE retention_expires_at
           END,
           updated_at = NOW()
       WHERE id = $1`,
      [
        existing.rows[0].id,
        args.status,
        args.sourceUrl ?? null,
        metadata,
        args.error ?? null,
        failedAssetRetentionExpiresAt(),
      ],
    );
    return existing.rows[0].id;
  }

  const inserted = await queryable.query<{ id: string }>(
    `INSERT INTO archive_assets (
       user_id, item_id, kind, status, source_url, metadata, error, retention_expires_at
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, CASE WHEN $4 = 'failed' THEN $8::timestamptz ELSE NULL END)
     RETURNING id`,
    [
      args.userId,
      args.itemId,
      args.kind,
      args.status,
      args.sourceUrl ?? null,
      metadata,
      args.error ?? null,
      failedAssetRetentionExpiresAt(),
    ],
  );

  return inserted.rows[0]?.id ?? null;
}

async function loadPlaywrightChromium() {
  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (
      specifier: string,
    ) => Promise<Record<string, unknown>>;
    const module = await dynamicImport("playwright");
    return module.chromium as
      | {
          launch(options: { headless: boolean }): Promise<{
            newPage(options: Record<string, unknown>): Promise<{
              route(pattern: string, handler: (route: unknown) => Promise<void>): Promise<void>;
              goto(url: string, options: Record<string, unknown>): Promise<unknown>;
              screenshot(options: Record<string, unknown>): Promise<Buffer | Uint8Array>;
              pdf?: (options: Record<string, unknown>) => Promise<Buffer | Uint8Array>;
            }>;
            close(): Promise<void>;
          }>;
        }
      | undefined;
  } catch {
    return null;
  }
}

async function captureVisualAssets(args: {
  userId: string;
  itemId: string;
  sourceUrl: string;
  assetKinds: RequestedArchiveAssetKind[];
}) {
  const requestedVisualKinds = args.assetKinds.filter(
    (kind) => kind === "screenshot" || kind === "pdf" || kind === "video",
  );
  if (requestedVisualKinds.length === 0) {
    return;
  }

  if (requestedVisualKinds.includes("video")) {
    await upsertAssetStatus({
      userId: args.userId,
      itemId: args.itemId,
      kind: "video",
      status: "failed",
      sourceUrl: args.sourceUrl,
      error: "Video archival is not enabled. This is an opt-in schema/job stub only.",
      metadata: { unsupported_reason: "heavy_downloader_not_configured" },
    });
  }

  const browserKinds = requestedVisualKinds.filter((kind) => kind === "screenshot" || kind === "pdf");
  if (browserKinds.length === 0) {
    return;
  }

  const chromium = await loadPlaywrightChromium();
  if (!chromium) {
    for (const kind of browserKinds) {
      await upsertAssetStatus({
        userId: args.userId,
        itemId: args.itemId,
        kind,
        status: "failed",
        sourceUrl: args.sourceUrl,
        error: "Playwright is not installed; screenshot/PDF archive capture is unsupported in this deployment.",
        metadata: { unsupported_reason: "playwright_not_installed" },
      });
    }
    return;
  }

  let browser: Awaited<ReturnType<NonNullable<typeof chromium>["launch"]>> | null = null;
  try {
    const safeUrl = (await assertPublicFetchUrl(args.sourceUrl)).toString();
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      javaScriptEnabled: false,
      viewport: { width: 1365, height: 900 },
    });

    await page.route("**/*", async (route: unknown) => {
      const candidate = route as {
        request(): { url(): string };
        continue(): Promise<void>;
        abort(): Promise<void>;
      };
      try {
        await assertPublicFetchUrl(candidate.request().url());
        await candidate.continue();
      } catch {
        await candidate.abort();
      }
    });

    await page.goto(safeUrl, {
      waitUntil: "domcontentloaded",
      timeout: ARCHIVE_VISUAL_TIMEOUT_MS,
    });

    if (browserKinds.includes("screenshot")) {
      const screenshot = Buffer.from(
        await page.screenshot({
          type: "png",
          fullPage: true,
          timeout: ARCHIVE_VISUAL_TIMEOUT_MS,
        }),
      );
      if (screenshot.length > ARCHIVE_SCREENSHOT_MAX_BYTES) {
        throw new Error("Archive screenshot exceeds the 8 MB limit");
      }
      const hash = sha256Hex(screenshot);
      await writeAsset({
        userId: args.userId,
        itemId: args.itemId,
        kind: "screenshot",
        filename: `archive-screenshot-${hash.slice(0, 16)}.png`,
        contentType: "image/png",
        bytes: screenshot,
        contentHash: hash,
        sourceUrl: args.sourceUrl,
        metadata: { source_url: args.sourceUrl, renderer: "playwright", viewport: "1365x900" },
      });
    }

    if (browserKinds.includes("pdf")) {
      if (!page.pdf) {
        throw new Error("The installed Playwright browser does not support PDF generation");
      }
      const pdf = Buffer.from(
        await page.pdf({
          format: "A4",
          printBackground: true,
          timeout: ARCHIVE_VISUAL_TIMEOUT_MS,
        }),
      );
      if (pdf.length > ARCHIVE_PDF_MAX_BYTES) {
        throw new Error("Archive PDF exceeds the 12 MB limit");
      }
      const hash = sha256Hex(pdf);
      await writeAsset({
        userId: args.userId,
        itemId: args.itemId,
        kind: "pdf",
        filename: `archive-pdf-${hash.slice(0, 16)}.pdf`,
        contentType: "application/pdf",
        bytes: pdf,
        contentHash: hash,
        sourceUrl: args.sourceUrl,
        metadata: { source_url: args.sourceUrl, renderer: "playwright", format: "A4" },
      });
    }
  } catch (error) {
    const message = truncateError(error);
    for (const kind of browserKinds) {
      await upsertAssetStatus({
        userId: args.userId,
        itemId: args.itemId,
        kind,
        status: "failed",
        sourceUrl: args.sourceUrl,
        error: message,
        metadata: { renderer: "playwright" },
      });
    }
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

export async function captureArchivedHtml(args: {
  userId: string;
  itemId: string;
  sourceUrl: string;
  fetcher?: Fetcher;
  assetKinds?: RequestedArchiveAssetKind[];
}) {
  const db = await getDb();
  const assetKinds = normalizeArchiveAssetKinds(args.assetKinds);
  const safeFetch = await getSafeFetch();
  const fetcher = args.fetcher ?? ((url: string, init?: RequestInit) => safeFetch(url, init));
  const response = await fetcher(args.sourceUrl, { signal: AbortSignal.timeout(10_000) });
  const finalUrl = response.url || args.sourceUrl;
  const contentType = response.headers.get("content-type") ?? "";

  await db.query(
    `UPDATE items
     SET link_last_checked_at = NOW(),
         link_http_status = $3,
         link_broken = $4,
         link_failure_reason = $5,
         archive_last_attempt_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [
      args.itemId,
      args.userId,
      response.status,
      isBrokenLinkStatus(response.status),
      response.ok ? null : response.statusText || `HTTP ${response.status}`,
    ],
  );

  if (!response.ok) {
    throw new Error(`Archive fetch failed with HTTP ${response.status}`);
  }

  if (contentType && !contentType.toLowerCase().includes("html")) {
    throw new Error(`Archive capture only supports HTML pages, got ${contentType}`);
  }

  const contentLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(contentLength) && contentLength > ARCHIVE_HTML_MAX_BYTES) {
    throw new Error("Archive HTML exceeds the 2 MB limit");
  }

  const htmlBuffer = Buffer.from(await response.arrayBuffer());
  if (htmlBuffer.length > ARCHIVE_HTML_MAX_BYTES) {
    throw new Error("Archive HTML exceeds the 2 MB limit");
  }

  const { sanitizedHtml, extractedText, canonicalUrl, title } = sanitizeHtmlSnapshot(
    htmlBuffer.toString("utf8"),
    finalUrl,
  );
  const htmlBytes = Buffer.from(sanitizedHtml, "utf8");
  const textBytes = Buffer.from(extractedText, "utf8");
  const contentHash = sha256Hex(htmlBytes);
  const textHash = sha256Hex(textBytes);
  const metadata = archiveMetadataFromResponse({
    response,
    sourceUrl: args.sourceUrl,
    finalUrl,
    canonicalUrl,
    title,
    contentHash,
  });

  const htmlAsset = await writeAsset({
    userId: args.userId,
    itemId: args.itemId,
    kind: "html",
    filename: `archive-html-${contentHash.slice(0, 16)}.html`,
    contentType: "text/html; charset=utf-8",
    bytes: htmlBytes,
    contentHash,
    sourceUrl: args.sourceUrl,
    metadata,
  });

  const textAsset = await writeAsset({
    userId: args.userId,
    itemId: args.itemId,
    kind: "extracted_text",
    filename: `archive-text-${textHash.slice(0, 16)}.txt`,
    contentType: "text/plain; charset=utf-8",
    bytes: textBytes,
    contentHash: textHash,
    sourceUrl: args.sourceUrl,
    metadata: {
      ...metadata,
      html_content_hash: contentHash,
    },
  });

  await captureVisualAssets({
    userId: args.userId,
    itemId: args.itemId,
    sourceUrl: args.sourceUrl,
    assetKinds,
  });

  await db.query(
    `UPDATE items
     SET archive_status = 'available',
         archive_last_error = NULL,
         archive_last_attempt_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [args.itemId, args.userId],
  );

  return {
    htmlAssetId: htmlAsset.id,
    textAssetId: textAsset.id,
    contentHash,
    canonicalUrl,
    finalUrl,
    httpStatus: response.status,
    htmlBytes: htmlBytes.length,
    textBytes: textBytes.length,
    requestedAssetKinds: assetKinds,
  } satisfies PageArchiveResult;
}

export async function processArchiveJob(job: ArchiveJob) {
  const db = await getDb();
  const item = await db.query<{ raw_url: string | null; user_id: string }>(
    "SELECT raw_url, user_id FROM items WHERE id = $1 AND user_id = $2",
    [job.item_id, job.user_id],
  );
  const row = item.rows[0];
  const sourceUrl = job.payload?.source_url ?? row?.raw_url;

  if (!row || !sourceUrl) {
    throw new Error("Archive item is missing or is not a URL item");
  }

  await db.query(
    `UPDATE items
     SET archive_status = 'processing',
         archive_last_attempt_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [job.item_id, job.user_id],
  );

  const result = await captureArchivedHtml({
    userId: job.user_id,
    itemId: job.item_id,
    sourceUrl,
    assetKinds: normalizeArchiveAssetKinds(job.payload?.asset_kinds),
  });

  await db.query(
    `UPDATE jobs
     SET status = 'succeeded',
         result = $2::jsonb,
         locked_by = NULL,
         locked_at = NULL,
         last_error = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [job.id, JSON.stringify(result)],
  );

  return result;
}

export async function markArchiveJobFailed(job: ArchiveJob, error: unknown) {
  const db = await getDb();
  const message = truncateError(error);
  const nextAttemptCount = Number(job.attempt_count) + 1;
  const terminal = nextAttemptCount >= Number(job.max_attempts);
  const delaySeconds = Math.min(
    ARCHIVE_RETRY_MAX_SECONDS,
    Math.pow(2, Math.min(nextAttemptCount, 10)) * ARCHIVE_RETRY_BASE_SECONDS,
  );

  await db.query(
    `UPDATE jobs
     SET attempt_count = attempt_count + 1,
         status = CASE WHEN attempt_count + 1 >= max_attempts THEN 'failed' ELSE 'retrying' END,
         run_after = CASE
           WHEN attempt_count + 1 >= max_attempts THEN run_after
           ELSE NOW() + ($3 * INTERVAL '1 second')
         END,
         locked_by = NULL,
         locked_at = NULL,
         last_error = $2,
         updated_at = NOW()
     WHERE id = $1`,
    [job.id, message, delaySeconds],
  );

  await db.query(
    `UPDATE items
     SET archive_status = $3,
         archive_last_error = $4,
         archive_last_attempt_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [job.item_id, job.user_id, terminal ? "failed" : "pending", message],
  );
}

export async function deleteArchiveAssetsForItems(userId: string, itemIds: string[]) {
  if (itemIds.length === 0) {
    return { deletedRows: 0, deletedBytes: 0 };
  }

  const db = await getDb();
  const { removeStoredFile } = await getStorage();
  const assets = await db.query<{
    id: string;
    file_path: string | null;
    byte_size: string | number;
  }>(
    `SELECT id, file_path, byte_size
     FROM archive_assets
     WHERE user_id = $1 AND item_id = ANY($2::uuid[])`,
    [userId, itemIds],
  );

  let deletedBytes = 0;
  for (const asset of assets.rows) {
    deletedBytes += Number(asset.byte_size ?? 0);
    if (asset.file_path) {
      await removeStoredFile(asset.file_path).catch(() => undefined);
    }
  }

  await db.query(
    "DELETE FROM archive_assets WHERE user_id = $1 AND item_id = ANY($2::uuid[])",
    [userId, itemIds],
  );

  if (deletedBytes > 0) {
    await db.query(
      "UPDATE users SET storage_used_bytes = GREATEST(0, storage_used_bytes - $1) WHERE id = $2",
      [deletedBytes, userId],
    );
  }

  return { deletedRows: assets.rows.length, deletedBytes };
}

export async function sweepArchiveRetention(args: {
  limit?: number;
  db?: ArchiveDb;
} = {}) {
  const queryable = args.db ?? (await getDb());
  const { removeStoredFile } = await getStorage();
  const limit = Math.min(Math.max(Math.trunc(args.limit ?? 100), 1), 1000);
  const assets = await queryable.query<{
    id: string;
    user_id: string;
    file_path: string | null;
    byte_size: string | number;
  }>(
    `WITH candidates AS (
       SELECT id
       FROM archive_assets
       WHERE status = 'deleted'
          OR (retention_expires_at IS NOT NULL AND retention_expires_at <= NOW())
          OR (status = 'failed' AND created_at <= NOW() - ($2 * INTERVAL '1 day'))
       ORDER BY COALESCE(retention_expires_at, deleted_at, created_at) ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE archive_assets
     SET status = 'deleted',
         deleted_at = COALESCE(deleted_at, NOW()),
         cleanup_reason = COALESCE(
           cleanup_reason,
           CASE
             WHEN retention_expires_at IS NOT NULL AND retention_expires_at <= NOW() THEN 'retention_expired'
             WHEN status = 'failed' THEN 'failed_asset_retention'
             ELSE 'deleted_asset_cleanup'
           END
         ),
         updated_at = NOW()
     FROM candidates
     WHERE archive_assets.id = candidates.id
     RETURNING archive_assets.id,
               archive_assets.user_id,
               archive_assets.file_path,
               archive_assets.byte_size`,
    [limit, ARCHIVE_FAILED_RETENTION_DAYS],
  );

  const bytesByUser = new Map<string, number>();
  for (const asset of assets.rows) {
    if (asset.file_path) {
      await removeStoredFile(asset.file_path).catch(() => undefined);
    }
    bytesByUser.set(
      asset.user_id,
      (bytesByUser.get(asset.user_id) ?? 0) + Number(asset.byte_size ?? 0),
    );
  }

  if (assets.rows.length > 0) {
    await queryable.query(
      "DELETE FROM archive_assets WHERE id = ANY($1::uuid[])",
      [assets.rows.map((asset) => asset.id)],
    );
  }

  for (const [userId, bytes] of bytesByUser) {
    if (bytes > 0) {
      await queryable.query(
        "UPDATE users SET storage_used_bytes = GREATEST(0, storage_used_bytes - $1) WHERE id = $2",
        [bytes, userId],
      );
    }
  }

  return {
    deletedRows: assets.rows.length,
    deletedBytes: [...bytesByUser.values()].reduce((sum, value) => sum + value, 0),
  };
}
