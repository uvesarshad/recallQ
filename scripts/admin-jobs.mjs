import { Pool } from "pg";
import { config as loadEnv } from "dotenv";
import fs from "fs/promises";

loadEnv();

const args = process.argv.slice(2);
const command = args[0] ?? "queue-depth";
const flags = new Set(args.filter((arg) => arg.startsWith("--")));

function valueFor(name, fallback = null) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

function limitValue(defaultValue = 50) {
  const parsed = Number(valueFor("--limit", defaultValue));
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 1), 5000) : defaultValue;
}

function requireApply(action) {
  if (!flags.has("--apply")) {
    console.log(`${action} dry run. Re-run with --apply to mutate rows.`);
    return false;
  }
  return true;
}

function hostFromUrl(rawUrl) {
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function queueDepth() {
  const result = await pool.query(
    `SELECT type, status, COUNT(*)::int AS count
     FROM jobs
     GROUP BY type, status
     ORDER BY type, status`,
  );
  console.table(result.rows);
}

async function failedJobs() {
  const type = valueFor("--type");
  const limit = limitValue();
  const params = [];
  const typeFilter = type ? `WHERE type = $${params.push(type)}` : "";
  params.push(limit);
  const result = await pool.query(
    `SELECT id, type, user_id, item_id, attempt_count, max_attempts, last_error, updated_at
     FROM jobs
     ${typeFilter}
     ${typeFilter ? "AND" : "WHERE"} status = 'failed'
     ORDER BY updated_at DESC
     LIMIT $${params.length}`,
    params,
  );
  console.table(result.rows);
}

async function retryFailedJobs() {
  const type = valueFor("--type");
  const limit = limitValue();
  const params = [];
  const typeFilter = type ? `AND type = $${params.push(type)}` : "";
  params.push(limit);

  const preview = await pool.query(
    `SELECT id, type, last_error
     FROM jobs
     WHERE status = 'failed'
       ${typeFilter}
     ORDER BY updated_at ASC
     LIMIT $${params.length}`,
    params,
  );
  console.table(preview.rows);
  if (!requireApply(`retry-failed would reset ${preview.rows.length} job(s) to pending`)) return;
  if (preview.rows.length === 0) return;

  await pool.query(
    `UPDATE jobs
     SET status = 'pending',
         locked_by = NULL,
         locked_at = NULL,
         run_after = NOW(),
         last_error = NULL,
         updated_at = NOW()
     WHERE id = ANY($1::uuid[])`,
    [preview.rows.map((row) => row.id)],
  );
  console.log(`Retried ${preview.rows.length} job(s).`);
}

async function reEnrichFailedItems() {
  const limit = limitValue();
  const result = await pool.query(
    `SELECT id, title, enrichment_last_error
     FROM items
     WHERE enrichment_status = 'failed'
     ORDER BY updated_at ASC
     LIMIT $1`,
    [limit],
  );
  console.table(result.rows);
  if (!requireApply(`re-enrich-failed would queue ${result.rows.length} item(s)`)) return;
  if (result.rows.length === 0) return;

  await pool.query(
    `UPDATE items
     SET enrichment_status = 'pending',
         enrichment_locked_at = NULL,
         enrichment_last_error = NULL,
         updated_at = NOW()
     WHERE id = ANY($1::uuid[])`,
    [result.rows.map((row) => row.id)],
  );
  console.log(`Queued ${result.rows.length} item(s) for enrichment.`);
}

async function backfillHosts() {
  const limit = limitValue(1000);
  const result = await pool.query(
    `SELECT id, raw_url
     FROM items
     WHERE raw_url IS NOT NULL
       AND (url_host IS NULL OR url_host = '')
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit],
  );
  const updates = result.rows
    .map((row) => ({ id: row.id, url_host: hostFromUrl(row.raw_url) }))
    .filter((row) => row.url_host);
  console.table(updates.slice(0, 25));
  if (updates.length > 25) console.log(`...${updates.length - 25} more`);
  if (!requireApply(`backfill-hosts would update ${updates.length} item(s)`)) return;
  if (updates.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const row of updates) {
      await client.query(
        "UPDATE items SET url_host = $2, updated_at = NOW() WHERE id = $1",
        [row.id, row.url_host],
      );
    }
    await client.query("COMMIT");
    console.log(`Updated ${updates.length} item host(s).`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function operationSummary() {
  const result = await pool.query(
    `SELECT operation,
            provider,
            status,
            COUNT(*)::int AS count,
            AVG(duration_ms)::int AS avg_ms,
            SUM(crawl_bytes)::bigint AS crawl_bytes,
            SUM(estimated_input_tokens)::bigint AS input_tokens,
            SUM(estimated_output_tokens)::bigint AS output_tokens
     FROM operation_logs
     WHERE created_at >= NOW() - INTERVAL '24 hours'
     GROUP BY operation, provider, status
     ORDER BY operation, provider, status`,
  );
  console.table(result.rows);
}

async function archiveRetention() {
  const limit = limitValue(100);
  const preview = await pool.query(
    `SELECT id, user_id, item_id, kind, status, file_path, byte_size, retention_expires_at, created_at
     FROM archive_assets
     WHERE status = 'deleted'
        OR (retention_expires_at IS NOT NULL AND retention_expires_at <= NOW())
        OR (status = 'failed' AND created_at <= NOW() - INTERVAL '30 days')
     ORDER BY COALESCE(retention_expires_at, deleted_at, created_at) ASC
     LIMIT $1`,
    [limit],
  );
  console.table(preview.rows);
  if (!requireApply(`archive-retention would delete ${preview.rows.length} archive asset row(s) and owned files`)) return;
  if (preview.rows.length === 0) return;

  const marked = await pool.query(
    `WITH candidates AS (
       SELECT id
       FROM archive_assets
       WHERE status = 'deleted'
          OR (retention_expires_at IS NOT NULL AND retention_expires_at <= NOW())
          OR (status = 'failed' AND created_at <= NOW() - INTERVAL '30 days')
       ORDER BY COALESCE(retention_expires_at, deleted_at, created_at) ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE archive_assets
     SET status = 'deleted',
         deleted_at = COALESCE(deleted_at, NOW()),
         cleanup_reason = COALESCE(cleanup_reason, 'operator_retention_cleanup'),
         updated_at = NOW()
     FROM candidates
     WHERE archive_assets.id = candidates.id
     RETURNING archive_assets.id, archive_assets.user_id, archive_assets.file_path, archive_assets.byte_size`,
    [limit],
  );

  const bytesByUser = new Map();
  for (const row of marked.rows) {
    if (row.file_path) {
      await fs.rm(row.file_path, { force: true }).catch(() => {});
    }
    bytesByUser.set(row.user_id, (bytesByUser.get(row.user_id) ?? 0) + Number(row.byte_size ?? 0));
  }

  await pool.query("DELETE FROM archive_assets WHERE id = ANY($1::uuid[])", [
    marked.rows.map((row) => row.id),
  ]);
  for (const [userId, bytes] of bytesByUser) {
    if (bytes > 0) {
      await pool.query(
        "UPDATE users SET storage_used_bytes = GREATEST(0, storage_used_bytes - $1) WHERE id = $2",
        [bytes, userId],
      );
    }
  }
  console.log(`Deleted ${marked.rows.length} archive asset row(s).`);
}

try {
  if (command === "queue-depth") await queueDepth();
  else if (command === "failed") await failedJobs();
  else if (command === "retry-failed") await retryFailedJobs();
  else if (command === "re-enrich-failed") await reEnrichFailedItems();
  else if (command === "backfill-hosts") await backfillHosts();
  else if (command === "operation-summary") await operationSummary();
  else if (command === "archive-retention") await archiveRetention();
  else {
    console.error(`Unknown command: ${command}`);
    console.error("Commands: queue-depth, failed, retry-failed, re-enrich-failed, backfill-hosts, operation-summary, archive-retention");
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}
