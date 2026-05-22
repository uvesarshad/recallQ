import { z } from "zod";

// POST /api/v1/chat — streaming RAG over the user's archive.
//
// `messages` is the conversation transcript. Only the last `role: "user"`
// message is used as the question; earlier messages are kept so the client
// can pass back its own conversation state (the server is stateless).
//
// Bounds:
// - max 50 messages keeps the request small and matches what the UI keeps
//   in scrollback.
// - max 2000 chars per message matches the existing hand-rolled check in
//   the route and keeps embedding/Gemini cost predictable.
export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(2000),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(50),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
