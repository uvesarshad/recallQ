import { apiError, apiOk } from "@/lib/api";
import { importPocketExport } from "@/lib/import-export-db";
import { readTextImportPayload } from "@/lib/import-route";
import { requireUser } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return apiError("Unauthorized", 401);

  const payload = await readTextImportPayload(req);
  if ("response" in payload) return payload.response;

  try {
    const result = await importPocketExport({
      userId: user.id,
      content: payload.content,
      fileName: payload.fileName,
      dryRun: payload.dryRun,
    });
    return apiOk(
      { importSession: result.session, mapping: result.mapping, preview: result.preview },
      { status: payload.dryRun ? 200 : 201 },
    );
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Pocket import failed", 500);
  }
}
