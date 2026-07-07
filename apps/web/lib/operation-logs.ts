import { db } from "@/lib/db";

export type OperationLogStatus = "succeeded" | "failed" | "skipped";

export type OperationLogInput = {
  userId?: string | null;
  itemId?: string | null;
  jobId?: string | null;
  operation: string;
  provider?: string | null;
  model?: string | null;
  status: OperationLogStatus;
  attemptCount?: number | null;
  durationMs?: number | null;
  inputChars?: number | null;
  outputChars?: number | null;
  crawlBytes?: number | null;
  failureReason?: string | null;
  metadata?: Record<string, unknown>;
};

export function estimateTokens(chars: number | null | undefined) {
  if (!chars || chars <= 0) return null;
  return Math.ceil(chars / 4);
}

export async function recordOperationLog(input: OperationLogInput) {
  try {
    await db.query(
      `INSERT INTO operation_logs (
         user_id,
         item_id,
         job_id,
         operation,
         provider,
         model,
         status,
         attempt_count,
         duration_ms,
         input_chars,
         output_chars,
         estimated_input_tokens,
         estimated_output_tokens,
         crawl_bytes,
         failure_reason,
         metadata
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8,
         $9, $10, $11, $12, $13, $14, $15, $16::jsonb
       )`,
      [
        input.userId ?? null,
        input.itemId ?? null,
        input.jobId ?? null,
        input.operation,
        input.provider ?? null,
        input.model ?? null,
        input.status,
        input.attemptCount ?? null,
        input.durationMs ?? null,
        input.inputChars ?? null,
        input.outputChars ?? null,
        estimateTokens(input.inputChars),
        estimateTokens(input.outputChars),
        input.crawlBytes ?? null,
        input.failureReason?.slice(0, 1000) ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  } catch {
    // Observability writes are best-effort and must not fail user work.
  }
}

export async function withOperationLog<T>(
  input: Omit<OperationLogInput, "status" | "durationMs" | "outputChars" | "failureReason"> & {
    outputChars?: (value: T) => number | null | undefined;
  },
  run: () => Promise<T>,
) {
  const startedAt = Date.now();
  const { outputChars, ...logInput } = input;
  try {
    const value = await run();
    await recordOperationLog({
      ...logInput,
      status: "succeeded",
      durationMs: Date.now() - startedAt,
      outputChars: outputChars?.(value) ?? null,
    });
    return value;
  } catch (error) {
    await recordOperationLog({
      ...logInput,
      status: "failed",
      durationMs: Date.now() - startedAt,
      failureReason: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
