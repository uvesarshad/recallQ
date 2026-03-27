import { db } from "@/lib/db";
import { getGeminiModel } from "@/lib/gemini";
import { getCurrentISTTimestamp } from "@/lib/datetime";

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
}

function sanitizeTags(tags: string[]) {
  return Array.from(new Set(tags.map(normalizeTag).filter(Boolean)));
}

export function extractTagsFromText(input: string) {
  const hashtagMatches = Array.from(input.matchAll(/#([a-z0-9-_]+)/gi)).map((match) =>
    normalizeTag(match[1]),
  );
  const inlineTags = Array.from(
    input.matchAll(/tags?\s*:\s*([a-z0-9,\s-]+)/gi),
  ).flatMap((match) =>
    match[1]
      .split(",")
      .map((tag) => normalizeTag(tag))
      .filter(Boolean),
  );
  return sanitizeTags([...hashtagMatches, ...inlineTags]);
}

export function extractReminderFromText(input: string) {
  const lowered = input.toLowerCase();
  if (!/(remind me|reminder|follow up|follow-up)/.test(lowered)) {
    return null;
  }

  const now = new Date();
  if (lowered.includes("tomorrow")) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow.toISOString();
  }

  const exactMatch = lowered.match(/\b(?:on|for)\s+(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/i);
  if (!exactMatch) {
    return null;
  }

  const day = Number(exactMatch[1]);
  const monthIndex = MONTHS[exactMatch[2]];
  if (monthIndex === undefined) {
    return null;
  }

  const year = exactMatch[3] ? Number(exactMatch[3]) : now.getFullYear();
  const reminder = new Date(year, monthIndex, day, 9, 0, 0, 0);
  if (reminder.getTime() < now.getTime()) {
    reminder.setFullYear(reminder.getFullYear() + 1);
  }

  return reminder.toISOString();
}

export function extractCategoryName(input: string) {
  const categoryMatch =
    input.match(/folder\s*:\s*([a-z0-9\s-]+)/i) ||
    input.match(/add this to (?:the )?([a-z0-9\s-]+) folder/i) ||
    input.match(/move this to (?:the )?([a-z0-9\s-]+) folder/i) ||
    input.match(/category\s*:\s*([a-z0-9\s-]+)/i) ||
    input.match(/add this to (?:the )?([a-z0-9\s-]+) category/i) ||
    input.match(/move this to (?:the )?([a-z0-9\s-]+) category/i);

  return categoryMatch?.[1]?.trim() || null;
}

async function ensureCollection(userId: string, name: string) {
  const existing = await db.query(
    "SELECT id FROM collections WHERE user_id = $1 AND lower(name) = lower($2) LIMIT 1",
    [userId, name],
  );
  if (existing.rowCount) {
    return existing.rows[0].id as string;
  }

  const created = await db.query(
    "INSERT INTO collections (user_id, name) VALUES ($1, $2) RETURNING id",
    [userId, name],
  );
  return created.rows[0].id as string;
}

async function extractActionsWithAI(input: string) {
  try {
    const model = getGeminiModel();
    const prompt = `You extract structured actions from user text for a personal knowledge app.

Current time in IST: ${getCurrentISTTimestamp()}
Default reminder time if the user implies a date without a time: 09:00 IST.

Return JSON only with this exact shape:
{
  "tags": ["lowercase-tag"],
  "categoryName": null,
  "reminderAt": null,
  "confidence": "high"
}

Rules:
- Understand natural language flexibly.
- "categoryName" should be the intended folder/category if the user implies organization.
- "tags" should be short lowercase tags inferred from explicit or clearly intended categorization.
- "reminderAt" must be an ISO8601 datetime string if the user asks for a reminder/follow-up, else null.
- "confidence" must be one of: "high", "medium", "low".
- If uncertain, prefer null/[] instead of guessing.

Text:
${input}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw) as {
      tags?: string[];
      categoryName?: string | null;
      reminderAt?: string | null;
      confidence?: "high" | "medium" | "low";
    };

    return {
      tags: sanitizeTags(Array.isArray(parsed.tags) ? parsed.tags : []),
      categoryName: parsed.categoryName?.trim() || null,
      reminderAt: parsed.reminderAt || null,
      confidence: parsed.confidence || "medium",
    };
  } catch {
    return null;
  }
}

async function parseActions(input: string) {
  const ai = await extractActionsWithAI(input);
  const fallback = {
    tags: extractTagsFromText(input),
    categoryName: extractCategoryName(input),
    reminderAt: extractReminderFromText(input),
  };

  return {
    tags: sanitizeTags([...(fallback.tags || []), ...(ai?.tags || [])]),
    categoryName: ai?.categoryName || fallback.categoryName,
    reminderAt: ai?.reminderAt || fallback.reminderAt,
    confidence: ai?.confidence || (fallback.tags.length > 0 || fallback.categoryName || fallback.reminderAt ? "medium" : "low"),
  };
}

export async function previewCaptureActions(input: string) {
  const parsed = await parseActions(input);
  return {
    tags: parsed.tags,
    categoryName: parsed.categoryName,
    reminderAt: parsed.reminderAt,
    confidence: parsed.confidence,
  };
}

export async function inferCaptureActions({
  userId,
  body,
  existingCollectionId,
  existingReminderAt,
  existingTags,
  overrides,
}: {
  userId: string;
  body: string;
  existingCollectionId?: string | null;
  existingReminderAt?: string | null;
  existingTags?: string[];
  overrides?: {
    tags?: string[];
    categoryName?: string | null;
    reminderAt?: string | null;
  };
}) {
  const parsed = await parseActions(body);
  const resolvedTags = overrides?.tags ?? parsed.tags;
  const resolvedCategoryName =
    overrides && Object.prototype.hasOwnProperty.call(overrides, "categoryName")
      ? overrides.categoryName ?? null
      : parsed.categoryName;
  const resolvedReminderAt =
    overrides && Object.prototype.hasOwnProperty.call(overrides, "reminderAt")
      ? overrides.reminderAt ?? null
      : parsed.reminderAt;

  const tags = sanitizeTags([...(existingTags ?? []), ...resolvedTags]);
  const reminderAt = existingReminderAt || resolvedReminderAt;
  const categoryName = resolvedCategoryName;
  const collectionId = existingCollectionId || (categoryName ? await ensureCollection(userId, categoryName) : null);

  return {
    tags,
    reminderAt,
    collectionId,
    categoryName,
    confidence: parsed.confidence,
  };
}

export async function applyCommentActions({
  itemId,
  userId,
  body,
  overrides,
}: {
  itemId: string;
  userId: string;
  body: string;
  overrides?: {
    tags?: string[];
    categoryName?: string | null;
    reminderAt?: string | null;
  };
}) {
  const itemResult = await db.query(
    `SELECT tags, collection_id, reminder_at
     FROM items
     WHERE id = $1 AND user_id = $2`,
    [itemId, userId],
  );
  const currentItem = itemResult.rows[0] ?? {};

  const applied: string[] = [];
  const parsed = await inferCaptureActions({
    userId,
    body,
    existingCollectionId: currentItem.collection_id ?? null,
    existingReminderAt: currentItem.reminder_at ?? null,
    existingTags: currentItem.tags ?? [],
    overrides,
  });

  if ((parsed.tags ?? []).length > 0) {
    await db.query(
      `UPDATE items SET tags = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [parsed.tags, itemId, userId],
    );
    applied.push(`tags: ${parsed.tags.join(", ")}`);
  }

  if (parsed.reminderAt) {
    await db.query(
      `UPDATE items SET reminder_at = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [parsed.reminderAt, itemId, userId],
    );
    await db.query(
      `INSERT INTO reminders (item_id, user_id, remind_at, channels)
       VALUES ($1, $2, $3, '{email}')
       ON CONFLICT DO NOTHING`,
      [itemId, userId, parsed.reminderAt],
    );
    applied.push(`reminder: ${new Date(parsed.reminderAt).toLocaleString("en-IN")}`);
  }

  if (parsed.collectionId) {
    await db.query(
      `UPDATE items SET collection_id = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [parsed.collectionId, itemId, userId],
    );
    if (parsed.categoryName) {
      applied.push(`category: ${parsed.categoryName}`);
    }
  }

  return applied;
}
