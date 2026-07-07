import dotenv from "dotenv";
dotenv.config();

import * as cheerio from "cheerio";
import fs from "fs/promises";
import mammoth from "mammoth";
const pdf = require("pdf-parse");
import * as xlsx from "xlsx";

import { computeBlurDataUrl } from "../lib/blur";
import { buildEnrichmentPrompt } from "../lib/custom-ai-prompts";
import { db } from "../lib/db";
import {
  claimEnrichmentItems,
  markEnrichmentFailed,
  markEnrichmentSucceeded,
  type EnrichmentClaimItem,
} from "../lib/enrichment-claim";
import { embedText } from "../lib/gemini";
import { generateText } from "../lib/llm";
import { logger } from "../lib/logger";
import { recordOperationLog, withOperationLog } from "../lib/operation-logs";
import { clampStrength, getHostname, orderRelationPair } from "../lib/relations";
import { safeFetch } from "../lib/url-safety";
import { hasVectorSupport } from "../lib/vector";
import { enqueueWebhookEvent } from "../lib/webhooks";
import { installCrashHandlers, startHeartbeat } from "../lib/worker-heartbeat";

const llmProvider = process.env.LLM_PROVIDER ?? "google";
const llmModel = process.env.LLM_MODEL ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";

function resolveUrl(candidate: string | undefined, baseUrl: string) {
  if (!candidate) {
    return null;
  }

  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return null;
  }
}

async function extractTextFromUrl(url: string) {
  const startedAt = Date.now();
  try {
    const res = await safeFetch(url, { signal: AbortSignal.timeout(5000) });
    const html = await res.text();
    const crawlBytes = Buffer.byteLength(html, "utf8");
    if (!res.ok) {
      return {
        titleHint: "",
        content: "",
        imageUrl: null,
        crawlBytes,
        httpStatus: res.status,
        durationMs: Date.now() - startedAt,
        failureReason: res.statusText || `HTTP ${res.status}`,
      };
    }

    const $ = cheerio.load(html);

    const ogTitle = $('meta[property="og:title"]').attr("content");
    const ogDesc = $('meta[property="og:description"]').attr("content");
    const ogImage = $('meta[property="og:image"]').attr("content");
    const title = $("title").text().trim();
    const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 1000);

    return {
      titleHint: ogTitle || title,
      content: `${ogDesc || ""} ${bodyText}`.trim(),
      imageUrl: resolveUrl(ogImage, url),
      crawlBytes,
      httpStatus: res.status,
      durationMs: Date.now() - startedAt,
      failureReason: null,
    };
  } catch (error) {
    console.error(`Scraping failed for ${url}:`, error);
    return {
      titleHint: "",
      content: "",
      imageUrl: null,
      crawlBytes: 0,
      httpStatus: null,
      durationMs: Date.now() - startedAt,
      failureReason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function extractTextFromFile(filePath: string, mimeType: string | null) {
  try {
    const buffer = await fs.readFile(filePath);
    let text = "";

    if (mimeType === "application/pdf") {
      const data = await pdf(buffer);
      text = data.text;
    } else if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const data = await mammoth.extractRawText({ buffer });
      text = data.value;
    } else if (
      mimeType === "application/vnd.ms-excel" ||
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mimeType?.includes("spreadsheet") ||
      mimeType?.includes("excel")
    ) {
      const workbook = xlsx.read(buffer, { type: "buffer" });
      const firstSheet = workbook.SheetNames[0];
      text = firstSheet ? xlsx.utils.sheet_to_txt(workbook.Sheets[firstSheet]) : "";
    } else if (mimeType?.startsWith("text/")) {
      text = buffer.toString("utf8");
    }

    return text.slice(0, 3000);
  } catch (error) {
    console.error(`File extraction failed for ${filePath}:`, error);
    return null;
  }
}

async function buildRelations(item: {
  id: string;
  user_id: string;
  raw_url: string | null;
  url_host: string | null;
}) {
  try {
    if (!(await hasVectorSupport())) {
      return;
    }

    const similarResult = await db.query(
      `SELECT id,
              raw_url,
              1 - (embedding <=> (SELECT embedding FROM items WHERE id = $2)) AS similarity
       FROM items
       WHERE user_id = $1
         AND id != $2
         AND embedding IS NOT NULL
       ORDER BY embedding <=> (SELECT embedding FROM items WHERE id = $2)
       LIMIT 10`,
      [item.user_id, item.id],
    );

    for (const row of similarResult.rows) {
      const similarity = Number(row.similarity);
      if (similarity <= 0.75) {
        continue;
      }

      const [itemAId, itemBId] = orderRelationPair(item.id, row.id);
      await db.query(
        `INSERT INTO item_relations (user_id, item_a_id, item_b_id, relation_type, strength)
         VALUES ($1, $2, $3, 'ai_similar', $4)
         ON CONFLICT (item_a_id, item_b_id, relation_type)
         DO UPDATE SET strength = EXCLUDED.strength`,
        [item.user_id, itemAId, itemBId, clampStrength(similarity)],
      );
    }

    const hostname = item.url_host ?? getHostname(item.raw_url);
    if (!hostname) {
      return;
    }

    // Filter by hostname in SQL to avoid fetching all URL items into JS.
    const sameDomainResult = await db.query<{ id: string }>(
      `SELECT id
       FROM items
       WHERE user_id = $1
         AND id != $2
         AND url_host = $3`,
      [item.user_id, item.id, hostname],
    );

    for (const row of sameDomainResult.rows) {
      const [itemAId, itemBId] = orderRelationPair(item.id, row.id);
      await db.query(
        `INSERT INTO item_relations (user_id, item_a_id, item_b_id, relation_type, strength)
         VALUES ($1, $2, $3, 'ai_same_domain', $4)
         ON CONFLICT (item_a_id, item_b_id, relation_type)
         DO UPDATE SET strength = EXCLUDED.strength`,
        [item.user_id, itemAId, itemBId, 0.8],
      );
    }
  } catch (error) {
    console.error(`Relation building failed for ${item.id}:`, error);
  }
}

async function enrichItem(item: EnrichmentClaimItem) {
  const t0 = Date.now();
  logger.info("enrich", `Start ${item.id}`, { type: item.type });

  let content = "";
  let titleHint = item.title || "";
  let imageUrl: string | null = null;

  if (item.type === "url" && item.raw_url) {
    const extracted = await extractTextFromUrl(item.raw_url);
    if (extracted) {
      content = extracted.content;
      titleHint = extracted.titleHint || titleHint;
      imageUrl = extracted.imageUrl;
      await recordOperationLog({
        userId: item.user_id,
        itemId: item.id,
        operation: "crawl",
        provider: "http",
        status: extracted.failureReason ? "failed" : "succeeded",
        attemptCount: item.enrichment_attempt_count,
        durationMs: extracted.durationMs,
        crawlBytes: extracted.crawlBytes,
        failureReason: extracted.failureReason,
        metadata: { http_status: extracted.httpStatus, source_url: item.raw_url },
      });
    }
  } else if (item.type === "file" && item.file_path) {
    content = (await extractTextFromFile(item.file_path, item.file_mime_type)) || "";
    titleHint = item.file_name || titleHint;
  } else {
    content = item.raw_text || "";
    titleHint = titleHint || content.slice(0, 100);
  }

  const prompt = await buildEnrichmentPrompt({
    userId: item.user_id,
    titleHint,
    content,
    captureNote: item.capture_note,
  });

  try {
    const responseText = (
      await withOperationLog(
        {
          userId: item.user_id,
          itemId: item.id,
          operation: "ai_generate",
          provider: llmProvider,
          model: llmModel,
          attemptCount: item.enrichment_attempt_count,
          inputChars: prompt.length,
          outputChars: (value) => value.length,
        },
        () => generateText(prompt),
      )
    ).replace(/```json|```/g, "").trim();
    const enriched = JSON.parse(responseText) as {
      title?: string;
      summary?: string;
      tags?: string[];
      reminder?: string | null;
    };

    const title = (enriched.title || titleHint || "Untitled").slice(0, 80);
    const summary = enriched.summary || content.slice(0, 280);
    const tags = Array.isArray(enriched.tags)
      ? enriched.tags
          .map((tag) => String(tag).trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 7)
      : [];

    const embeddingInput = [title, summary, tags.join(" ")]
      .filter(Boolean)
      .join("\n");
    const vectorEnabled = await hasVectorSupport();
    const embedding = vectorEnabled
      ? await withOperationLog(
          {
            userId: item.user_id,
            itemId: item.id,
            operation: "embed",
            provider: "google",
            model: "text-embedding-004",
            attemptCount: item.enrichment_attempt_count,
            inputChars: embeddingInput.length,
          },
          () => embedText(embeddingInput),
        )
      : null;

    // Tiny base64 placeholder so the feed renders item thumbnails without
    // CLS while the real image loads. Computed best-effort; null is fine.
    const blurDataUrl = imageUrl ? await computeBlurDataUrl(imageUrl) : null;

    if (vectorEnabled) {
      await db.query(
        `UPDATE items
         SET title = $1,
             summary = $2,
             tags = $3,
             url_host = COALESCE(url_host, $8),
             image_url = COALESCE($4, image_url),
             blur_data_url = COALESCE($5, blur_data_url),
             enriched = true,
             enriched_at = NOW(),
             updated_at = NOW(),
             embedding = $6::vector
         WHERE id = $7`,
        [
          title,
          summary,
          tags,
          imageUrl,
          blurDataUrl,
          embedding ? JSON.stringify(embedding) : null,
          item.id,
          getHostname(item.raw_url),
        ],
      );
    } else {
      await db.query(
        `UPDATE items
         SET title = $1,
             summary = $2,
             tags = $3,
             url_host = COALESCE(url_host, $7),
             image_url = COALESCE($4, image_url),
             blur_data_url = COALESCE($5, blur_data_url),
             enriched = true,
             enriched_at = NOW(),
             updated_at = NOW()
         WHERE id = $6`,
        [title, summary, tags, imageUrl, blurDataUrl, item.id, getHostname(item.raw_url)],
      );
    }

    if (enriched.reminder) {
      // Only insert if no unsent reminder already exists for this item.
      const existing = await db.query(
        "SELECT id FROM reminders WHERE item_id = $1 AND sent = FALSE LIMIT 1",
        [item.id],
      );
      if ((existing.rowCount ?? 0) === 0) {
        await db.query(
          `INSERT INTO reminders (item_id, user_id, remind_at)
           VALUES ($1, $2, $3)`,
          [item.id, item.user_id, enriched.reminder],
        );
      }
    }

    await enqueueWebhookEvent({
      userId: item.user_id,
      event: "item.enriched",
      itemId: item.id,
      data: {
        id: item.id,
        title,
        tags,
        enriched_at: new Date().toISOString(),
      },
    }).catch((error) => {
      logger.warn("webhooks", "Failed to enqueue item.enriched webhook", {
        itemId: item.id,
        error: String(error),
      });
    });

    await withOperationLog(
      {
        userId: item.user_id,
        itemId: item.id,
        operation: "relation_build",
        attemptCount: item.enrichment_attempt_count,
      },
      () => buildRelations(item),
    );
    logger.info("enrich", `Done ${item.id}`, { ms: Date.now() - t0 });
  } catch (error) {
    logger.error("enrich", `Failed ${item.id}`, { ms: Date.now() - t0, error: String(error) });
    throw error;
  }
}

async function startWorker() {
  installCrashHandlers("enrich");
  startHeartbeat("enrichment");
  logger.info("enrich", "Enrichment worker started", { pid: process.pid });

  while (true) {
    try {
      const items = await claimEnrichmentItems(db);

      for (const item of items) {
        try {
          await enrichItem(item);
          await markEnrichmentSucceeded(db, item.id);
        } catch (error) {
          const failed = await markEnrichmentFailed(db, item.id, error);
          const message =
            failed?.enrichment_status === "failed" ? `Marked failed ${item.id}` : `Queued retry ${item.id}`;
          logger.warn("enrich", message, {
            attempts: failed?.enrichment_attempt_count,
            status: failed?.enrichment_status,
          });
        }
      }
    } catch (error) {
      logger.error("enrich", "Batch failed", { error: String(error) });
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

void startWorker();
