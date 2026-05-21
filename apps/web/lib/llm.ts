/**
 * Unified LLM interface. Set LLM_PROVIDER in your .env to switch providers.
 *
 * Providers:
 *   google    — Google Gemini via @google/generative-ai  (default)
 *   openai    — OpenAI GPT models via openai SDK
 *   anthropic — Anthropic Claude via @anthropic-ai/sdk
 *   xai       — xAI Grok via OpenAI-compatible API (uses XAI_API_KEY)
 *
 * Embeddings always use Google text-embedding-004 regardless of LLM_PROVIDER
 * because pgvector dimensions must stay consistent across all stored items.
 * Switching embedding models requires re-running the enrichment worker on
 * all existing items.
 */

import { env } from "@/lib/env";

const provider = env.LLM_PROVIDER;

// ── Default model names per provider ────────────────────────────────────────

const DEFAULT_MODELS: Record<string, string> = {
  google: env.GEMINI_MODEL,
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  xai: "grok-3-mini",
};

function getModel(): string {
  return env.LLM_MODEL ?? DEFAULT_MODELS[provider] ?? DEFAULT_MODELS.google;
}

// ── Generate (non-streaming) ─────────────────────────────────────────────────

export async function generateText(prompt: string): Promise<string> {
  const model = getModel();

  if (provider === "openai") {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    return res.choices[0]?.message?.content ?? "";
  }

  if (provider === "anthropic") {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const block = res.content[0];
    return block?.type === "text" ? block.text : "";
  }

  if (provider === "xai") {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({
      apiKey: env.XAI_API_KEY,
      baseURL: env.LLM_BASE_URL ?? "https://api.x.ai/v1",
    });
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
    });
    return res.choices[0]?.message?.content ?? "";
  }

  // Default: Google Gemini
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const client = new GoogleGenerativeAI(env.GEMINI_API_KEY ?? "");
  const geminiModel = client.getGenerativeModel({ model });
  const result = await geminiModel.generateContent(prompt);
  return result.response.text();
}

// ── Stream (yields text chunks) ──────────────────────────────────────────────

export async function* streamGenerate(
  systemPrompt: string,
  userPrompt: string,
): AsyncIterable<string> {
  const model = getModel();

  if (provider === "openai") {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const stream = await client.chat.completions.create({
      model,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) yield text;
    }
    return;
  }

  if (provider === "anthropic") {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const stream = await client.messages.stream({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
    return;
  }

  if (provider === "xai") {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({
      apiKey: env.XAI_API_KEY,
      baseURL: env.LLM_BASE_URL ?? "https://api.x.ai/v1",
    });
    const stream = await client.chat.completions.create({
      model,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) yield text;
    }
    return;
  }

  // Default: Google Gemini
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const client = new GoogleGenerativeAI(env.GEMINI_API_KEY ?? "");
  const geminiModel = client.getGenerativeModel({ model });
  const geminiStream = await geminiModel.generateContentStream([
    { text: systemPrompt },
    { text: userPrompt },
  ]);
  for await (const chunk of geminiStream.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}
