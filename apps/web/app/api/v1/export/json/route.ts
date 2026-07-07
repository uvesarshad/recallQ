import { apiError } from "@/lib/api";
import { buildUserJsonExport, exportFilename } from "@/lib/import-export-db";
import { requireUser } from "@/lib/request-auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const payload = await buildUserJsonExport(user.id);
  return NextResponse.json(payload, {
    headers: {
      "Content-Disposition": `attachment; filename="${exportFilename("json")}"`,
      "Cache-Control": "no-store",
    },
  });
}
