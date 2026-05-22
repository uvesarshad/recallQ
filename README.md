# RecallQ

**Save anything. Find everything.** By [Montr AI](https://recallq.xyz).

RecallQ is an open-source personal knowledge ecosystem. Capture links, notes, files, and documents from anywhere — web, Chrome extension, iOS, Android, Telegram, or email — enrich them automatically with AI, search by meaning, chat with your archive, and arrange them on an infinite freeform canvas.

---

## About

Most people save things they never find again. Browser bookmarks pile up, Telegram forwards get lost, important emails vanish. RecallQ fixes this by giving every saved item a consistent home: it scrapes metadata, generates a summary and tags with an LLM, embeds the content with pgvector for semantic search, and lets you ask questions against the whole archive across every device you've connected.

Built as a self-hostable pnpm + Turborepo monorepo (Next.js web + WXT Chrome extension + Expo mobile + two Node workers), RecallQ is designed to run on a single VPS with a self-managed Postgres database — no Redis, no Docker required, no managed-cloud lock-in.

---

## Features

### Capture
- **Universal capture** — Web form, PWA share target, Telegram bot, inbound email forward, Chrome extension context menu, mobile app, share intent
- **One-tap save** — Right-click any link → "Save to RecallQ"; tap "Share" on any mobile app → RecallQ
- **AI enrichment** — Title, summary, and tags generated automatically; configurable LLM provider (Gemini, GPT-4o, Claude, Grok)

### Find
- **Hybrid search** — Postgres full-text + pgvector cosine similarity, merged and de-duped
- **RAG chat** — Ask questions against your archive; streaming answers with source citations
- **Infinite canvas** — Excalidraw-style freeform board for visually arranging items

### Manage
- **Folders & tags** — Manual organisation with bulk-edit support
- **Reminders** — Schedule re-surfaces via email, Telegram, or web push
- **Connected devices** — Personal access tokens (per device) revocable from settings

### Operate
- **Self-hostable** — Single Postgres database, no external queues, deploys to any VPS with Node 20+
- **Multi-auth** — Google OAuth, magic link (Resend), or email + password
- **Health endpoint** — `/api/v1/health` for uptime probes; reports DB + per-worker status
- **Observability** — JSON-per-line stdout logger gated by `LOG_LEVEL`; CloudPanel / Loki / `jq` friendly
- **Security baseline** — HSTS, CSP (report-only by default), Postgres-backed rate limiting, bearer-token auth for non-web clients

---

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Web | Next.js 16 (App Router, Turbopack) on Node 20+ |
| Mobile | Expo SDK 52 + React Native 0.76 + Expo Router 4 + NativeWind 4 |
| Extension | WXT 0.20 + React (Manifest V3) |
| Database | PostgreSQL 15+ with pgvector |
| Auth | NextAuth v5 (cookie session for web) + personal access tokens (bearer auth for extension + mobile) |
| AI (default) | Google Gemini 2.5 Flash Lite |
| Embeddings | Google text-embedding-004 (768 dims) |
| Workers | Node.js + tsx (enrichment + reminders), supervised by systemd in production |
| Image pipeline | sharp (16x16 base64 blur placeholders for CLS-free thumbnails) |
| Email | Resend |
| Payments | Razorpay (web/extension/Android — iOS is free-only for v1) |
| Styling | Tailwind CSS v4 (web), NativeWind 4 (mobile) |
| Validation | Shared Zod schemas in `@recall/api-schema` |

---

## Getting Started

### Prerequisites

- Node.js 20+ (24 recommended)
- pnpm 11+
- PostgreSQL 15+ with the `pgvector` extension
- A Google AI API key (for enrichment and embeddings)

### 1. Clone and install

```bash
git clone https://github.com/your-org/recallQ.git
cd recallQ
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — the minimum required variables are:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/recall
AUTH_SECRET=<run: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">
AUTH_URL=http://localhost:3008
GEMINI_API_KEY=<your Google AI key>
SELF_HOSTED=true   # if Postgres runs on the same box as the web app
```

See [Environment variables](#environment-variables) for the full reference.

### 3. Run database migrations

```bash
pnpm db:migrate
```

This applies all SQL files in `migrations/` in order. Safe to re-run.

### 4. Start the dev server + workers

```bash
pnpm dev                # Next.js web on port 3008
pnpm worker:enrich      # AI enrichment (separate terminal)
pnpm worker:reminders   # Reminder dispatch (separate terminal)
```

The enrichment worker polls every 5 s for new items. Chat, tags, summaries, and embeddings won't populate until it's running. The reminder worker polls every 60 s and writes a liveness heartbeat that `/api/v1/health` reads.

### 5. (Optional) Run the Chrome extension

```bash
pnpm dev:ext
```

WXT launches an instrumented Chrome with the unpacked extension auto-loaded. Sign in via the popup (it bounces through the web's `/extension/connect` page to mint a personal access token).

### 6. (Optional) Run the mobile app

```bash
pnpm --filter @recall/mobile start
```

Brings up the Expo dev server. Open with Expo Go on your phone, or via the iOS/Android simulators. On a physical device, set `EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:3008/api/v1` so the phone can reach your machine.

---

## Workspace Scripts

All scripts run from the workspace root via `pnpm <script>`.

| Script | What it does |
|---|---|
| `dev` | Next.js dev server on :3008 |
| `dev:ext` | WXT dev server (Chrome extension) |
| `build` | Production build of the web app only |
| `build:ext` | Production build of the Chrome extension |
| `build:all` | Build everything in the workspace |
| `zip:ext` | Bundle the extension into a Chrome Web Store-ready zip |
| `start` | `next start` the production web build |
| `lint` | ESLint across packages |
| `typecheck` | `tsc --noEmit` across web + extension + mobile |
| `test` | Web app tests (no framework — just `node --experimental-strip-types`) |
| `db:migrate` | Apply all migrations in order |
| `db:migrate:latest` | Apply only the newest migration |
| `worker:enrich` | Run the enrichment daemon |
| `worker:reminders` | Run the reminder daemon |
| `telegram:webhook` | Register the Telegram bot webhook |

---

## Changing Pricing Plans

Plan limits live in a single file — **`apps/web/lib/plan-limits.ts`**:

```ts
export const PLAN_LIMITS = {
  free:    { maxSavesPerMonth: 50,       maxStorageBytes: 100 * MB, chatQueriesPerDay: 20, ... },
  starter: { maxSavesPerMonth: 100,      maxStorageBytes: 1 * GB,   chatQueriesPerDay: 50, ... },
  pro:     { maxSavesPerMonth: Infinity, maxStorageBytes: 10 * GB,  chatQueriesPerDay: Infinity, ... },
};
```

Edit the numbers there to change what each tier allows. The UI in `apps/web/app/(app)/app/settings/billing/billing-settings-client.tsx` and the landing page `PricingSection` in `apps/web/app/page.tsx` have the **display copy** (price strings, feature bullet lists) — update those separately to keep marketing copy in sync.

If `SELF_HOSTED=true` in your `.env`, all limits are removed regardless of plan.

---

## Multi-Provider LLM

Set `LLM_PROVIDER` in your `.env` to switch AI backends for enrichment and chat. Embeddings always use Google (`text-embedding-004`) because switching would require re-indexing all existing items.

| Provider | `LLM_PROVIDER` | Key variable | Default model |
|---|---|---|---|
| Google Gemini | `google` (default) | `GEMINI_API_KEY` | `gemini-2.5-flash-lite` |
| OpenAI | `openai` | `OPENAI_API_KEY` | `gpt-4o-mini` |
| Anthropic Claude | `anthropic` | `ANTHROPIC_API_KEY` | `claude-3-5-haiku-latest` |
| xAI Grok | `xai` | `XAI_API_KEY` | `grok-3-mini` |

Override the model with `LLM_MODEL`. For any OpenAI-compatible endpoint (Groq, local Ollama, etc.) set `LLM_PROVIDER=openai`, `OPENAI_API_KEY=<key>`, and `LLM_BASE_URL=<endpoint>`.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `AUTH_SECRET` | ✅ | NextAuth signing secret. 32+ bytes in production or boot refuses to start. |
| `AUTH_URL` | ✅ | Full URL of this deployment (e.g. `http://localhost:3008`) |
| `SELF_HOSTED` | — | Set `true` to remove all plan limits AND allow a localhost `DATABASE_URL` in production (single-box CloudPanel deploy). |
| `GEMINI_API_KEY` | For enrichment | Google AI API key |
| `LLM_PROVIDER` | — | `google` \| `openai` \| `anthropic` \| `xai` (default: `google`) |
| `LLM_MODEL` | — | Override the default model for the selected provider |
| `OPENAI_API_KEY` | If `openai`/`xai` | OpenAI or xAI API key |
| `ANTHROPIC_API_KEY` | If `anthropic` | Anthropic API key |
| `XAI_API_KEY` | If `xai` | xAI API key |
| `LLM_BASE_URL` | — | Custom base URL for OpenAI-compatible endpoints |
| `RESEND_API_KEY` | For email | Resend API key |
| `GOOGLE_CLIENT_ID` | For OAuth | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | For OAuth | Google OAuth client secret |
| `TELEGRAM_BOT_TOKEN` | For Telegram | Telegram bot token |
| `RAZORPAY_KEY_ID` | For billing | Razorpay public key |
| `LOG_LEVEL` | — | `debug` \| `info` \| `warn` \| `error`. Defaults to `info` in prod / `debug` elsewhere. |

Full schema with all variables: `apps/web/lib/env.ts` (Zod-validated at boot).

---

## Self-Hosting

Production deploys are designed for a single VPS running CloudPanel (or any nginx + systemd setup) with PostgreSQL on the same box.

**The web app** runs as a CloudPanel Node.js site pointed at the `next start` output.

**Workers** run as systemd services (CloudPanel can only supervise one process per site):

```ini
# /etc/systemd/system/recall-enrichment.service
[Unit]
Description=Recall enrichment worker
After=network.target postgresql.service

[Service]
Type=simple
User=<cloudpanel-user>
WorkingDirectory=/home/<user>/htdocs/<domain>/recallQ
EnvironmentFile=/home/<user>/htdocs/<domain>/recallQ/.env
ExecStart=/usr/bin/pnpm worker:enrich
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Same shape for `recall-reminders.service` pointing at `pnpm worker:reminders`.

**Required server packages:**
- Node 20+ and pnpm 11+
- PostgreSQL 15+ with the pgvector extension (`sudo apt install postgresql-16-pgvector` on Ubuntu 24)
- nginx (CloudPanel installs it)

**Health monitoring:** point your uptime probe at `https://<your-domain>/api/v1/health`. It returns `200 {ok: true, db: 'up', workers: {enrichment, reminders}}` when everything's alive, `503` otherwise. A worker with a heartbeat older than 5 minutes is reported `down`.

Full deploy guide with CloudPanel-specific steps, pg_dump backup cron, UFW/fail2ban config, and the Chrome Web Store + App Store submission checklists is being written as `DEPLOY.md` (Stage 10 of [PLAN.md](PLAN.md)).

---

## Project Structure

```
recallQ/
├── apps/
│   ├── web/             Next.js App Router app, API routes, workers, UI
│   ├── extension/       Chrome / Edge / Firefox extension (WXT, Manifest V3)
│   └── mobile/          Expo iOS/Android app (Expo Router 4)
├── packages/
│   ├── api-schema/      Shared Zod schemas for /api/v1/*
│   └── api-client/      Typed REST client used by extension + mobile
├── migrations/          Append-only numbered SQL migration files
├── scripts/             DB migrate + Telegram webhook registration
└── docs/                Architecture and module documentation
```

Workers (`apps/web/workers/enrichment-worker.ts`, `apps/web/workers/reminder-worker.ts`) ship inside the web app but run as independent processes.

---

## Architecture Documentation

- [docs/overview.md](docs/overview.md) — Mental model + index of every other doc.
- [docs/architecture/folder-structure.md](docs/architecture/folder-structure.md) — Where everything lives.
- [docs/api/route-handlers.md](docs/api/route-handlers.md) — Every `/api/v1/*` endpoint.
- [docs/api/database.md](docs/api/database.md) — Schema and migrations.
- [docs/security-audit.md](docs/security-audit.md) — Per-endpoint auth / validation / rate-limit audit.
- [docs/infra/environment.md](docs/infra/environment.md) — Full env var reference.
- [PLAN.md](PLAN.md) — Ecosystem roadmap (web + extension + mobile + deploy).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

[MIT](LICENSE) © Montr AI and contributors.
