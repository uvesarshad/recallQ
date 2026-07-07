import { db } from "@/lib/db";

export type JobType =
  | "crawl"
  | "parse"
  | "summarize"
  | "embed"
  | "relation_build"
  | "reminder"
  | "import"
  | "webhook"
  | "archive";

export type ClaimedJob = {
  id: string;
  user_id: string | null;
  item_id: string | null;
  type: JobType;
  payload: Record<string, unknown>;
  attempt_count: number;
  max_attempts: number;
};

type Queryable = {
  query: typeof db.query;
};

export async function enqueueJob({
  type,
  userId = null,
  itemId = null,
  payload = {},
  priority = 0,
  runAfter = null,
  queryable = db,
}: {
  type: JobType;
  userId?: string | null;
  itemId?: string | null;
  payload?: Record<string, unknown>;
  priority?: number;
  runAfter?: string | Date | null;
  queryable?: Queryable;
}) {
  const result = await queryable.query<{ id: string }>(
    `INSERT INTO jobs (user_id, item_id, type, payload, priority, run_after)
     VALUES ($1, $2, $3, $4::jsonb, $5, COALESCE($6::timestamptz, NOW()))
     RETURNING id`,
    [userId, itemId, type, JSON.stringify(payload), priority, runAfter],
  );

  return result.rows[0]?.id ?? null;
}

export async function claimJobs({
  workerId,
  types,
  limit = 10,
  queryable = db,
}: {
  workerId: string;
  types: JobType[];
  limit?: number;
  queryable?: Queryable;
}) {
  const result = await queryable.query<ClaimedJob>(
    `WITH candidate_jobs AS (
       SELECT id
       FROM jobs
       WHERE status IN ('pending', 'retrying')
         AND run_after <= NOW()
         AND type = ANY($2::text[])
       ORDER BY priority DESC, run_after ASC, created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE jobs
     SET status = 'processing',
         locked_by = $3,
         locked_at = NOW(),
         updated_at = NOW()
     FROM candidate_jobs
     WHERE jobs.id = candidate_jobs.id
     RETURNING jobs.id,
               jobs.user_id,
               jobs.item_id,
               jobs.type,
               jobs.payload,
               jobs.attempt_count,
               jobs.max_attempts`,
    [limit, types, workerId],
  );

  return result.rows;
}

export async function markJobSucceeded(jobId: string, result: unknown = null) {
  await db.query(
    `UPDATE jobs
     SET status = 'succeeded',
         result = $2::jsonb,
         locked_by = NULL,
         locked_at = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [jobId, JSON.stringify(result ?? {})],
  );
}

export async function markJobFailed(job: ClaimedJob, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const nextAttempt = job.attempt_count + 1;
  const terminal = nextAttempt >= job.max_attempts;
  const delaySeconds = Math.min(3600, Math.pow(2, Math.min(nextAttempt, 10)) * 60);

  await db.query(
    `UPDATE jobs
     SET status = $2,
         attempt_count = attempt_count + 1,
         last_error = $3,
         locked_by = NULL,
         locked_at = NULL,
         run_after = CASE WHEN $2 = 'retrying' THEN NOW() + ($4 * INTERVAL '1 second') ELSE run_after END,
         updated_at = NOW()
     WHERE id = $1`,
    [job.id, terminal ? "failed" : "retrying", message.slice(0, 1000), delaySeconds],
  );
}
