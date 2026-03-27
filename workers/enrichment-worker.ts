import dotenv from "dotenv";
dotenv.config();

import * as cheerio from "cheerio";
import fs from "fs/promises";
import mammoth from "mammoth";
const pdf = require("pdf-parse");
import * as xlsx from "xlsx";

import { db } from "../lib/db";
import { embedText, getGeminiModel } from "../lib/gemini";
import { clampStrength, getHostname, orderRelationPair } from "../lib/relations";
import { hasVectorSupport } from "../lib/vector";

const model = getGeminiModel();

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
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      return null;
    }

    const html = await res.text();
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
    };
  } catch (error) {
    console.error(`Scraping failed for ${url}:`, error);
    return null;
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

    const hostname = getHostname(item.raw_url);
    if (!hostname) {
      return;
    }

    const sameDomainResult = await db.query(
      `SELECT id, raw_url
       FROM items
       WHERE user_id = $1
         AND id != $2
         AND raw_url IS NOT NULL`,
      [item.user_id, item.id],
    );

    for (const row of sameDomainResult.rows) {
      if (getHostname(row.raw_url) !== hostname) {
        continue;
      }

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

async function enrichItem(item: any) {
  console.log(`Enriching item ${item.id} (${item.type})...`);

  let content = "";
  let titleHint = item.title || "";
  let imageUrl: string | null = null;

  if (item.type === "url" && item.raw_url) {
    const extracted = await extractTextFromUrl(item.raw_url);
    if (extracted) {
      content = extracted.content;
      titleHint = extracted.titleHint || titleHint;
      imageUrl = extracted.imageUrl;
    }
  } else if (item.type === "file" && item.file_path) {
    content = (await extractTextFromFile(item.file_path, item.file_mime_type)) || "";
    titleHint = item.file_name || titleHint;
  } else {
    content = item.raw_text || "";
    titleHint = titleHint || content.slice(0, 100);
  }

  const prompt = `
You are a content enrichment assistant. Return ONLY valid JSON, no markdown, no preamble.

Content:
Title hint: ${titleHint || "None"}
Body: ${content || "None"}
User note at capture: ${item.capture_note || "None"}

Return this exact shape:
{
  "title": "clear concise title, max 80 chars",
  "summary": "2–3 sentence summary",
  "tags": ["tag1", "tag2"],
  "reminder": null
}

Today's date: ${new Date().toISOString()}. Default time: 09:00 IST.
`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().replace(/```json|```/g, "").trim();
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
    const embedding = vectorEnabled ? await embedText(embeddingInput) : null;

    if (vectorEnabled) {
      await db.query(
        `UPDATE items
         SET title = $1,
             summary = $2,
             tags = $3,
             image_url = COALESCE($4, image_url),
             enriched = true,
             enriched_at = NOW(),
             updated_at = NOW(),
             embedding = $5::vector
         WHERE id = $6`,
        [title, summary, tags, imageUrl, embedding ? JSON.stringify(embedding) : null, item.id],
      );
    } else {
      await db.query(
        `UPDATE items
         SET title = $1,
             summary = $2,
             tags = $3,
             image_url = COALESCE($4, image_url),
             enriched = true,
             enriched_at = NOW(),
             updated_at = NOW()
         WHERE id = $5`,
        [title, summary, tags, imageUrl, item.id],
      );
    }

    if (enriched.reminder) {
      await db.query(
        `INSERT INTO reminders (item_id, user_id, remind_at)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [item.id, item.user_id, enriched.reminder],
      );
    }

    await buildRelations(item);
    console.log(`Successfully enriched item ${item.id}`);
  } catch (error) {
    console.error(`Enrichment failed for ${item.id}:`, error);
  }
}

async function startWorker() {
  console.log("Enrichment worker started.");

  while (true) {
    try {
      const result = await db.query(
        `SELECT id, user_id, type, raw_url, raw_text, file_path, file_name, file_mime_type, capture_note, title
         FROM items
         WHERE enriched = false
         ORDER BY created_at ASC
         LIMIT 5`,
      );

      for (const item of result.rows) {
        await enrichItem(item);
      }
    } catch (error) {
      console.error("Worker batch failed:", error);
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

startWorker();
