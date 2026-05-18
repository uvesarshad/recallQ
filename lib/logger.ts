type Level = "info" | "warn" | "error";

function log(level: Level, context: string, message: string, meta?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}] [${context}]`;
  const line = meta ? `${prefix} ${message} ${JSON.stringify(meta)}` : `${prefix} ${message}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (context: string, message: string, meta?: Record<string, unknown>) => log("info", context, message, meta),
  warn: (context: string, message: string, meta?: Record<string, unknown>) => log("warn", context, message, meta),
  error: (context: string, message: string, meta?: Record<string, unknown>) => log("error", context, message, meta),
};
