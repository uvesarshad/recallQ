# Recall

**Save anything. Find everything.**

Recall is an open-source personal knowledge base. Capture links, notes, files, and documents from any surface — web, Telegram, email forward, or PWA share — enrich them automatically with AI, search by meaning, and chat with your archive.

---

## About

Most people save things they never find again. Browser bookmarks pile up, Telegram forwards get lost, important emails vanish. Recall fixes this by giving every saved item a consistent home: it scrapes metadata, generates a summary and tags with an LLM, embeds the content with pgvector for semantic search, and lets you ask questions against the whole archive.

Built as a self-hostable Next.js 14 app with two lightweight background workers, Recall is designed to run on a single VPS with minimal setup.

---

## Features

- **Universal capture** — Web form, PWA share target, Telegram bot, inbound email forward, browser extension
- **AI enrichment** — Title, summary, and tags generated automatically; configurable LLM provider (Gemini, GPT-4o, Claude, Grok)
- **Semantic search** — pgvector cosine-distance search over AI-generated embeddings
- **RAG chat** — Ask questions against your archive; streaming answers with source citations
- **Knowledge graph** — Force-directed canvas visualising item relationships
- **Folders & tags** — Manual organisation with bulk-edit support
- **Reminders** — Schedule re-surfaces via email or Telegram
- **Self-hostable** — Single Postgres database, no external queues, one `docker compose up` away
- **Multi-auth** — Google OAuth, magic link (Resend), or username/password

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router |
| Database | PostgreSQL + pgvector |
| Auth | NextAuth v5 (JWT + Postgres adapter) |
| AI (default) | Google Gemini 2.5 Flash Lite |
| Embeddings | Google text-embedding-004 (768 dims) |
| Workers | Node.js + tsx (enrichment + reminders) |
| Email | Resend |
| Payments | Razorpay |
| Graph | react-force-graph-2d + @xyflow/react |

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ with the `pgvector` extension
- A Google AI API key (for enrichment and embeddings)

### 1. Clone and install

```bash
git clone https://github.com/your-org/recallQ.git
cd recallQ
npm install
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
```

See [Environment variables](#environment-variables) for the full reference.

### 3. Run database migrations

```bash
npm run db:migrate
```

This applies all SQL files in `migrations/` in order. Safe to re-run.

### 4. Start the dev server

```bash
npm run dev          # Next.js on port 3008
npm run worker:enrich   # AI enrichment (separate terminal)
```

The enrichment worker polls every 5 s for new items. Chat, tags, summaries, and embeddings won't populate until it's running.

---

## Changing Pricing Plans

Plan limits live in a single file — **`lib/plan-limits.ts`**:

```ts
export const PLAN_LIMITS = {
  free:    { maxSavesPerMonth: 50,       maxStorageBytes: 100 * MB, chatQueriesPerDay: 20, ... },
  starter: { maxSavesPerMonth: 100,      maxStorageBytes: 1 * GB,   chatQueriesPerDay: 50, ... },
  pro:     { maxSavesPerMonth: Infinity, maxStorageBytes: 10 * GB,  chatQueriesPerDay: Infinity, ... },
};
```

Edit the numbers there to change what each tier allows. The UI in `app/(app)/settings/billing/billing-settings-client.tsx` and the landing page `PricingSection` in `app/page.tsx` have the **display copy** (price strings, feature bullet lists) — update those separately to keep marketing copy in sync with the actual limits.

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
| `AUTH_SECRET` | ✅ | NextAuth signing secret (32-byte base64) |
| `AUTH_URL` | ✅ | Full URL of this deployment (e.g. `http://localhost:3008`) |
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
| `SELF_HOSTED` | — | Set `true` to remove all plan limits |

Full schema with all variables: `lib/env.ts`.

---

## Self-Hosting with PM2

```bash
npm run build
cp ecosystem.config.js .

# Install PM2 globally if needed
npm install -g pm2

# Start web server + both workers
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

The `ecosystem.config.js` at the project root starts three processes: the Next.js server on port 3008, the enrichment worker, and the reminder worker.

---

## Project Structure

```
app/              Next.js App Router pages and API routes
  (app)/          Authenticated app shell
  (auth)/         Login / auth pages
  api/            REST API handlers
components/       React client components
lib/              Shared utilities (db, auth, llm, plan-limits, ...)
workers/          Long-running Node.js background processes
migrations/       Append-only numbered SQL migration files
docs/             Architecture and module documentation
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

[MIT](LICENSE) © Recall contributors
