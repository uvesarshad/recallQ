import path from "path";
import { fileURLToPath } from "url";
import { config as loadEnv } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const IS_PROD = process.env.NODE_ENV === "production";

// Content-Security-Policy. Starts in Report-Only mode so we can observe real
// production traffic before enforcing — flip the header name to
// `Content-Security-Policy` (without the `-Report-Only` suffix) once the
// reports stop showing legitimate failures.
//
// Sources included:
//   - 'self' for first-party scripts / styles / images / connects
//   - https://checkout.razorpay.com + https://api.razorpay.com for billing
//   - https://generativelanguage.googleapis.com for the in-browser Gemini SDK
//     paths (server-side calls don't use the browser CSP)
//   - data: + https: for images so item thumbnails from arbitrary scrapes
//     render. Tighten to a remotePatterns whitelist in Stage 6 if needed.
//   - 'unsafe-inline' on script-src is temporary for the Razorpay checkout
//     shim; planned migration to a nonce-based policy is tracked in
//     docs/security-audit.md.
const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com",
  "connect-src 'self' https://api.razorpay.com https://generativelanguage.googleapis.com",
  "img-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// Headers applied to every response. The CSP is report-only in production;
// the other headers are enforced everywhere because they're behaviorally safe.
const SECURITY_HEADERS = [
  // 2-year HSTS preload (only meaningful behind HTTPS; CloudPanel handles the
  // TLS termination, so this is safe even during local HTTP dev — browsers
  // ignore HSTS over plain HTTP).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  {
    key: IS_PROD ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy-Report-Only",
    value: CSP_POLICY,
  },
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

export default nextConfig;
