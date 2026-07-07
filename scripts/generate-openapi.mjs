import { mkdir, writeFile } from "fs/promises";
import path from "path";

const json = (schema) => ({ content: { "application/json": { schema } } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

const errorResponses = {
  "400": { description: "Validation error", content: json(ref("ErrorResponse")) },
  "401": { description: "Unauthorized", content: json(ref("ErrorResponse")) },
  "404": { description: "Not found", content: json(ref("ErrorResponse")) },
  "429": { description: "Rate limited", content: json(ref("ErrorResponse")) },
  "500": { description: "Internal error", content: json(ref("ErrorResponse")) },
};

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortValue(value[key])]),
  );
}

function bearer() {
  return [{ bearerAuth: [] }];
}

function op(method, path, summary, options = {}) {
  return {
    [method]: {
      tags: options.tags ?? [path.split("/")[2] ?? "api"],
      summary,
      security: options.public ? [] : bearer(),
      parameters: options.parameters ?? [],
      requestBody: options.requestBody,
      responses: {
        "200": {
          description: "Success",
          ...(options.response ? json(options.response) : {}),
        },
        ...errorResponses,
        ...(options.responses ?? {}),
      },
    },
  };
}

const spec = {
  openapi: "3.1.0",
  info: {
    title: "RecallQ API",
    version: "2026-07-07",
    description: "Deterministic OpenAPI surface for the versioned RecallQ REST API.",
  },
  servers: [{ url: "https://recallq.xyz/api/v1" }, { url: "http://localhost:3008/api/v1" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
      cookieAuth: { type: "apiKey", in: "cookie", name: "authjs.session-token" },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        required: ["error", "code"],
        properties: {
          error: { type: "string" },
          code: {
            type: "string",
            enum: [
              "validation_error",
              "unauthorized",
              "forbidden",
              "not_found",
              "rate_limited",
              "conflict",
              "internal_error",
              "plan_limit_exceeded",
            ],
          },
          details: {},
        },
      },
      TokenIssueInput: {
        type: "object",
        required: ["email", "password", "device_name"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" },
          device_name: { type: "string", minLength: 1, maxLength: 64 },
        },
      },
      TokenIssueOutput: {
        type: "object",
        required: ["token", "id", "prefix", "device_name", "created_at"],
        properties: {
          token: { type: "string" },
          id: { type: "string", format: "uuid" },
          prefix: { type: "string" },
          device_name: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      ChatRequest: {
        type: "object",
        required: ["messages"],
        properties: {
          messages: {
            type: "array",
            minItems: 1,
            maxItems: 50,
            items: {
              type: "object",
              required: ["role", "content"],
              properties: {
                role: { type: "string", enum: ["user", "assistant", "system"] },
                content: { type: "string", minLength: 1, maxLength: 2000 },
              },
            },
          },
        },
      },
      IngestInput: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["url", "text", "note", "file"] },
          url: { type: "string" },
          text: { type: "string" },
          title: { type: "string" },
          source: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          capture_note: { type: "string" },
        },
      },
      Item: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          type: { type: "string" },
          title: { type: ["string", "null"] },
          summary: { type: ["string", "null"] },
          tags: { type: "array", items: { type: "string" } },
          raw_url: { type: ["string", "null"] },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      Reminder: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          item_id: { type: ["string", "null"], format: "uuid" },
          remind_at: { type: "string", format: "date-time" },
          sent: { type: "boolean" },
        },
      },
    },
  },
  paths: {
    "/auth/tokens": {
      ...op("post", "/auth/tokens", "Issue a personal access token", {
        public: true,
        tags: ["auth"],
        requestBody: { required: true, ...json(ref("TokenIssueInput")) },
        response: ref("TokenIssueOutput"),
      }),
      ...op("get", "/auth/tokens", "List personal access tokens", { tags: ["auth"] }),
    },
    "/auth/tokens/{id}": {
      ...op("delete", "/auth/tokens/{id}", "Revoke a personal access token", {
        tags: ["auth"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      }),
    },
    "/ingest": {
      ...op("post", "/ingest", "Capture one or more archive items", {
        tags: ["ingest"],
        requestBody: { required: true, ...json(ref("IngestInput")) },
      }),
    },
    "/ingest/file": {
      ...op("post", "/ingest/file", "Capture an uploaded file", { tags: ["ingest"] }),
    },
    "/items": {
      ...op("get", "/items", "List archive items", {
        tags: ["items"],
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50 } },
          { name: "since", in: "query", schema: { type: "string", format: "date-time" } },
        ],
        response: { type: "object", properties: { items: { type: "array", items: ref("Item") } } },
      }),
      ...op("post", "/items", "Create an archive item", {
        tags: ["items"],
        requestBody: { required: true, ...json(ref("IngestInput")) },
      }),
    },
    "/items/{id}": {
      ...op("get", "/items/{id}", "Get archive item detail", {
        tags: ["items"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        response: ref("Item"),
      }),
      ...op("patch", "/items/{id}", "Update archive item metadata", {
        tags: ["items"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      }),
      ...op("delete", "/items/{id}", "Delete an archive item", {
        tags: ["items"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      }),
    },
    "/items/batch": { ...op("post", "/items/batch", "Run a batch item action", { tags: ["items"] }) },
    "/search": {
      ...op("get", "/search", "Search archive items", {
        tags: ["retrieval"],
        parameters: [
          { name: "q", in: "query", required: true, schema: { type: "string", maxLength: 500 } },
          { name: "mode", in: "query", schema: { type: "string", enum: ["hybrid", "semantic", "fulltext"] } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50 } },
          { name: "cursor", in: "query", schema: { type: "string" } },
        ],
      }),
    },
    "/chat": {
      ...op("post", "/chat", "Stream RAG chat over the archive", {
        tags: ["retrieval"],
        requestBody: { required: true, ...json(ref("ChatRequest")) },
        responses: { "200": { description: "Server-sent event stream" } },
      }),
    },
    "/ai/prompts": {
      ...op("get", "/ai/prompts", "Read custom AI prompt preferences", { tags: ["ai"] }),
      ...op("put", "/ai/prompts", "Update custom AI prompt preferences", {
        tags: ["ai"],
        requestBody: {
          required: true,
          ...json({
            type: "object",
            required: ["enabled"],
            properties: {
              enabled: { type: "boolean" },
              enrichment_instructions: { type: ["string", "null"], maxLength: 1200 },
            },
          }),
        },
      }),
    },
    "/collections/{id}/share": {
      ...op("put", "/collections/{id}/share", "Enable, disable, or rotate a public collection link", {
        tags: ["collections"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      }),
    },
    "/public/collections/{slug}": {
      ...op("get", "/public/collections/{slug}", "Read a public collection by share slug", {
        public: true,
        tags: ["public"],
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
      }),
    },
    "/reminders": {
      ...op("get", "/reminders", "List reminders", { tags: ["reminders"] }),
      ...op("post", "/reminders", "Create a reminder", { tags: ["reminders"] }),
    },
    "/reminders/{id}": {
      ...op("patch", "/reminders/{id}", "Update a reminder", {
        tags: ["reminders"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      }),
      ...op("delete", "/reminders/{id}", "Delete a reminder", {
        tags: ["reminders"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      }),
    },
    "/devices/push": {
      ...op("post", "/devices/push", "Register an Expo Push token", { tags: ["devices"] }),
      ...op("get", "/devices/push", "List push devices", { tags: ["devices"] }),
    },
    "/payments/create-subscription": {
      ...op("post", "/payments/create-subscription", "Create a Razorpay subscription", { tags: ["payments"] }),
    },
    "/payments/stripe/checkout": {
      ...op("post", "/payments/stripe/checkout", "Create a Stripe Checkout session", { tags: ["payments"] }),
    },
    "/payments/stripe/portal": {
      ...op("post", "/payments/stripe/portal", "Create a Stripe billing portal session", { tags: ["payments"] }),
    },
    "/payments/webhook": {
      ...op("post", "/payments/webhook", "Receive Razorpay webhooks", { public: true, tags: ["payments"] }),
    },
    "/payments/stripe/webhook": {
      ...op("post", "/payments/stripe/webhook", "Receive Stripe webhooks", { public: true, tags: ["payments"] }),
    },
  },
};

await mkdir("docs", { recursive: true });
await writeFile(
  path.join("docs", "openapi.json"),
  `${JSON.stringify(sortValue(spec), null, 2)}\n`,
);
console.log("Wrote docs/openapi.json");
