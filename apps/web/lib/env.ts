import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  AUTH_URL: z.string().url().optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  APP_URL: z.string().url().optional(),
  APP_DOMAIN: z.string().min(1).optional(),
  SELF_HOSTED: z.enum(["true", "false"]).optional(),
  FILES_BASE_PATH: z.string().min(1).default("/tmp/recall/files"),
  INTERNAL_INGEST_TOKEN: z.string().min(1).optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1).optional(),
  TELEGRAM_BOT_USERNAME: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_INBOUND_SECRET: z.string().min(1).optional(),
  RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  EMAIL_FROM: z.string().email().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash-lite"),
  LLM_PROVIDER: z.enum(["google", "openai", "anthropic", "xai"]).default("google"),
  LLM_MODEL: z.string().min(1).optional(),
  LLM_BASE_URL: z.string().url().optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  XAI_API_KEY: z.string().min(1).optional(),
  RAZORPAY_KEY_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().min(1).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),
  RAZORPAY_PLAN_STARTER_YEARLY_ID: z.string().min(1).optional(),
  RAZORPAY_PLAN_PRO_YEARLY_ID: z.string().min(1).optional(),
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  DEV_BYPASS_LOGIN: z.enum(["true", "false"]).optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
});

const envData = Object.fromEntries(
  Object.entries(process.env).map(([key, value]) => [
    key,
    value === "" ? undefined : value,
  ])
);

const parsed = envSchema.safeParse(envData);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${issues}`);
}

// Production-only hardening. Done after Zod parsing so the messages are about
// runtime requirements rather than schema mismatches. Skipped during
// `next build` (which sets NODE_ENV=production but doesn't actually run the
// server) because the build machine doesn't need real production secrets.
const IS_BUILD_PHASE =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.NEXT_PHASE === "phase-export";

if (parsed.data.NODE_ENV === "production" && !IS_BUILD_PHASE) {
  // NextAuth's signing secret must be long enough to resist offline brute
  // force. 32 random bytes (Base64 ~ 44 chars) is the documented minimum.
  // Any production install booting with a dev fallback like "secret" or
  // "changeme" would fail this check and refuse to start.
  if (parsed.data.AUTH_SECRET.length < 32) {
    throw new Error(
      "AUTH_SECRET is too short for production. Generate a fresh secret with `openssl rand -base64 32` and set it via the systemd EnvironmentFile.",
    );
  }
  // DATABASE_URL must point at a non-localhost host in production (with the
  // explicit `SELF_HOSTED=true` opt-out for installs that genuinely run the
  // database on the same EC2 box as the web tier — that's our CloudPanel
  // setup per PLAN.md Stage 10).
  if (
    parsed.data.SELF_HOSTED !== "true" &&
    /\b(localhost|127\.0\.0\.1)\b/.test(parsed.data.DATABASE_URL)
  ) {
    throw new Error(
      "DATABASE_URL points at localhost but SELF_HOSTED is not set. Either set SELF_HOSTED=true (single-server CloudPanel deploy) or point at the real database host.",
    );
  }
}

export const env = parsed.data;

export function requireEnv<K extends keyof typeof env>(key: K) {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}
