import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export async function requireSessionUser() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  return { id: userId, authType: "session" as const };
}

export async function requireIngestUser(req: Request) {
  const sessionUser = await requireSessionUser();
  if (sessionUser) {
    return sessionUser;
  }

  const token = req.headers.get("x-internal-ingest-token");
  const userId = req.headers.get("x-recall-user-id");
  if (token && userId && env.INTERNAL_INGEST_TOKEN && token === env.INTERNAL_INGEST_TOKEN) {
    // Verify the userId actually exists to prevent privilege escalation if the token leaks.
    const result = await db.query("SELECT id FROM users WHERE id = $1", [userId]);
    if ((result.rowCount ?? 0) === 0) {
      return null;
    }
    return { id: userId, authType: "internal" as const };
  }

  return null;
}
