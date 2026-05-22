import { apiError, apiOk } from "@/lib/api";
import { ingestItem } from "@/lib/ingest";
import { rateLimit } from "@/lib/rate-limit";
import { isAcceptedMimeType } from "@/lib/storage";
import { requireIngestUser } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // hard server cap (plan limits enforced in ingestItem)

export async function POST(req: Request) {
  const user = await requireIngestUser(req);
  if (!user) return apiError("Unauthorized", 401);

  // Share the same `ingest:user:<id>` bucket as POST /api/v1/ingest so a
  // misbehaving client can't multiplex between JSON ingest and file ingest
  // to double its allowance.
  const burst = await rateLimit({
    key: `ingest:user:${user.id}`,
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (!burst.allowed) {
    return apiError("Too many captures in a short window. Slow down.", 429);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return apiError("Expected multipart/form-data", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return apiError("Missing file field", 400);

  if (file.size === 0) return apiError("File is empty", 400);
  if (file.size > MAX_FILE_SIZE_BYTES) return apiError("file_too_large", 413);
  if (!isAcceptedMimeType(file.type)) return apiError("unsupported_file_type", 415);

  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await ingestItem({
    userId: user.id,
    type: "file",
    fileName: file.name,
    fileMimeType: file.type,
    fileBuffer: buffer,
    source: "manual",
  });

  if (result.error) {
    const status = result.error === "storage_limit_reached" || result.error === "limit_reached" ? 402 : 400;
    return apiError(result.error, status, { upgrade_url: "/app/settings" });
  }

  return apiOk(result);
}
