import { db } from "@/lib/db";
import { embedText, sanitizeForPrompt } from "@/lib/gemini";
import { streamGenerate, generateText } from "@/lib/llm";
import { hasVectorSupport } from "@/lib/vector";

export type ArchiveCitation = {
  id: string;
  title?: string | null;
  url?: string | null;
};

type ArchiveQueryRow = {
  id: string;
  title: string | null;
  summary: string | null;
  raw_text: string | null;
  raw_url: string | null;
  similarity: number | string;
};

type ArchiveContext = {
  systemPrompt: string;
  citations: ArchiveCitation[];
  earlyAnswer?: string;
};

async function buildArchiveContext(userId: string, query: string, timezone: string): Promise<ArchiveContext> {
  const trimmedQuery = query.trim();

  const vectorEnabled = await hasVectorSupport();
  if (!vectorEnabled) {
    return { systemPrompt: "", citations: [], earlyAnswer: "Semantic archive Q&A is not available right now because vector search is not enabled." };
  }

  const embedding = await embedText(trimmedQuery);
  if (!embedding) {
    return { systemPrompt: "", citations: [], earlyAnswer: "I couldn't read that question. Please try again." };
  }

  const relevantItems = await db.query<ArchiveQueryRow>(
    `SELECT id, title, summary, raw_text, raw_url,
            1 - (embedding <=> $2::vector) AS similarity
     FROM items
     WHERE user_id = $1 AND embedding IS NOT NULL
     ORDER BY embedding <=> $2::vector
     LIMIT 10`,
    [userId, JSON.stringify(embedding)]
  );

  const filteredItems = relevantItems.rows.filter((item) => Number(item.similarity) > 0.68);
  if (filteredItems.length === 0) {
    return { systemPrompt: "", citations: [], earlyAnswer: "I couldn't find any saved items related to your question." };
  }

  const contextItems = filteredItems
    .map((item) => {
      const parts = [`Title: ${sanitizeForPrompt(item.title || "Untitled", 120)}`];
      if (item.summary) parts.push(`Summary: ${sanitizeForPrompt(item.summary, 400)}`);
      if (item.raw_text) parts.push(`Content: ${sanitizeForPrompt(item.raw_text, 700)}`);
      if (item.raw_url) parts.push(`URL: ${item.raw_url}`);
      return parts.join("\n");
    })
    .join("\n\n---\n\n");

  const systemPrompt = `You are a personal assistant for a user's saved content archive.
Answer only from the provided saved items. If the answer is not present, say so clearly.
Keep the answer concise and useful.
Today's date: ${new Date().toISOString().split("T")[0]}. User's timezone: ${timezone}.

Saved items most relevant to the question:
${contextItems}`;

  const citations = filteredItems.slice(0, 3).map((item) => ({
    id: item.id,
    title: item.title,
    url: item.raw_url,
  }));

  return { systemPrompt, citations };
}

/** Streaming version — returns a ReadableStream of SSE-formatted chunks. */
export async function streamArchiveAnswer({
  userId,
  query,
  timezone = "IST",
}: {
  userId: string;
  query: string;
  timezone?: string;
}): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return sseStaticStream(encoder, "Please send a question to search your archive.", []);
  }

  const ctx = await buildArchiveContext(userId, trimmedQuery, timezone);

  if (ctx.earlyAnswer !== undefined) {
    return sseStaticStream(encoder, ctx.earlyAnswer, ctx.citations);
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const text of streamGenerate(
          ctx.systemPrompt,
          `Question: ${sanitizeForPrompt(trimmedQuery, 500)}`,
        )) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, citations: ctx.citations })}\n\n`));
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`));
        console.error("LLM stream error:", err);
      } finally {
        controller.close();
      }
    },
  });
}

/** Non-streaming version used by Telegram bot and other non-SSE callers. */
export async function answerArchiveQuestion({
  userId,
  query,
  timezone = "IST",
}: {
  userId: string;
  query: string;
  timezone?: string;
}) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return { answer: "Please send a question to search your archive.", citations: [] as ArchiveCitation[] };
  }

  const ctx = await buildArchiveContext(userId, trimmedQuery, timezone);

  if (ctx.earlyAnswer !== undefined) {
    return { answer: ctx.earlyAnswer, citations: ctx.citations };
  }

  const raw = await generateText(
    `${ctx.systemPrompt}\n\nQuestion: ${sanitizeForPrompt(trimmedQuery, 500)}`,
  );
  const answer = raw.trim() || "I couldn't generate an answer from your saved items.";
  return { answer, citations: ctx.citations };
}

function sseStaticStream(encoder: TextEncoder, answer: string, citations: ArchiveCitation[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: answer })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, citations })}\n\n`));
      controller.close();
    },
  });
}
