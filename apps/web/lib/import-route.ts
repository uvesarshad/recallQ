import { apiError } from "@/lib/api";
import { importPayloadTooLarge } from "@/lib/import-export-db";

const MAX_IMPORT_BYTES = 15 * 1024 * 1024;

export type TextImportPayload = {
  content: string;
  fileName: string | null;
  dryRun: boolean;
};

export async function readTextImportPayload(
  req: Request,
  contentField = "content",
): Promise<TextImportPayload | { response: Response }> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return { response: apiError("Missing import file", 400) };
    }
    if (file.size > MAX_IMPORT_BYTES) {
      return { response: importPayloadTooLarge() };
    }
    return {
      content: await file.text(),
      fileName: file.name || null,
      dryRun: form.get("dryRun") === "true",
    };
  }

  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_IMPORT_BYTES) {
    return { response: importPayloadTooLarge() };
  }

  if (contentType.includes("application/json")) {
    try {
      const body = JSON.parse(raw) as Record<string, unknown>;
      const content = body[contentField] ?? body.content ?? body.html;
      if (typeof content !== "string" || content.trim().length === 0) {
        return { response: apiError("Missing import content", 400) };
      }
      return {
        content,
        fileName: typeof body.fileName === "string" ? body.fileName : null,
        dryRun: body.dryRun === true,
      };
    } catch {
      return { response: apiError("Invalid JSON body", 400) };
    }
  }

  if (!raw.trim()) {
    return { response: apiError("Missing import content", 400) };
  }

  return { content: raw, fileName: null, dryRun: false };
}
