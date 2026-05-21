// Structured stdout logger. JSON one-line-per-entry in production (CloudPanel's
// log viewer surfaces stdout/stderr as-is, and downstream tooling like
// `jq`/Loki/Grafana need parseable lines). Pretty text in development for
// readability. Level threshold is `LOG_LEVEL` env, defaulting to `info` in
// production and `debug` everywhere else.

type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function resolveThreshold(): number {
  const raw = (process.env.LOG_LEVEL || "").toLowerCase();
  if (raw in ORDER) return ORDER[raw as Level];
  return process.env.NODE_ENV === "production" ? ORDER.info : ORDER.debug;
}

const THRESHOLD = resolveThreshold();
const IS_PROD = process.env.NODE_ENV === "production";

function emit(level: Level, context: string, message: string, meta?: Record<string, unknown>) {
  if (ORDER[level] < THRESHOLD) return;

  const ts = new Date().toISOString();
  let line: string;

  if (IS_PROD) {
    const entry: Record<string, unknown> = { ts, level, ctx: context, msg: message };
    if (meta) entry.meta = meta;
    line = JSON.stringify(entry);
  } else {
    const prefix = `[${ts}] [${level.toUpperCase()}] [${context}]`;
    line = meta ? `${prefix} ${message} ${JSON.stringify(meta)}` : `${prefix} ${message}`;
  }

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (context: string, message: string, meta?: Record<string, unknown>) => emit("debug", context, message, meta),
  info: (context: string, message: string, meta?: Record<string, unknown>) => emit("info", context, message, meta),
  warn: (context: string, message: string, meta?: Record<string, unknown>) => emit("warn", context, message, meta),
  error: (context: string, message: string, meta?: Record<string, unknown>) => emit("error", context, message, meta),
};
