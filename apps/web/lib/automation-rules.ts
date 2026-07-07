import { db } from "@/lib/db";
import { enqueuePageArchive } from "@/lib/archive-assets";

export type AutomationRule = {
  id: string;
  user_id: string;
  event: "capture" | "import" | "rss" | "enriched";
  conditions: AutomationCondition[];
  actions: AutomationAction[];
};

export type AutomationCondition = {
  field: "title" | "url" | "text" | "source" | "tag";
  op?: "contains" | "equals" | "starts_with";
  value: string;
};

export type AutomationAction =
  | { type: "add_tags"; tags: string[] }
  | { type: "move_folder"; collection_id?: string | null; name?: string | null }
  | { type: "set_reminder"; reminder_at: string }
  | { type: "archive_page" }
  | { type: "mark_favorite"; value?: boolean }
  | { type: "mark_archived"; value?: boolean }
  | { type: "mark_read_later"; value?: boolean }
  | { type: "skip" };

type CaptureContext = {
  itemId?: string;
  userId: string;
  event?: AutomationRule["event"];
  title?: string | null;
  url?: string | null;
  text?: string | null;
  source?: string | null;
  tags?: string[] | null;
};

async function loadRules(userId: string, event: AutomationRule["event"]) {
  const result = await db.query<AutomationRule>(
    `SELECT id, user_id, event, conditions, actions
     FROM automation_rules
     WHERE user_id = $1 AND event = $2 AND enabled = TRUE
     ORDER BY priority DESC, created_at ASC`,
    [userId, event],
  );
  return result.rows;
}

function matchesCondition(condition: AutomationCondition, ctx: CaptureContext) {
  const expected = String(condition.value ?? "").toLowerCase();
  if (!expected) return false;

  const actual =
    condition.field === "title"
      ? ctx.title
      : condition.field === "url"
        ? ctx.url
        : condition.field === "text"
          ? ctx.text
          : condition.field === "source"
            ? ctx.source
            : (ctx.tags ?? []).join(" ");

  const value = String(actual ?? "").toLowerCase();
  if (condition.op === "equals") return value === expected;
  if (condition.op === "starts_with") return value.startsWith(expected);
  return value.includes(expected);
}

function matchesRule(rule: AutomationRule, ctx: CaptureContext) {
  if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) return true;
  return rule.conditions.every((condition) => matchesCondition(condition, ctx));
}

async function ensureRuleFolder(userId: string, name: string) {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) return null;

  const existing = await db.query<{ id: string }>(
    "SELECT id FROM collections WHERE user_id = $1 AND lower(name) = lower($2) LIMIT 1",
    [userId, trimmed],
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const created = await db.query<{ id: string }>(
    "INSERT INTO collections (user_id, name) VALUES ($1, $2) RETURNING id",
    [userId, trimmed],
  );
  return created.rows[0]?.id ?? null;
}

export async function shouldSkipCaptureByRules(ctx: CaptureContext) {
  const rules = await loadRules(ctx.userId, ctx.event ?? "capture");
  return rules.some((rule) => matchesRule(rule, ctx) && rule.actions.some((action) => action.type === "skip"));
}

export async function applyAutomationRules(ctx: CaptureContext) {
  if (!ctx.itemId) return [];

  const event = ctx.event ?? "capture";
  const rules = await loadRules(ctx.userId, event);
  const applied: string[] = [];

  for (const rule of rules) {
    if (!matchesRule(rule, ctx)) continue;

    const actionNames: string[] = [];
    for (const action of rule.actions) {
      if (action.type === "add_tags" && action.tags.length > 0) {
        await db.query(
          `UPDATE items
           SET tags = (
                 SELECT ARRAY(
                   SELECT DISTINCT tag
                   FROM unnest(COALESCE(tags, '{}') || $1::text[]) AS tag
                   WHERE tag <> ''
                 )
               ),
               updated_at = NOW()
           WHERE id = $2 AND user_id = $3`,
          [action.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean), ctx.itemId, ctx.userId],
        );
        actionNames.push("add_tags");
      } else if (action.type === "move_folder") {
        const collectionId = action.collection_id ?? (action.name ? await ensureRuleFolder(ctx.userId, action.name) : null);
        if (collectionId) {
          await db.query("UPDATE items SET collection_id = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3", [
            collectionId,
            ctx.itemId,
            ctx.userId,
          ]);
          actionNames.push("move_folder");
        }
      } else if (action.type === "set_reminder") {
        await db.query("UPDATE items SET reminder_at = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3", [
          action.reminder_at,
          ctx.itemId,
          ctx.userId,
        ]);
        await db.query(
          `INSERT INTO reminders (item_id, user_id, remind_at, channels)
           VALUES ($1, $2, $3, '{email}')
           ON CONFLICT DO NOTHING`,
          [ctx.itemId, ctx.userId, action.reminder_at],
        );
        actionNames.push("set_reminder");
      } else if (action.type === "archive_page") {
        if (!ctx.url) {
          continue;
        }
        await enqueuePageArchive({
          userId: ctx.userId,
          itemId: ctx.itemId,
          sourceUrl: ctx.url,
        });
        actionNames.push("archive_page");
      } else if (action.type === "mark_favorite") {
        await db.query("UPDATE items SET is_favorite = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3", [
          action.value ?? true,
          ctx.itemId,
          ctx.userId,
        ]);
        actionNames.push("mark_favorite");
      } else if (action.type === "mark_archived") {
        await db.query("UPDATE items SET is_archived = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3", [
          action.value ?? true,
          ctx.itemId,
          ctx.userId,
        ]);
        actionNames.push("mark_archived");
      } else if (action.type === "mark_read_later") {
        await db.query("UPDATE items SET is_read_later = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3", [
          action.value ?? true,
          ctx.itemId,
          ctx.userId,
        ]);
        actionNames.push("mark_read_later");
      }
    }

    await db.query(
      `INSERT INTO automation_rule_runs (rule_id, user_id, item_id, event, matched, actions_applied)
       VALUES ($1, $2, $3, $4, TRUE, $5::jsonb)`,
      [rule.id, ctx.userId, ctx.itemId, event, JSON.stringify(actionNames)],
    );
    applied.push(rule.id);
  }

  return applied;
}

export async function applyCaptureRules(ctx: CaptureContext) {
  return applyAutomationRules({ ...ctx, event: "capture" });
}
