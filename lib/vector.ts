import { db } from "@/lib/db";

let cachedSupport: boolean | null = null;

export async function hasVectorSupport() {
  if (cachedSupport !== null) {
    return cachedSupport;
  }

  try {
    const extension = await db.query(
      "SELECT 1 FROM pg_extension WHERE extname = 'vector' LIMIT 1",
    );
    if (extension.rowCount === 0) {
      cachedSupport = false;
      return cachedSupport;
    }

    const column = await db.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_name = 'items'
         AND column_name = 'embedding'
       LIMIT 1`,
    );
    cachedSupport = (column.rowCount ?? 0) > 0;
    return cachedSupport;
  } catch {
    cachedSupport = false;
    return cachedSupport;
  }
}
