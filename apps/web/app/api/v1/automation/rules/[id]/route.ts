import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/request-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const conditionSchema = z.object({
  field: z.enum(["title", "url", "text", "source", "tag"]),
  op: z.enum(["contains", "equals", "starts_with"]).optional(),
  value: z.string().min(1).max(300),
});

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("add_tags"), tags: z.array(z.string().trim().min(1).max(50)).min(1).max(20) }),
  z.object({ type: z.literal("move_folder"), collection_id: z.string().uuid().nullable().optional(), name: z.string().trim().max(80).nullable().optional() }),
  z.object({ type: z.literal("set_reminder"), reminder_at: z.string().datetime() }),
  z.object({ type: z.literal("archive_page") }),
  z.object({ type: z.literal("mark_favorite"), value: z.boolean().optional() }),
  z.object({ type: z.literal("mark_archived"), value: z.boolean().optional() }),
  z.object({ type: z.literal("mark_read_later"), value: z.boolean().optional() }),
  z.object({ type: z.literal("skip") }),
]);

const updateRuleSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(-1000).max(1000).optional(),
  conditions: z.array(conditionSchema).max(20).optional(),
  actions: z.array(actionSchema).min(1).max(20).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req);
  if (!user) return apiError("Unauthorized", 401);
  const { id } = await params;

  const parsed = updateRuleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("Invalid automation rule update", 400);

  const updates: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  for (const [field, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue;
    if (field === "conditions" || field === "actions") {
      updates.push(`${field} = $${index++}::jsonb`);
      values.push(JSON.stringify(value));
    } else {
      updates.push(`${field} = $${index++}`);
      values.push(value);
    }
  }

  if (updates.length === 0) return apiError("No valid updates provided", 400);

  updates.push("updated_at = NOW()");
  values.push(id, user.id);
  const result = await db.query(
    `UPDATE automation_rules SET ${updates.join(", ")} WHERE id = $${index++} AND user_id = $${index}`,
    values,
  );
  if (result.rowCount === 0) return apiError("Automation rule not found", 404);

  return apiOk({ success: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req);
  if (!user) return apiError("Unauthorized", 401);
  const { id } = await params;

  const result = await db.query("DELETE FROM automation_rules WHERE id = $1 AND user_id = $2", [id, user.id]);
  if (result.rowCount === 0) return apiError("Automation rule not found", 404);

  return apiOk({ success: true });
}
