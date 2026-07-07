# Deployment and Infrastructure Architecture

> Scope: Infrastructure setup, database migrations, background worker daemons, and system runtime configuration.
> Rendering context: Server-side
> Project tier: 4
> Last updated: 2026-07-07

## Overview
Recall deploys the `apps/web` Next.js app on Node.js with PostgreSQL configured by `DATABASE_URL`. The production shape is a web server plus separate TypeScript worker daemons for enrichment, reminders, and generic queued jobs.

## Build and Execution Lifecycle
- Local Development: Run `pnpm dev` from the workspace root. Turborepo starts `@recall/web`, whose app script runs `next dev -p 3008`.
- Production Build: Run `pnpm build` from the workspace root, or `pnpm --filter @recall/web build` for the app only. The web app uses Next standalone output.
- Production Start: Run `pnpm start` from the workspace root, or `pnpm --filter @recall/web start` for the app only. The app script serves on port 3008.
- Database Migrations: Run `pnpm db:migrate` for the base migration runner or `pnpm db:migrate:latest` for the latest additions.
- Telegram Webhook Registration: Run `pnpm telegram:webhook`, which calls the Telegram Bot API using the configured host URL.
- Operator Queue Inspection: Run `pnpm admin:jobs -- queue-depth` or `node scripts/admin-jobs.mjs operation-summary`. Mutating actions such as `retry-failed`, `re-enrich-failed`, `backfill-hosts`, and `archive-retention` are dry-run by default and require `--apply`.
- OpenAPI Generation: Run `pnpm openapi:generate` to refresh `docs/openapi.json`.
- CLI Client: Run `pnpm recall login ...`, then `pnpm recall search "query"`. `RECALL_API_URL` and `RECALL_TOKEN` still override local config for automation.
- MCP Server: Run `pnpm mcp` with `RECALL_API_URL` and `RECALL_TOKEN` for stdio MCP archive tools.

## Background Worker Daemons
Recall moves heavy, long-running tasks out of API response threads and delegates them to separate TSX-based worker daemons that must run continuously in both development and production.

### Item Enrichment Worker
- Path: `apps/web/workers/enrichment-worker.ts`
- Execution command: `pnpm worker:enrich` from the workspace root.
- Polling Cycle: Infinite loop that queries the database every 5 seconds for unenriched archive items.
- Ingestion Flow: Reads raw notes, scrapes URLs using cheerio, or extracts files (mammoth for DOCX, pdf-parse for PDF, xlsx for spreadsheets). It then compiles a prompt, calls Gemini to extract metadata (title, summary, tags, reminder), computes vector embeddings, and writes results to the database.
- Relation building: Triggers vector similarity matching against other items in the user's archive and registers matching domains to generate item relations.

### Reminders Worker
- Path: `apps/web/workers/reminder-worker.ts`
- Execution command: `pnpm worker:reminders` from the workspace root.
- Polling Cycle: Infinite loop polling every 60 seconds for due reminders.
- Processing Flow: Checks the reminders table for entries where remind_at is equal to or older than the current timestamp and sent is false. It sends the reminder via active channels (email via Resend or HTML-formatted Telegram messages), marks them sent, and triggers a monthly reset check to set all saves_this_month counters in the users table back to zero at the start of each month.

### Jobs Worker
- Path: `apps/web/workers/job-worker.ts`
- Execution command: `pnpm worker:jobs` from the workspace root.
- Polling Cycle: Every 30 seconds it schedules due RSS feeds and claims generic `jobs` rows with `FOR UPDATE SKIP LOCKED`.
- Processing Flow: Handles RSS feed imports, queued external imports, page archive jobs, outbound webhook delivery/retry jobs, and hourly archive-retention cleanup. It records job-level operation logs and keeps these queues separate from enrichment and reminders so slow webhooks or archive fetches do not starve core workers.

## Self-Host Docker Compose
`docker-compose.selfhost.yml` and `Dockerfile.selfhost` provide a small self-host package with web, enrichment worker, reminder worker, generic job worker, PostgreSQL/pgvector, and a local file-storage volume. See `docs/infra/self-host-docker.md`.

## Kubernetes Helm
`deploy/helm/recallq` provides a minimal chart for web, workers, shared archive storage, service, optional ingress, ConfigMap, and Secret. See `docs/infra/kubernetes-helm.md`.

## Production Constraints
- AGENT AVOID: Never trigger scraping, AI synthesis, or vector generation inside web API route handlers. These must remain asynchronous and be delegated to `apps/web/workers/enrichment-worker.ts`.
- AGENT NOTE: When deploying to staging or production, ensure all background workers are managed by a process manager (such as PM2, systemd, Docker restart policies, or an orchestrator) to restart them automatically if they crash due to network issues.

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
