# Module: Enrichment

> **Scope:** This document describes the asynchronous AI-powered enrichment module. **Rendering context:** Server **Last updated:** auto

## Overview

The enrichment module is a background process responsible for taking raw, newly ingested `Items` and adding structured, AI-generated metadata to them. This process is what transforms a simple piece of text or a URL into a rich, connected piece of knowledge. The entire module runs outside of the main Next.js application lifecycle to prevent blocking user requests.

## The Enrichment Worker

- **Owner:** `workers/enrichment-worker.ts`
- **Execution:** This script is run as a long-running, standalone Node.js process (e.g., using `tsx workers/enrichment-worker.ts`).
- **Process:**
  1.  **Polling:** The worker runs an infinite loop that polls the `items` table every 5 seconds, looking for up to 5 records where `enriched = false`.
  2.  **Delegation:** For each found item, it calls the `enrichItem` function.

## The `enrichItem` Function

This function contains the core logic for processing a single item.

### 1. Content Extraction
The first step is to get a unified plain text representation of the item's content.
- **URL Items:** The worker fetches the URL, then uses `cheerio` to scrape the HTML content, prioritizing the `og:title`, `og:description`, and main body text.
- **File Items:** The worker reads the file from disk (path determined during ingestion) and uses specialized libraries to extract text:
  - `pdf-parse` for PDFs.
  - `mammoth` for DOCX files.
  - `xlsx` for Excel spreadsheets.
  - Plain text for `text/*` MIME types.
- **Text/Note Items:** The worker simply uses the `raw_text` field.

### 2. AI Enrichment with Gemini
- **Library:** `lib/gemini.ts` which uses `@google/generative-ai`.
- **Prompt:** A detailed prompt is constructed, providing the extracted text, any title hints, and the user's original capture note. It explicitly asks the model to return a JSON object with a specific shape.
- **Output:** The worker parses the JSON response from the Gemini API to get the following fields:
  - `title`: A concise title.
  - `summary`: A 2-3 sentence summary.
  - `tags`: An array of relevant tags.
  - `reminder`: An optional suggested reminder date/time.

### 3. Vector Embeddings
- **Purpose:** To enable semantic search and similarity-based relation building.
- **Process:**
  1. The new AI-generated `title`, `summary`, and `tags` are combined into a single string.
  2. This string is passed to the `embedText` function in `lib/gemini.ts`.
  3. This function calls the Google Gemini embedding model to generate a 768-dimension vector.
  - **AGENT NOTE:** This step is only performed if `hasVectorSupport()` in `lib/vector.ts` returns true, which checks if the `vector` extension is available in the database.

### 4. Database Update
Once all data is generated, the worker updates the original `item` record in the database:
- It sets `enriched` to `true`.
- It populates the `title`, `summary`, `tags`, and `image_url` fields.
- It stores the generated vector in the `embedding` column.
- It sets the `enriched_at` timestamp.

### 5. Relation Building
- **Function:** `buildRelations(item)`
- **Purpose:** To automatically create edges in the knowledge graph.
- **Process:**
  - **Similarity:** It uses the new `embedding` to query for the 10 most similar items using vector distance (`L2`). If the similarity score is above a threshold (0.75), an `ai_similar` relation is created in the `item_relations` table.
  - **Domain:** For URL items, it finds other items from the same hostname and creates `ai_same_domain` relations.

## Related Docs
- [docs/architecture/data-flow.md] — Shows how enrichment follows ingestion in the data lifecycle.
- [docs/api/database.md] — Details the `items` and `item_relations` tables.
- [docs/lib/gemini.md] — [PLACEHOLDER: Create this doc to explain Gemini API usage and prompts].
