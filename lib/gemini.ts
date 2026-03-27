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

export async function embedText(text: string) {
  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  const model = getGeminiEmbeddingModel();
  const result = await model.embedContent(normalized);
  return result.embedding.values;
}
