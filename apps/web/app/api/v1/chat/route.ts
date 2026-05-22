import { ChatRequestSchema } from "@recall/api-schema";
import { streamArchiveAnswer } from "@/lib/archive-chat";
import { parseBody } from "@/lib/api-response";
import { db } from "@/lib/db";
import { getChatQueryLimit } from "@/lib/plan-limits";
import { rateLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await requireSessionUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Hourly burst limit sits on top of the per-day plan quota below. The plan
  // quota caps total Gemini cost per user per day; this caps how fast a
  // stolen session can run through it.
  const burst = await rateLimit({
    key: `chat:user:${user.id}`,
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!burst.allowed) {
    return new Response(
      JSON.stringify({ error: "rate_limited", code: "rate_limited" }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": Math.ceil(burst.retryAfterMs / 1000).toString(),
        },
      },
    );
  }

  // Enforce per-day chat query limit atomically.
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const quotaResult = await db.query<{ plan: string; chat_queries_today: number; chat_queries_reset_date: string | null; timezone: string | null }>(
    "SELECT plan, chat_queries_today, chat_queries_reset_date, timezone FROM users WHERE id = $1",
    [user.id]
  );
  if (quotaResult.rowCount === 0) {
    return new Response("User not found", { status: 404 });
  }
  const { plan, chat_queries_today, chat_queries_reset_date, timezone } = quotaResult.rows[0];
  const limit = getChatQueryLimit(plan as "free" | "starter" | "pro");

  if (chat_queries_reset_date !== today) {
    // New day — reset counter before checking.
    await db.query(
      "UPDATE users SET chat_queries_today = 1, chat_queries_reset_date = $1 WHERE id = $2",
      [today, user.id]
    );
  } else if (chat_queries_today >= limit) {
    return new Response(
      JSON.stringify({ error: "chat_limit_reached", upgrade_url: "/app/settings" }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  } else {
    await db.query(
      "UPDATE users SET chat_queries_today = chat_queries_today + 1 WHERE id = $1",
      [user.id]
    );
  }

  const parsed = await parseBody(req, ChatRequestSchema);
  if (!parsed.ok) return parsed.response;
  const lastUserMessage = parsed.data.messages
    .filter((message) => message.role === "user")
    .pop();
  if (!lastUserMessage) {
    return new Response("No user message found", { status: 400 });
  }
  // The Zod schema already trims/length-checks each message, but the trimmed
  // body could still be whitespace-only — reject that.
  if (lastUserMessage.content.trim().length === 0) {
    return new Response("Message content is empty", { status: 400 });
  }

  try {
    const stream = await streamArchiveAnswer({
      userId: user.id,
      query: lastUserMessage.content,
      timezone: timezone ?? "UTC",
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Chat error:", err);
    return new Response("Internal error", { status: 500 });
  }
}
