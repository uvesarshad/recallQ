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
};

export default nextConfig;
