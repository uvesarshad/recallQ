import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/lib/env";

const client = env.GEMINI_API_KEY ? new GoogleGenerativeAI(env.GEMINI_API_KEY) : null;

export function getGeminiModel(modelName = env.GEMINI_MODEL) {
  if (!client) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  return client.getGenerativeModel({ model: modelName });
}

export function getGeminiEmbeddingModel() {
  if (!client) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  return client.getGenerativeModel({ model: "text-embedding-004" });
}

/**
 * Wraps untrusted content in XML-delimited blocks and strips ASCII control
 * characters so it cannot escape the prompt instruction context.
 */
export function sanitizeForPrompt(value: string | null | undefined, maxLength = 3000): string {
  if (!value) return "";
  // Strip ASCII control characters (except tab/newline/CR) and null bytes.
  const cleaned = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").slice(0, maxLength);
  return `<user_content>${cleaned}</user_content>`;
}

export async function embedText(text: string) {
  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  const model = getGeminiEmbeddingModel();
  const result = await model.embedContent(normalized);
  return result.embedding.values;
}
