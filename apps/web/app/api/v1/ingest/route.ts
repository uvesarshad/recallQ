import { apiError, apiOk } from "@/lib/api";
import { ingestItem } from "@/lib/ingest";
import { rateLimit } from "@/lib/rate-limit";
import { requireIngestUser } from "@/lib/request-auth";
import { actionOverrideSchema, bulkIngestPayloadSchema, ingestPayloadSchema } from "@/lib/validation";
import { z } from "zod";

const singleIngestRequestSchema = ingestPayloadSchema.extend({
  actionOverrides: actionOverrideSchema.optional(),
});

const bulkIngestRequestSchema = bulkIngestPayloadSchema;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected ingest failure";
}

export async function POST(req: Request) {
  const user = await requireIngestUser(req);
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  // Burst limit so a runaway Telegram bot or browser extension can't slam
  // ingest with hundreds of requests per second. Per-user (not per-IP)
  // because internal-token captures (Telegram, email) share an IP.
  const burst = await rateLimit({
    key: `ingest:user:${user.id}`,
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (!burst.allowed) {
    return apiError("Too many captures in a short window. Slow down.", 429);
  }

  const rawBody = await req.json();
  const singleParsed = singleIngestRequestSchema.safeParse(rawBody);

  if (singleParsed.success) {
    try {
      const result = await ingestItem({
        userId: user.id,
        ...singleParsed.data,
      });

      if (result.error) {
        return apiError(result.error, 402, { upgrade_url: "/app/settings" });
      }

      return apiOk(result);
    } catch (error) {
      return apiError(getErrorMessage(error), 500);
    }
  }

  const bulkParsed = bulkIngestRequestSchema.safeParse(rawBody);
  if (!bulkParsed.success) {
    return apiError("Invalid ingest payload", 400, {
      issues: z.treeifyError(singleParsed.error ?? bulkParsed.error),
    });
  }

  try {
    const results = [];

    for (const item of bulkParsed.data.items) {
      const result = await ingestItem({
        userId: user.id,
        ...item,
      });

      if (result.error) {
        return apiError(result.error, 402, {
          upgrade_url: "/app/settings",
          imported_count: results.length,
        });
      }

      results.push(result);
    }

    return apiOk({
      success: true,
      count: results.length,
      items: results,
    });
  } catch (error) {
    return apiError(getErrorMessage(error), 500);
  }
}
