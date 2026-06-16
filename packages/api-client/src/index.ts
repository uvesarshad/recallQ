import type {
  ErrorResponse,
  TokenIssueInput,
  TokenIssueOutput,
} from "@recall/api-schema";

// Minimal typed REST client consumed by the Chrome extension and (later) the
// Expo mobile app. The web app continues to hit `/api/v1/*` same-origin via
// `fetch` directly — it has the NextAuth session cookie, so there's no need
// for it to use this client.
//
// Only the endpoints needed by Stage 8 are wired here. Add more wrappers as
// each client surface starts consuming them.

export type AuthTokenProvider = () =>
  | string
  | null
  | undefined
  | Promise<string | null | undefined>;

export type ClientOptions = {
  baseUrl: string;
  getAuthToken?: AuthTokenProvider;
  // Optional override hook so the consumer can inject custom fetch (e.g. with
  // retries, telemetry). Defaults to `globalThis.fetch`.
  fetch?: typeof fetch;
};

export class RecallApiError extends Error {
  status: number;
  code: ErrorResponse["code"] | "unknown";
  details?: unknown;

  constructor(
    message: string,
    status: number,
    code: ErrorResponse["code"] | "unknown",
    details?: unknown,
  ) {
    super(message);
    this.name = "RecallApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type IngestUrlInput = {
  url: string;
  capture_note?: string | null;
  source?: string;
};

type IngestTextInput = {
  text: string;
  capture_note?: string | null;
  source?: string;
};

type IngestSuccess = {
  id: string;
  status: "pending" | "enriched";
};

// A single row in a bulk ingest request. Mirrors `ingestPayloadSchema` in
// `apps/web/lib/validation.ts`. The extension's bulk tab-send builds these.
export type IngestItemInput = {
  type: "url" | "text" | "note" | "file";
  raw_url?: string | null;
  raw_text?: string | null;
  title?: string | null;
  capture_note?: string | null;
  source?: string;
};

type IngestBatchSuccess = {
  success: true;
  count: number;
  // Per-item results in request order — each carries the server id, which the
  // sync engine maps back onto the local items it pushed.
  items: { id: string }[];
};

// Subset of `GET /api/v1/me` needed by non-web clients today: the plan (for
// entitlement gating) plus the usage block. The full payload carries more
// (billing config, subscription state) — promote fields here as clients use
// them.
export type MeResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    plan: "free" | "starter" | "pro";
  } | null;
  usage: {
    saves_this_month: number;
    max_saves_per_month: number;
    storage_used_bytes: number;
    max_storage_bytes: number;
  } | null;
};

// Minimal item shape needed by mobile + extension. Mirrors the columns
// `apps/web/app/api/v1/items/route.ts` SELECTs. Promote to `@recall/api-schema`
// once a second client needs more fields.
export type ListItem = {
  id: string;
  type: "url" | "text" | "file" | "note";
  title: string | null;
  summary: string | null;
  tags: string[] | null;
  source: string | null;
  created_at: string;
  updated_at: string;
  raw_url: string | null;
  raw_text: string | null;
  collection_id: string | null;
  collection_name: string | null;
  enriched: boolean;
  reminder_at: string | null;
  reminder_sent: boolean;
  image_url: string | null;
  blur_data_url: string | null;
  file_name: string | null;
  file_mime_type: string | null;
};

type ListItemsParams = {
  limit?: number;
  cursor?: string;
  q?: string;
  tag?: string;
  type?: string;
  // Delta-sync: ISO timestamp; returns items changed after it, oldest-first.
  // `nextCursor` is then the last item's `updated_at` (advance and repeat).
  since?: string;
};

type ListItemsResponse = {
  items: ListItem[];
  hasMore: boolean;
  nextCursor: string | null;
};

export function createRecallClient(opts: ClientOptions) {
  const baseUrl = opts.baseUrl.replace(/\/+$/, "");
  const doFetch = opts.fetch ?? globalThis.fetch;

  async function request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const token = opts.getAuthToken ? await opts.getAuthToken() : null;
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const response = await doFetch(`${baseUrl}${path}`, { ...init, headers });
    const text = await response.text();
    const body = text ? safeJsonParse(text) : null;

    if (!response.ok) {
      const code =
        (body as ErrorResponse | null)?.code ??
        ((response.status >= 500
          ? "internal_error"
          : response.status === 401
            ? "unauthorized"
            : response.status === 429
              ? "rate_limited"
              : "unknown") as ErrorResponse["code"]);
      const message =
        (body as ErrorResponse | null)?.error ??
        `Request failed with ${response.status}`;
      throw new RecallApiError(
        message,
        response.status,
        code,
        (body as ErrorResponse | null)?.details,
      );
    }

    return body as T;
  }

  return {
    auth: {
      issueToken: (input: TokenIssueInput) =>
        request<TokenIssueOutput>("/auth/tokens", {
          method: "POST",
          body: JSON.stringify(input),
        }),
    },
    items: {
      list: (params: ListItemsParams = {}) => {
        const query = new URLSearchParams();
        if (params.limit !== undefined) query.set("limit", String(params.limit));
        if (params.cursor) query.set("cursor", params.cursor);
        if (params.q) query.set("q", params.q);
        if (params.tag) query.set("tag", params.tag);
        if (params.type) query.set("type", params.type);
        if (params.since) query.set("since", params.since);
        const qs = query.toString();
        return request<ListItemsResponse>(`/items${qs ? `?${qs}` : ""}`);
      },
      get: (id: string) =>
        request<{ item: ListItem | null }>(`/items/${encodeURIComponent(id)}`),
      delete: (id: string) =>
        request<{ success: true }>(`/items/${encodeURIComponent(id)}`, {
          method: "DELETE",
        }),
    },
    ingest: {
      url: (input: IngestUrlInput) =>
        request<IngestSuccess>("/ingest", {
          method: "POST",
          body: JSON.stringify({
            type: "url",
            raw_url: input.url,
            raw_text: input.url,
            capture_note: input.capture_note ?? null,
            source: input.source ?? "extension",
          }),
        }),
      text: (input: IngestTextInput) =>
        request<IngestSuccess>("/ingest", {
          method: "POST",
          body: JSON.stringify({
            type: "text",
            raw_url: null,
            raw_text: input.text,
            capture_note: input.capture_note ?? null,
            source: input.source ?? "extension",
          }),
        }),
      // Bulk capture in one request. The server bulk path accepts up to 100
      // items (`bulkIngestPayloadSchema`); callers that have more must chunk
      // before calling. On a mid-batch plan-cap hit the server returns 402
      // with `details.imported_count` — surfaced via `RecallApiError.details`.
      batch: (items: IngestItemInput[]) =>
        request<IngestBatchSuccess>("/ingest", {
          method: "POST",
          body: JSON.stringify({
            items: items.map((item) => ({
              source: "extension",
              ...item,
            })),
          }),
        }),
    },
    me: {
      get: () => request<MeResponse>("/me"),
    },
    raw: { request },
  };
}

export type RecallClient = ReturnType<typeof createRecallClient>;

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
