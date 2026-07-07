const apiUrl = (process.env.RECALL_API_URL ?? "http://localhost:3008/api/v1").replace(/\/$/, "");
const token = process.env.RECALL_TOKEN;

const tools = [
  {
    name: "recall_search",
    description: "Search the user's RecallQ archive.",
    inputSchema: { type: "object", properties: { q: { type: "string" }, limit: { type: "number" } }, required: ["q"] },
  },
  {
    name: "recall_get_item",
    description: "Read one archive item by id.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "recall_capture_url",
    description: "Capture a URL into RecallQ.",
    inputSchema: { type: "object", properties: { url: { type: "string" }, note: { type: "string" } }, required: ["url"] },
  },
  {
    name: "recall_capture_text",
    description: "Capture text into RecallQ.",
    inputSchema: { type: "object", properties: { text: { type: "string" }, title: { type: "string" } }, required: ["text"] },
  },
  {
    name: "recall_update_item",
    description: "Update title, note, tags, folder, or reminder for an item.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, patch: { type: "object" } }, required: ["id", "patch"] },
  },
  {
    name: "recall_delete_item",
    description: "Delete an archive item.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "recall_chat",
    description: "Ask RecallQ chat over the archive and return the streamed text.",
    inputSchema: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
  },
];

async function api(pathname, init = {}) {
  if (!token) throw new Error("RECALL_TOKEN is required for the MCP server.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}${pathname}`, { ...init, headers });
  if (!response.ok) throw new Error(await response.text());
  return response;
}

async function toolCall(name, input) {
  if (name === "recall_search") {
    const limit = input.limit ? `&limit=${encodeURIComponent(input.limit)}` : "";
    return json(await (await api(`/search?q=${encodeURIComponent(input.q)}${limit}`)).json());
  }
  if (name === "recall_get_item") return json(await (await api(`/items/${encodeURIComponent(input.id)}`)).json());
  if (name === "recall_capture_url") {
    return json(await (await api("/ingest", {
      method: "POST",
      body: JSON.stringify({ type: "url", raw_url: input.url, raw_text: input.url, capture_note: input.note ?? null, source: "api" }),
    })).json());
  }
  if (name === "recall_capture_text") {
    return json(await (await api("/ingest", {
      method: "POST",
      body: JSON.stringify({ type: "text", raw_text: input.text, title: input.title ?? null, source: "api" }),
    })).json());
  }
  if (name === "recall_update_item") {
    return json(await (await api(`/items/${encodeURIComponent(input.id)}`, {
      method: "PATCH",
      body: JSON.stringify(input.patch),
    })).json());
  }
  if (name === "recall_delete_item") {
    return json(await (await api(`/items/${encodeURIComponent(input.id)}`, { method: "DELETE" })).json());
  }
  if (name === "recall_chat") {
    const response = await api("/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: input.message }] }),
    });
    return text(await readSseText(response));
  }
  throw new Error(`Unknown tool: ${name}`);
}

function json(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function text(value) {
  return { content: [{ type: "text", text: value }] };
}

async function readSseText(response) {
  const raw = await response.text();
  return raw
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => {
      try {
        const event = JSON.parse(line.slice(6));
        return event.text ?? "";
      } catch {
        return "";
      }
    })
    .join("");
}

function send(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function sendError(id, error) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32000, message: error.message } })}\n`);
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    void handle(JSON.parse(line));
  }
});

async function handle(message) {
  try {
    if (message.method === "initialize") {
      return send(message.id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "recallq", version: "0.1.0" },
      });
    }
    if (message.method === "tools/list") return send(message.id, { tools });
    if (message.method === "tools/call") {
      const { name, arguments: input = {} } = message.params ?? {};
      return send(message.id, await toolCall(name, input));
    }
    if (message.id !== undefined) return send(message.id, {});
  } catch (error) {
    sendError(message.id, error);
  }
}
