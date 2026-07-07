import { apiError } from "@/lib/api";
import { buildUserBookmarksExport, exportFilename } from "@/lib/import-export-db";
import { requireUser } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const html = await buildUserBookmarksExport(user.id);
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename("html")}"`,
      "Cache-Control": "no-store",
    },
  });
}
