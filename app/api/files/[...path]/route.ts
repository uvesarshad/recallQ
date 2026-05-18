import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { getFileBuffer } from "@/lib/storage";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
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

  // Guard against path traversal: the stored path must be inside the configured base dir.
  if (!item.file_path || !item.file_path.startsWith(env.FILES_BASE_PATH)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const buffer = await getFileBuffer(item.file_path);
    // Encode the filename for Content-Disposition to prevent header injection.
    const safeFilename = encodeURIComponent((filename ?? "file").replace(/[\r\n]/g, ""));
    return new Response(buffer, {
      headers: {
        "Content-Type": item.file_mime_type || "application/octet-stream",
        "Content-Disposition": `inline; filename*=UTF-8''${safeFilename}`,
      },
    });
  } catch {
    return new Response("File not found on disk", { status: 404 });
  }
}
