import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(1).optional(),
  APP_URL: z.string().url().optional(),
  APP_DOMAIN: z.string().min(1).optional(),
  FILES_BASE_PATH: z.string().min(1).default("/tmp/recall/files"),
  INTERNAL_INGEST_TOKEN: z.string().min(1).optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1).optional(),
  TELEGRAM_BOT_USERNAME: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_INBOUND_SECRET: z.string().min(1).optional(),
  RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash-lite"),
  DEV_BYPASS_LOGIN: z.enum(["true", "false"]).optional(),
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

export const env = parsed.data;

export function requireEnv<K extends keyof typeof env>(key: K) {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}
