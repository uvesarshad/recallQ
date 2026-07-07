import { apiError, apiOk } from "@/lib/api";
import {
  importBrowserBookmarksHtml,
} from "@/lib/import-export-db";
import { readTextImportPayload } from "@/lib/import-route";
import { requireUser } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const payload = await readImportPayload(req);
  if ("response" in payload) return payload.response;

  try {
    const result = await importBrowserBookmarksHtml({
      userId: user.id,
      html: payload.content,
      fileName: payload.fileName,
      dryRun: payload.dryRun,
    });
    return apiOk(
      { importSession: result.session, mapping: result.mapping, preview: result.preview },
      { status: payload.dryRun ? 200 : 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return apiError(message, 500);
  }
}

async function readImportPayload(req: Request) {
  return readTextImportPayload(req, "html");
}
