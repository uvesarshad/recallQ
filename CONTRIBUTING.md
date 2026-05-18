# Contributing to Recall

Thank you for your interest in contributing! This document covers how to get set up, what kinds of contributions are welcome, and how to submit changes.

## Ways to contribute

- **Bug reports** — Open a GitHub issue with a clear description and reproduction steps.
- **Feature requests** — Open an issue describing the use case before building anything large.
- **Code** — Fork, branch, implement, and open a pull request.
- **Documentation** — Improve the `docs/` folder or this README.
- **Translations** — UI strings are mostly inline; raise an issue if you want to discuss a proper i18n layer.

## Development setup

```bash
git clone https://github.com/your-org/recallQ.git
cd recallQ
npm install
cp .env.example .env      # fill in DATABASE_URL, AUTH_SECRET, GEMINI_API_KEY at minimum
npm run db:migrate
npm run dev               # port 3008
npm run worker:enrich     # separate terminal
```

## Before opening a PR

1. **Run the type checker** — `npm run typecheck` must pass with zero errors.
2. **Run the linter** — `npm run lint` must pass with zero errors (warnings are OK).
3. **Run tests** — `npm test` must pass.
4. **Update docs** — If you change a route, schema, or env var, update the relevant file under `docs/`. Read `AGENTS.md` for the doc-update protocol.
5. **One concern per PR** — Keep pull requests focused. A bug fix PR should not also refactor unrelated code.

## Commit style

Use conventional commits where possible:

```
feat: add OpenAI provider support
fix: prevent connection-closed crash on feed page
docs: document LLM_PROVIDER env var
chore: upgrade @google/generative-ai to 0.25
```

## Adding a new LLM provider

The unified interface lives in `lib/llm.ts`. Add a new branch to both `generateText` and `streamGenerate`, add the provider to the `LLM_PROVIDER` enum in `lib/env.ts`, install any required SDK, and document it in the README table.

Embeddings (`embedText` in `lib/gemini.ts`) must stay on Google `text-embedding-004` — changing the embedding model requires re-indexing all existing items, which is a breaking migration.

## Database migrations

Migrations are numbered SQL files in `migrations/`. Always append a new file; never edit an existing one. Name the file `NNN_short_description.sql` where `NNN` is the next sequential number.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be respectful and constructive.
