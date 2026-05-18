# Deployment and Infrastructure Architecture

> Scope: Infrastructure setup, database migrations, background worker daemons, and system runtime configuration.
> Rendering context: Server-side
> Project tier: 4
> Last updated: 2026-05-17

## Overview
Recall is deployed as an isomorphic Next.js application that runs on a Node.js environment. It connects to a local, system-installed PostgreSQL database on Windows (port 5432 or connection string defined in DATABASE_URL). The application architecture features the main web server running on port 3008 and two separate TypeScript-based background worker daemons running as persistent processes.

## Build and Execution Lifecycle
- Local Development: Initiated by running next dev in the project root. The web client and API endpoints are served from port 3008.
- Production Build: Executed by running next build, which outputs a compiled server bundle inside the dot-next folder, followed by next start to serve the production app.
- Database Migrations: Handled sequentially through Node.js runner files. Running the migrate script executes migrations/001_initial.sql through migrations/005_add_billing.sql. A second migrate-latest script is available to apply the newest schema additions.
- Telegram Webhook Registration: Initiated via register-telegram-webhook script, which calls setTelegramWebhook helper with the Telegram Bot API using the configured host URL.

## Background Worker Daemons
Recall moves heavy, long-running tasks out of API response threads and delegates them to two separate TSX-based worker daemons that must run continuously in both development and production.

### Item Enrichment Worker
- Path: workers/enrichment-worker.ts
- Execution command: dotenv run tsx workers/enrichment-worker.ts
- Polling Cycle: Infinite loop that queries the database every 5 seconds for unenriched archive items.
- Ingestion Flow: Reads raw notes, scrapes URLs using cheerio, or extracts files (mammoth for DOCX, pdf-parse for PDF, xlsx for spreadsheets). It then compiles a prompt, calls Gemini to extract metadata (title, summary, tags, reminder), computes vector embeddings, and writes results to the database.
- Relation building: Triggers vector similarity matching against other items in the user's archive and registers matching domains to generate item relations.

### Reminders Worker
- Path: workers/reminder-worker.ts
- Execution command: tsx workers/reminder-worker.ts
- Polling Cycle: Infinite loop polling every 60 seconds for due reminders.
- Processing Flow: Checks the reminders table for entries where remind_at is equal to or older than the current timestamp and sent is false. It sends the reminder via active channels (email via Resend or HTML-formatted Telegram messages), marks them sent, and triggers a monthly reset check to set all saves_this_month counters in the users table back to zero at the start of each month.

## Production Constraints
- AGENT AVOID: Never trigger scraping, AI synthesis, or vector generation inside the web API route handlers. These must always remain asynchronous and be delegated exclusively to workers/enrichment-worker.ts.
- AGENT NOTE: When deploying to staging or production, ensure both background workers are managed by a process manager (such as PM2) to restart them automatically if they crash due to network issues.

## Update Triggers
- When the execution scripts or dependency runners in package.json change.
- When background worker polling durations or startup arguments are altered.
- When the database migration strategy or webhook registration process is changed.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Connects background workers to tech stack.
- [docs/api/database.md](file:///e:/Projects/recallQ/docs/api/database.md) — Details tables read/written by workers.
- [docs/modules/capture.md](file:///e:/Projects/recallQ/docs/modules/capture.md) — Focuses on item ingestion.

AGENT OWNER: package.json
AGENT UPDATE: docs/infra/deployment.md
