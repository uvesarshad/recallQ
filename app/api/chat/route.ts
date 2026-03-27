import { answerArchiveQuestion } from "@/lib/archive-chat";
import { requireSessionUser } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await requireSessionUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages } = await req.json();
  const lastUserMessage = messages.filter((m: any) => m.role === "user").pop();

  if (!lastUserMessage) {
    return new Response("No user message found", { status: 400 });
  }

  try {
    const archiveResponse = await answerArchiveQuestion({
      userId: user.id,
      query: lastUserMessage.content,
      timezone: "IST",
    });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text: archiveResponse.answer })}\n\n`));
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ done: true, citations: archiveResponse.citations })}\n\n`)
          );
          controller.close();
        } catch (err) {
          console.error("Chat stream error:", err);
          controller.error(err);
        }
      }
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
