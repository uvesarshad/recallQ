# Module: Ingestion

> **Scope:** This document provides a detailed look at the data ingestion module, covering all capture points and the central processing logic. **Rendering context:** Server **Last updated:** auto

## Overview

The ingestion module is responsible for receiving data from various external and internal sources and creating a new `Item` in the database. The entire process is designed to be a funnel, with all sources leading to a single, authoritative API endpoint (`/api/ingest`) which in turn calls a single, authoritative library function (`ingestItem`).

## Central Logic

- **API Endpoint:** `POST /api/ingest`
  - **Owner:** `app/api/ingest/route.ts`
  - **Function:** Acts as the gateway for all ingestion. It validates the request, authenticates the user, and calls `ingestItem`. It can handle both single item and bulk ingestion payloads.
- **Core Library Function:** `ingestItem(payload: IngestPayload)`
  - **Owner:** `lib/ingest.ts`
  - **Function:** This is the heart of the ingestion module. It performs all the critical business logic:
    1.  Checks user's plan and rate limits (`lib/plan-limits.ts`).
    2.  Handles file validation and storage (`lib/storage.ts`).
    3.  Infers actions like tags and reminders from the text (`lib/comment-actions.ts`).
    4.  Inserts the final record into the `items` table with `enriched = false`.

---

## Ingestion Sources

### 1. Web Application
- **Component:** `components/CaptureBar.tsx`
- **Flow:**
  1. This client component captures user input (text, URLs).
  2. It makes a `fetch` request to `POST /api/ingest`.
  3. The request body contains the content, a `type` of 'text' or 'url', and a `source` of 'web'.

### 2. Email
- **Webhook:** `POST /api/email/inbound/route.ts`
- **Flow:**
  1. An external email provider (e.g., Resend) is configured to forward emails sent to a user's unique `inbound_email_address` to this webhook.
  2. The webhook handler parses the email's `From`, `Subject`, and `body`.
  3. It identifies the user based on the `inbound_email_address`.
  4. It calls the `ingestItem` function with the email content, a `type` of 'email', and a `source` of 'email'.
- **AGENT NOTE:** The user's unique inbound address is generated upon user creation.

### 3. Telegram
- **Webhook:** `POST /api/telegram/webhook/route.ts`
- **Flow:**
  1. The user connects their account to a Recally Telegram bot.
  2. When the user sends a message to the bot, Telegram sends a request to this webhook.
  3. The handler authenticates the request using a secret token in the URL.
  4. It identifies the user via their `telegram_chat_id`.
  5. It calls the `ingestItem` function with the message content, `type` of 'text' or 'url', and `source` of 'telegram'.

### 4. PWA Share Target
- **Route:** `app/(app)/share-target/route.ts`
- **Flow:**
  1. On a mobile device where the PWA is installed, the user can "share" content (like a URL from a browser) to Recally.
  2. The operating system opens this route and passes the shared data as URL parameters.
  3. This route is a simple server-side page that extracts the shared data and forwards it to the `/api/ingest` endpoint.
  4. The `source` is set to 'pwa-share'.

## Ingest Payload

The `IngestPayload` interface in `lib/ingest.ts` defines the shape of the data passed to the `ingestItem` function. It includes fields for:
- `userId`
- `type` ('url', 'text', 'file', 'note')
- `source` ('web', 'telegram', 'email', etc.)
- `raw_url`, `raw_text`
- `fileBuffer`, `fileName`, `fileMimeType`
- Optional overrides for tags, collections, and reminders.

## Related Docs
- [docs/architecture/data-flow.md] — Provides the high-level context for where ingestion fits.
- [docs/api/route-handlers.md] — Details the API signature for the ingestion webhooks.
- [docs/api/database.md] — Describes the `items` table that the ingestion module writes to.
