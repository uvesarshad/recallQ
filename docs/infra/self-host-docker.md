# Self-Host Docker Compose

> Scope: Docker Compose runtime for local or small self-hosted RecallQ installs.
> Rendering context: Server-side
> Project tier: 4
> Last updated: 2026-07-07

## Overview
`docker-compose.selfhost.yml` runs the web app, enrichment worker, reminder worker, generic job worker, PostgreSQL with pgvector, and a local file-storage volume. It is the first self-host package before Kubernetes or Helm packaging.

## Services
- `postgres`: `pgvector/pgvector:pg16`, persistent `recall-postgres` volume, and `pg_isready` healthcheck.
- `web`: builds `Dockerfile.selfhost`, runs migrations, then starts `@recall/web` on port 3008.
- `worker-enrich`: runs `pnpm worker:enrich` for enrichment and archive jobs.
- `worker-reminders`: runs `pnpm worker:reminders` for reminder delivery and monthly usage reset.
- `worker-jobs`: runs `pnpm --filter @recall/web worker:jobs` for generic queued jobs such as RSS imports.
- `recall-files`: shared file volume mounted at `/data/files` through `FILES_BASE_PATH`.

## Usage
1. Replace `AUTH_SECRET` with at least 32 random characters before any non-local use.
2. Add provider keys such as `GEMINI_API_KEY`, `RESEND_API_KEY`, OAuth, and billing env values as needed.
3. Run `docker compose -f docker-compose.selfhost.yml up --build`.
4. Open `http://localhost:3008`.

## Constraints
- The compose file is not a hardened production secret-management setup. Move secrets into an env file or orchestrator secret store before public deployment.
- The web service currently runs migrations on boot. Avoid scaling multiple web containers until migration execution moves to a one-shot release job.
- Local archive files live on the Docker volume. Back up `recall-postgres` and `recall-files` together.

## Update Triggers
- When compose services, worker scripts, ports, or storage volumes change.
- When Docker build inputs or migration boot behavior change.

AGENT UPDATE: docs/overview.md
