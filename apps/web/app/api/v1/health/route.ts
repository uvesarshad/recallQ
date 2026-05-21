import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Heartbeat older than this is reported as `down`. Workers write every 30s
// (see lib/worker-heartbeat.ts) so 5 minutes gives plenty of slack for a
// scheduled GC pause, brief network hiccup, or systemd restart.
const WORKER_DOWN_AFTER_SECONDS = 300;

type Status = "up" | "down" | "unknown";

// GET /api/v1/health — no auth. Returns 200 when everything is healthy, 503
// otherwise. Designed to be the single URL CloudPanel / uptime checks ping.
export async function GET(): Promise<Response> {
  let dbStatus: Exclude<Status, "unknown"> = "down";
  let enrichment: Status = "unknown";
  let reminders: Status = "unknown";

  try {
    const ping = await db.query("SELECT 1");
    if ((ping.rowCount ?? 0) === 1) dbStatus = "up";
  } catch {
    // db stays "down"
  }

  if (dbStatus === "up") {
    try {
      const result = await db.query<{ worker_name: string; age_seconds: number }>(
        `SELECT worker_name,
                EXTRACT(EPOCH FROM (now() - last_heartbeat_at))::int AS age_seconds
           FROM worker_heartbeats`,
      );
      for (const row of result.rows) {
        const status: Status = row.age_seconds < WORKER_DOWN_AFTER_SECONDS ? "up" : "down";
        if (row.worker_name === "enrichment") enrichment = status;
        if (row.worker_name === "reminders") reminders = status;
      }
    } catch {
      // worker_heartbeats may not exist yet on installs that haven't run
      // migration 012; leaving both workers as "unknown" is fine.
    }
  }

  const ok = dbStatus === "up" && enrichment !== "down" && reminders !== "down";

  return Response.json(
    {
      ok,
      db: dbStatus,
      workers: { enrichment, reminders },
      ts: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: {
        // Tiny edge cache so uptime probes hitting once per minute don't
        // spam the DB. SWR keeps a healthy response visible briefly while
        // the next probe is in flight.
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      },
    },
  );
}
