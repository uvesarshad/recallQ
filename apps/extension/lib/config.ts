// Build-time toggle between local Next dev (`pnpm dev` on port 3008) and the
// production API. WXT picks up `import.meta.env.MODE` from Vite, so the prod
// build hits recallq.xyz and the dev build hits localhost. Override with the
// `RECALL_API_URL` env var if you need to point at a staging deploy.

export const API_BASE_URL: string =
  (import.meta.env.WXT_RECALL_API_URL as string | undefined) ??
  (import.meta.env.PROD
    ? "https://recallq.xyz/api/v1"
    : "http://localhost:3008/api/v1");

export const WEB_BASE_URL: string =
  (import.meta.env.WXT_RECALL_WEB_URL as string | undefined) ??
  (import.meta.env.PROD ? "https://recallq.xyz" : "http://localhost:3008");
