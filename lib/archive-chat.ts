import { db } from "@/lib/db";
import { embedText, getGeminiModel } from "@/lib/gemini";
import { hasVectorSupport } from "@/lib/vector";

type ArchiveCitation = {
  id: string;
  title?: string | null;
  url?: string | null;
};

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

  const vectorEnabled = await hasVectorSupport();
  if (!vectorEnabled) {
    return {
      answer: "Semantic archive Q&A is not available right now because vector search is not enabled.",
      citations: [] as ArchiveCitation[],
    };
  }

  const embedding = await embedText(trimmedQuery);
  if (!embedding) {
    return { answer: "I couldn't read that question. Please try again.", citations: [] as ArchiveCitation[] };
  }

  const relevantItems = await db.query(
    `SELECT id, title, summary, raw_text, raw_url, type,
            1 - (embedding <=> $2::vector) as similarity
     FROM items
     WHERE user_id = $1 AND embedding IS NOT NULL
     ORDER BY embedding <=> $2::vector
     LIMIT 10`,
    [userId, JSON.stringify(embedding)]
  );

  const filteredItems = relevantItems.rows.filter((item: any) => Number(item.similarity) > 0.68);
  if (filteredItems.length === 0) {
    return {
      answer: "I couldn't find any saved items related to your question.",
      citations: [] as ArchiveCitation[],
    };
  }

  const contextItems = filteredItems
    .map((item: any) => {
      let content = `Title: ${item.title || "Untitled"}`;
      if (item.summary) content += `\nSummary: ${item.summary}`;
      if (item.raw_text) content += `\nContent: ${String(item.raw_text).slice(0, 700)}`;
      if (item.raw_url) content += `\nURL: ${item.raw_url}`;
      return content;
    })
    .join("\n\n---\n\n");

  const systemPrompt = `You are a personal assistant for a user's saved content archive.
Answer only from the provided saved items. If the answer is not present, say so clearly.
Keep the answer concise and useful for Telegram.
Today's date: ${new Date().toISOString().split("T")[0]}. User's timezone: ${timezone}.

Saved items most relevant to the question:
${contextItems}`;

  const model = getGeminiModel();
  const result = await model.generateContent([
    { text: systemPrompt },
    { text: `Question: ${trimmedQuery}` },
  ]);

  const answer = result.response.text().trim() || "I couldn't generate an answer from your saved items.";
  const citations = filteredItems.slice(0, 3).map((item: any) => ({
    id: item.id,
    title: item.title,
    url: item.raw_url,
  }));

  return { answer, citations };
}
