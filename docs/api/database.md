# Database Schema

> **Scope:** This document describes the PostgreSQL database schema, including tables, key columns, and their relationships. **Rendering context:** N/A **Last updated:** auto

## Overview

The project uses a PostgreSQL database. The schema is managed through SQL migration files located in the `/migrations` directory. The database serves as the single source of truth for all user data, content, and application state. The `pg` library is used for database access, with queries consolidated in the `/lib` directory.

## ORM and Migrations

- **ORM:** The project does not use a traditional ORM. It uses the `pg` library to execute raw SQL queries.
  - **AGENT OWNER:** `lib/db.ts` is responsible for creating and exporting the database connection pool.
- **Migrations:** Schema changes are managed with plain SQL files in `/migrations`. A custom script (`scripts/migrate.js`) applies these migrations.
  - **AGENT NOTE:** To make a schema change, create a new numbered SQL file in `/migrations` and then run the migration script.

---

## Core Tables

### `users`
- **Purpose:** Stores user profile and authentication information. This table is central to the application's multi-tenant design.
- **Key Columns:**
  - `id`: Primary key (UUID).
  - `email`: Unique email for login.
  - `plan`: The user's subscription plan (e.g., 'free', 'pro'). Governs access to features and limits.
  - `saves_this_month`: A counter used to enforce plan limits.
  - `inbound_email_address`: A unique, secret email address for the email ingestion feature.
  - `razorpay_customer_id`, `razorpay_subscription_id`: Columns for managing billing and subscriptions via Razorpay.

### `items`
- **Purpose:** The most important table in the application. Stores every piece of content (note, URL, file) as an "Item".
- **Relationships:** Belongs to a `user` and can optionally belong to a `collection`.
- **Key Columns:**
  - `id`: Primary key (UUID).
  - `user_id`: Foreign key to `users.id`. All items are owned by a user.
  - `type`: The type of item ('url', 'text', 'file', 'note').
  - `raw_url`, `raw_text`, `file_path`: Stores the original, unprocessed content.
  - `enriched`: A boolean flag (`false` by default) that signals the item is ready for processing by the enrichment worker.
  - `title`, `summary`, `tags`: Populated by the AI enrichment worker.
  - `embedding`: A `vector(768)` column storing the embedding for similarity searches. Added conditionally if the `pgvector` extension is available.
    - **AGENT SEE:** `docs/modules/enrichment.md#vector-embeddings`

### `item_relations`
- **Purpose:** Acts as a join table to create a graph structure between items. These are the "edges" of the knowledge graph.
- **Relationships:** Links two `items` (`item_a_id` and `item_b_id`) and belongs to a `user`.
- **Key Columns:**
  - `item_a_id`, `item_b_id`: Foreign keys to `items.id`.
  - `relation_type`: The reason for the relationship (e.g., `ai_similar`, `user_linked`).
  - `strength`: A float value used for weighting edges in the graph visualization.

### `collections`
- **Purpose:** Allows users to group items into named collections.
- **Relationships:** Belongs to a `user`. Has many `items`.
- **Key Columns:**
  - `id`: Primary key (UUID).
  - `user_id`: Foreign key to `users.id`.
  - `name`: The user-defined name of the collection.

---

## Feature-Specific Tables

### `reminders`
- **Purpose:** Stores information about reminders set on items.
- **Relationships:** Belongs to an `item` and a `user`.
- **Process:** A separate worker (`workers/reminder-worker.ts`) polls this table for due reminders.
- **Key Columns:**
  - `remind_at`: The timestamp when the reminder is due.
  - `sent`: A boolean flag to indicate if the reminder has been sent.
  - `channels`: An array of channels to send the reminder to (e.g., `email`, `telegram`).

### `item_comments`
- **Purpose:** Stores comments made by users on an item.
- **Relationships:** Belongs to an `item` and a `user`.
- **Key Columns:**
  - `id`: Primary key (UUID).
  - `item_id`: The item the comment is on.
  - `user_id`: The user who wrote the comment.
  - `body`: The text content of the comment.

---

## NextAuth.js Tables
These tables are standard for the `next-auth` library with a database adapter and are used to manage sessions and OAuth accounts.

- **`accounts`**: Stores provider information for users who sign in with OAuth (e.g., Google).
- **`sessions`**: Stores user session information.
- **`verification_token`**: Used for passwordless email sign-in.

## Related Docs
- [docs/architecture/data-flow.md] — Explains how data flows into and out of these tables.
- [docs/migrations/*.sql] — The source of truth for the exact schema definitions.
