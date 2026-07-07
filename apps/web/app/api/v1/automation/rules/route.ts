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

const createRuleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  event: z.enum(["capture", "import", "rss", "enriched"]).default("capture"),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(-1000).max(1000).optional(),
  conditions: z.array(conditionSchema).max(20).default([]),
  actions: z.array(actionSchema).min(1).max(20),
});

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return apiError("Unauthorized", 401);

  const result = await db.query(
    `SELECT id, name, event, enabled, priority, conditions, actions, last_run_at, created_at, updated_at
     FROM automation_rules
     WHERE user_id = $1
     ORDER BY priority DESC, created_at ASC`,
    [user.id],
  );

  return apiOk({ rules: result.rows });
}

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return apiError("Unauthorized", 401);

  const parsed = createRuleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("Invalid automation rule", 400);

  const result = await db.query<{ id: string }>(
    `INSERT INTO automation_rules (user_id, name, event, enabled, priority, conditions, actions)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
     RETURNING id`,
    [
      user.id,
      parsed.data.name,
      parsed.data.event,
      parsed.data.enabled ?? true,
      parsed.data.priority ?? 0,
      JSON.stringify(parsed.data.conditions),
      JSON.stringify(parsed.data.actions),
    ],
  );

  return apiOk({ id: result.rows[0].id });
}
