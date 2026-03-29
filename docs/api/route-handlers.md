# API Route Handlers

> **Scope:** This document lists and describes all the API route handlers in the `/app/api` directory. **Rendering context:** Server **Last updated:** auto

## Overview

API Route Handlers are used for tasks that cannot be handled by Server Actions or need to be called from external services (webhooks). Most routes require authentication and perform a specific, narrow function. They primarily act as a server-side gateway to the business logic defined in the `/lib` directory.

---

## Authentication & User

### `GET /api/auth/[...nextauth]`
- **File:** `app/api/auth/[...nextauth]/route.ts`
- **Purpose:** The catch-all route for NextAuth.js. Handles all authentication strategies, including sign-in, sign-out, session creation, and provider callbacks.
- **Auth:** Public (handles the authentication process itself).

### `GET /api/me`
- **File:** `app/api/me/route.ts`
- **Purpose:** Fetches profile information for the currently authenticated user.
- **Auth:** Required.

---

## Ingestion

### `POST /api/ingest`
- **File:** `app/api/ingest/route.ts`
- **Purpose:** The central endpoint for all new data captured in the system. Accepts single or bulk items.
- **Auth:** Required (uses a special ingestion token).
- **AGENT SEE:** `docs/architecture/data-flow.md#2-ingestion-the-single-funnel`

### `POST /api/email/inbound`
- **File:** `app/api/email/inbound/route.ts`
- **Purpose:** A webhook to receive inbound emails. It parses the email content and forwards it to the `/api/ingest` endpoint.
- **Auth:** Public (security is handled by the obscurity of the webhook URL and/or provider signature verification).

### `POST /api/telegram/webhook`
- **File:** `app/api/telegram/webhook/route.ts`
- **Purpose:** A webhook to receive messages from the user's connected Telegram bot. It processes the message and forwards it to the `/api/ingest` endpoint.
- **Auth:** Public (security is handled by a secret in the webhook URL).

---

## Core Data Models

### Items
- **`GET /api/items`**: Lists all items for the current user.
  - **File:** `app/api/items/route.ts`
  - **Auth:** Required.
- **`GET /api/items/[id]`**: Retrieves a single item by its ID.
  - **File:** `app/api/items/[id]/route.ts`
  - **Auth:** Required.
- **`GET /api/items/[id]/comments`**: Fetches comments for a specific item.
  - **File:** `app/api/items/[id]/comments/route.ts`
  - **Auth:** Required.
- **`GET /api/items/[id]/related`**: Fetches items related to a specific item.
  - **File:** `app/api/items/[id]/related/route.ts`
  - **Auth:** Required.

### Collections
- **`GET, POST /api/collections`**: Lists all collections or creates a new one.
  - **File:** `app/api/collections/route.ts`
  - **Auth:** Required.
- **`GET, PUT, DELETE /api/collections/[id]`**: Retrieves, updates, or deletes a single collection.
  - **File:** `app/api/collections/[id]/route.ts`
  - **Auth:** Required.

### Reminders
- **`GET, POST /api/reminders`**: Lists all reminders or creates a new one.
  - **File:** `app/api/reminders/route.ts`
  - **Auth:** Required.
- **`GET, DELETE /api/reminders/[id]`**: Retrieves or deletes a single reminder.
  - **File:** `app/api/reminders/[id]/route.ts`
  - **Auth:** Required.

---

## Features

### `POST /api/chat`
- **File:** `app/api/chat/route.ts`
- **Purpose:** Handles requests for the AI chat functionality. Likely streams responses from the Gemini API.
- **Auth:** Required.

### `GET /api/graph`
- **File:** `app/api/graph/route.ts`
- **Purpose:** Fetches the nodes (items) and edges (relations) required to render the knowledge graph.
- **Auth:** Required.

### `POST /api/search`
- **File:** `app/api/search/route.ts`
- **Purpose:** Performs a full-text or vector search over the user's items.
- **Auth:** Required.

### `POST /api/actions/preview`
- **File:** `app/api/actions/preview/route.ts`
- **Purpose:** Takes a string of text and returns a preview of the actions (tags, reminders, etc.) that would be inferred from it. Used by the `CaptureBar` component.
- **Auth:** Required.

### `GET /api/files/[...path]`
- **File:** `app/api/files/[...path]/route.ts`
- **Purpose:** Securely serves files associated with items. The path likely includes the user ID and item ID to ensure authorization.
- **Auth:** Required.

---

## Integrations

### Telegram
- **`GET /api/user/telegram-token`**: Generates a new, short-lived token for linking a Telegram account.
  - **File:** `app/api/user/telegram-token/route.ts`
  - **Auth:** Required.
- **`POST /api/user/telegram-link`**: Uses the token to create the link between the user and their Telegram chat ID.
  - **File:** `app/api/user/telegram-link/route.ts`
  - **Auth:** Required.
- **`GET /api/user/telegram-status`**: Checks if the user's Telegram account is successfully linked.
  - **File:** `app/api/user/telegram-status/route.ts`
  - **Auth:** Required.

### Payments
- **`POST /api/payments/create-subscription`**: Creates a payment session (e.g., with Stripe Checkout) to start a new subscription.
  - **File:** `app/api/payments/create-subscription/route.ts`
  - **Auth:** Required.
- **`POST /api/payments/cancel-subscription`**: Cancels the user's active subscription.
  - **File:** `app/api/payments/cancel-subscription/route.ts`
  - **Auth:** Required.
- **`POST /api/payments/webhook`**: A webhook to receive events from the payment provider (e.g., subscription created, payment failed).
  - **File:** `app/api/payments/webhook/route.ts`
  - **Auth:** Public (signature verification performed).

## Related Docs

- [docs/architecture/data-flow.md] — Shows how ingestion routes fit into the overall data lifecycle.
- [docs/lib/request-auth.md] — Describes the helpers used to authenticate requests in these routes.
