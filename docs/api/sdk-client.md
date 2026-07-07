# SDK and Client Usage

> Scope: Public client entry points for extension, mobile, CLI, and external automation.
> Rendering context: External clients
> Project tier: 4
> Last updated: 2026-07-07

## TypeScript Client
`packages/api-client/src/index.ts` exports `createRecallClient`. Use it with a bearer token minted from `/api/v1/auth/tokens`.

```ts
import { createRecallClient } from "@recall/api-client";

const client = createRecallClient({
  baseUrl: "https://recallq.xyz/api/v1",
  getAuthToken: () => process.env.RECALL_TOKEN,
});

await client.ingest.url({ url: "https://example.com", source: "api" });
const results = await client.items.list({ since: "2026-07-07T00:00:00.000Z" });
```

The extension and Expo app use this client for bearer-authenticated archive reads, edits, deletes, collection listing, and archive requests.

## CLI
`pnpm recall login --email <email> --password <password>` stores a local token in `~/.config/recallq/config.json`. `RECALL_TOKEN` and `RECALL_API_URL` override config for CI.

Common commands: `capture-url`, `capture-text`, `capture-file`, `search`, `export-json`, `export-bookmarks`, `import-bookmarks`, `import-status`, and `admin`.

## Generated API Contract
`pnpm openapi:generate` refreshes `docs/openapi.json`. Treat it as the stable external API index and regenerate it whenever route contracts change.

AGENT UPDATE: docs/overview.md, docs/api/route-handlers.md
