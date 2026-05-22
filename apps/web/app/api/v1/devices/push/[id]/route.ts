import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/request-auth";

// DELETE /api/v1/devices/push/:id — revoke a single device's push token.
// Either the device itself (bearer) or the user from a web session can
// revoke. Soft-delete via `revoked_at` so we keep a record (helpful for
// debugging "why didn't I get a notification" reports).
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await requireUser(req);
  if (!user) return fail("unauthorized", "Sign in required", 401);

  const { id } = await params;
  const result = await db.query(
    `UPDATE device_push_tokens
        SET revoked_at = now()
      WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [id, user.id],
  );

  if ((result.rowCount ?? 0) === 0) {
    return fail("not_found", "Device not found or already revoked", 404);
  }
  return ok({ revoked: true });
}
