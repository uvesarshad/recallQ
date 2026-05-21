import os from "os";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const HEARTBEAT_INTERVAL_MS = 30_000;

// Upserts the worker's row in `worker_heartbeats` on a fixed interval so
// `/api/v1/health` can report it as live. Errors are logged but do not crash
// the worker — a missed heartbeat just shows up as stale on the health check.
export function startHeartbeat(workerName: string): () => void {
  const pid = process.pid;
  const hostname = os.hostname();

  async function beat() {
    try {
      await db.query(
        `INSERT INTO worker_heartbeats (worker_name, last_heartbeat_at, pid, hostname)
         VALUES ($1, now(), $2, $3)
         ON CONFLICT (worker_name)
         DO UPDATE SET last_heartbeat_at = now(), pid = EXCLUDED.pid, hostname = EXCLUDED.hostname`,
        [workerName, pid, hostname],
      );
    } catch (error) {
      logger.warn("heartbeat", `Failed to write heartbeat for ${workerName}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  void beat();
  const interval = setInterval(() => void beat(), HEARTBEAT_INTERVAL_MS);
  return () => clearInterval(interval);
}

// Wire the worker process so that any unhandled async failure causes a clean
// non-zero exit. systemd (or pm2) restarts the process; a crashed worker that
// keeps running half-dead is the worse failure mode because the heartbeat keeps
// updating while no actual work happens.
export function installCrashHandlers(workerName: string) {
  process.on("unhandledRejection", (reason) => {
    logger.error(workerName, "Unhandled promise rejection", {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
    process.exit(1);
  });

  process.on("uncaughtException", (err) => {
    logger.error(workerName, "Uncaught exception", {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });
}
