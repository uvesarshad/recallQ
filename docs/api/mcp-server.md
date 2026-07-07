# MCP Server

> Scope: Local stdio MCP bridge for RecallQ archive access.
> Rendering context: External agents
> Project tier: 4
> Last updated: 2026-07-07

## Overview
`scripts/recall-mcp-server.mjs` exposes a small MCP stdio server backed by the public REST API and bearer auth.

Start it with:

```bash
RECALL_API_URL=https://recallq.xyz/api/v1 RECALL_TOKEN=rq_... pnpm mcp
```

## Tools
- `recall_search`: search saved items.
- `recall_get_item`: read one item.
- `recall_capture_url`: save a URL.
- `recall_capture_text`: save text.
- `recall_update_item`: patch supported item fields.
- `recall_delete_item`: delete an item.
- `recall_chat`: ask archive chat and return streamed text.

The server never stores the token. The calling MCP host owns process supervision and secret injection.

AGENT UPDATE: docs/overview.md, docs/infra/environment.md
