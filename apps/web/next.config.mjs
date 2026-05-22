import path from "path";
import { fileURLToPath } from "url";
import { config as loadEnv } from "dotenv";
import bundleAnalyzer from "@next/bundle-analyzer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Set ANALYZE=true to get a per-route bundle flamegraph at .next/analyze/*.
// `pnpm analyze` (or `pnpm --filter @recall/web analyze`) wires this up.
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

// Load .env from the monorepo workspace root so build/dev pick up DATABASE_URL,
// AUTH_SECRET, etc. Production runtime gets env from systemd EnvironmentFile.
loadEnv({ path: path.join(__dirname, "..", "..", ".env") });

// Directories that lived under /api/* before Stage 1 and have moved under /api/v1/*.
// Listed explicitly so external callers (Razorpay/Telegram/Resend webhooks, the
// existing web client) keep working transparently while we migrate them over.
// Remove this rewrite block after every internal caller has been updated.
const LEGACY_API_DIRS = [
  "actions",
  "chat",
  "collections",
  "email",
  "files",
  "graph",
  "ingest",
  "items",
  "me",
  "payments",
  "push-subscription",
  "reminders",
  "search",
  "telegram",
  "user",
].join("|");

// CSP moved to apps/web/proxy.ts so it can be per-request with a fresh nonce
// (Next.js can't emit dynamic headers from this config). Everything else here
// is static enough to live alongside the build config.
const SECURITY_HEADERS = [
  // 2-year HSTS preload (only meaningful behind HTTPS; CloudPanel handles the
  // TLS termination, so this is safe even during local HTTP dev — browsers
  // ignore HSTS over plain HTTP).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@recall/api-schema"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      // Keep the PWA upgradeable — if the browser caches `/sw.js` or
      // `/manifest.json` aggressively, users can get stuck on a stale shell
      // for days. `no-cache` still allows conditional requests, so the
      // bandwidth cost is a few bytes per page load.
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
      {
        source: "/manifest.json",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: `/api/:dir(${LEGACY_API_DIRS})/:path*`,
          destination: "/api/v1/:dir/:path*",
        },
        {
          source: `/api/:dir(${LEGACY_API_DIRS})`,
          destination: "/api/v1/:dir",
        },
      ],
    };
  },
  // Permanent redirects for routes deleted in Stage 2 of PLAN.md. External
  // bookmarks, search-engine indexes, and the PWA Web Share Target keep
  // working; users land on the canonical replacement.
  async redirects() {
    return [
      { source: "/canvas", destination: "/app/canvas", permanent: true },
      { source: "/graph", destination: "/app/canvas", permanent: true },
      { source: "/app/graph", destination: "/app/canvas", permanent: true },
      { source: "/app/search", destination: "/app", permanent: true },
      { source: "/app/login", destination: "/login", permanent: true },
      { source: "/settings", destination: "/app/settings/profile", permanent: true },
      { source: "/settings/:path*", destination: "/app/settings/:path*", permanent: true },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
