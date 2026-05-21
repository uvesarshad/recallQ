import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api-response";
import { requireSessionUser } from "@/lib/request-auth";

// DELETE /api/v1/auth/tokens/:id — revoke a single token. Session cookie only,
// same rationale as the listing endpoint.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await requireSessionUser();
  if (!user) return fail("unauthorized", "Sign in required", 401);

  const { id } = await params;
  const res = await db.query(
    `UPDATE personal_access_tokens
        SET revoked_at = now()
      WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [id, user.id],
  );

  if ((res.rowCount ?? 0) === 0) {
    return fail("not_found", "Token not found or already revoked", 404);
  }
  return ok({ revoked: true });
}
