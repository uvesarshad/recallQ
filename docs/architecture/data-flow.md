# Data Flow

> **Scope:** This document describes the lifecycle of data within the Recally application, from initial capture to final presentation. **Rendering context:** Server/Isomorphic **Last updated:** auto

## Overview

Data in Recally follows a unidirectional, asynchronous flow. It begins with "capture" from various sources, moves into a central "ingestion" pipeline, is processed by a background "enrichment" worker, and is finally stored and indexed in the database. UI components then read this processed data from the database to display to the user.

## 1. Capture: The Entry Points

Data enters the system from multiple sources. Each source is a "capture" point.

- **Web UI:** The primary capture method is via the `CaptureBar.tsx` component in the main application UI. This allows for submitting text, URLs, or notes.
- **PWA Share Target:** On mobile devices, Recally can be a share target. The OS sends the shared content to `app/(app)/share-target/route.ts`, which forwards it to the ingestion API.
- **Email:** Users can email content to a dedicated address. An external email service (e.g., Resend, Postmark) receives the email and forwards it to the `app/api/email/inbound/route.ts` webhook.
- **Telegram:** Users can send messages to a configured Telegram bot. The Telegram API sends a webhook to `app/api/telegram/webhook/route.ts`.
- **Manual/Other:** The system is designed to accommodate other sources, marked as `manual` or `extension`.

## 2. Ingestion: The Single Funnel

All captured data, regardless of source, is funneled through a single API endpoint.

- **Endpoint:** `POST /api/ingest`
- **Owner:** `app/api/ingest/route.ts`
- **Process:**
  1.  The route handler receives a request containing the raw data (URL, text, file, etc.) and source metadata.
  2.  It authenticates the request to identify the user using helpers from `lib/request-auth.ts`.
  3.  It delegates the core logic to the `ingestItem` function.
      - **AGENT OWNER:** `lib/ingest.ts`
  4.  `ingestItem` performs the following actions:
      - Validates the user's plan limits (`lib/plan-limits.ts`).
      - If a file is included, it is saved to storage via `lib/storage.ts`.
      - A new record is created in the `items` database table with `enriched = false`.
      - The function returns a success response, and the ingestion phase is complete.

## 3. Enrichment: The AI Worker

A background worker process continuously scans for and processes new, unenriched items.

- **Worker Script:** `workers/enrichment-worker.ts`
- **Process:**
  1.  The worker polls the `items` table for records where `enriched = false`.
  2.  For each item, it extracts the full text content. If it's a URL, it scrapes the web page; if it's a file, it parses the document.
  3.  It constructs a prompt and calls the Google Gemini API (via `lib/gemini.ts`) to generate a title, summary, and tags for the content.
  4.  It generates a vector embedding from the enriched text.
      - **AGENT SEE:** `docs/modules/enrichment.md#vector-embeddings`
  5.  It updates the item record in the database, setting `enriched = true` and populating the `title`, `summary`, `tags`, and `embedding` fields.

## 4. Relation Building: Creating the Graph

Immediately after an item is enriched, the worker attempts to connect it to existing items.

- **Owner:** `workers/enrichment-worker.ts` (specifically the `buildRelations` function)
- **Process:**
  1.  **Similarity Search:** It uses the new item's vector embedding to find the most similar items in the database for that user (using `L2` distance on the `embedding` column).
  2.  **Domain Search:** If the item is a URL, it searches for other items from the same hostname.
  3.  **Relation Creation:** For each strong match found, it inserts a new row into the `item_relations` table, linking the two items and specifying the relation type (`ai_similar`, `ai_same_domain`).

## 5. Presentation: Reading the Data

Once data is enriched and stored, it is read by the application's UI.

- **Data Fetching:** Server Components (e.g., page components in `/app/(app)`) fetch data directly from the database by calling functions in the `lib/` directory.
- **Example:** The main feed page (`app/(app)/app/page.tsx`) likely queries the `items` table for the user's most recent items.
- **Graph Visualization:** The `app/(app)/graph/page.tsx` fetches data for the `KnowledgeMap.tsx` component, which queries both the `items` and `item_relations` tables to build the graph visualization.
- **Client Components:** Interactive Client Components fetch data by calling the application's API routes, for example, to get comments or related items for an `ItemDetailModal.tsx`.

## Related Docs

- [docs/modules/ingestion.md] — Deep dive into the ingestion sources and logic.
- [docs/modules/enrichment.md] — Details on the AI models and prompts used.
- [docs/api/database.md] — Schema for the `items` and `item_relations` tables.
