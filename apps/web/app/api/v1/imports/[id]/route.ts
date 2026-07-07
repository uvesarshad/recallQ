import { apiError, apiOk } from "@/lib/api";
import { getImportSession } from "@/lib/import-export-db";
import { requireUser } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(req);
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const { id } = await params;
  const session = await getImportSession(user.id, id);
  if (!session) {
    return apiError("Import session not found", 404);
  }

  return apiOk({ importSession: session });
}
