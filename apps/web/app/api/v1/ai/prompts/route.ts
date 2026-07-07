import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { canUseCustomAiPrompts, type Plan } from "@/lib/plan-limits";
import { requireUser } from "@/lib/request-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const promptSchema = z.object({
  enabled: z.boolean(),
  enrichment_instructions: z.string().trim().max(1200).nullable().optional(),
});

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return apiError("Unauthorized", 401);

  const result = await db.query(
    `SELECT users.plan,
            COALESCE(ai_prompt_preferences.enabled, FALSE) AS enabled,
            ai_prompt_preferences.enrichment_instructions,
            ai_prompt_preferences.updated_at
     FROM users
     LEFT JOIN ai_prompt_preferences
       ON ai_prompt_preferences.user_id = users.id
     WHERE users.id = $1`,
    [user.id],
  );
  const row = result.rows[0];
  if (!row) return apiError("User not found", 404);

  return apiOk({
    can_use_custom_prompts: canUseCustomAiPrompts(row.plan as Plan),
    prompt: {
      enabled: row.enabled,
      enrichment_instructions: row.enrichment_instructions,
      updated_at: row.updated_at,
    },
  });
}

export async function PUT(req: Request) {
  const user = await requireUser(req);
  if (!user) return apiError("Unauthorized", 401);

  const parsed = promptSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("Invalid prompt settings", 400);

  const planResult = await db.query<{ plan: Plan }>(
    "SELECT plan FROM users WHERE id = $1",
    [user.id],
  );
  const plan = planResult.rows[0]?.plan;
  if (!plan) return apiError("User not found", 404);
  if (!canUseCustomAiPrompts(plan)) {
    return apiError("Custom AI prompts require the Pro plan", 402, {
      upgrade_url: "/app/settings",
    });
  }

  const instructions = parsed.data.enrichment_instructions?.trim() || null;
  const result = await db.query(
    `INSERT INTO ai_prompt_preferences (user_id, enabled, enrichment_instructions)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id)
     DO UPDATE SET enabled = EXCLUDED.enabled,
                   enrichment_instructions = EXCLUDED.enrichment_instructions,
                   updated_at = NOW()
     RETURNING enabled, enrichment_instructions, updated_at`,
    [user.id, parsed.data.enabled, instructions],
  );

  return apiOk({ prompt: result.rows[0] });
}
