import { auth } from "@/lib/auth";
import { getFileBuffer } from "@/lib/storage";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { path: pathSegments } = await params;
  const [userId, itemId, filename] = pathSegments;

  if (userId !== session.user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  // Verify item exists and belongs to user
  const itemResult = await db.query(
    "SELECT file_path, file_mime_type FROM items WHERE id = $1 AND user_id = $2",
    [itemId, userId]
  );

  if (itemResult.rowCount === 0) {
    return new Response("Not Found", { status: 404 });
  }

  const item = itemResult.rows[0];

  try {
    const buffer = await getFileBuffer(item.file_path);
    return new Response(buffer, {
      headers: {
        "Content-Type": item.file_mime_type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (err) {
    return new Response("File not found on disk", { status: 404 });
  }
}
