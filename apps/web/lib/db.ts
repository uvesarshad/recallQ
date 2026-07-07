import { Pool, type PoolConfig, type QueryResultRow } from "pg";
import { env } from "@/lib/env";

const poolConfig: PoolConfig = {
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

declare global {
  var pgPool: Pool | undefined;
}

function createPool() {
  const nextPool = new Pool(poolConfig);
  nextPool.on("error", (error) => {
    console.error("Postgres pool error:", error);
  });
  return nextPool;
}

function getPool() {
  if (process.env.NODE_ENV === "production") {
    if (!poolInstance) {
      poolInstance = createPool();
    }
    return poolInstance;
  }

  if (!global.pgPool) {
    global.pgPool = createPool();
  }

  poolInstance = global.pgPool;
  return poolInstance;
}

function isClosedConnectionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /connection (closed|terminated)|pool is ended|client was closed/i.test(error.message);
}

function resetPool() {
  const current = poolInstance;
  poolInstance = createPool();

  if (process.env.NODE_ENV !== "production") {
    global.pgPool = poolInstance;
  }

  if (current && current !== poolInstance) {
    void current.end().catch(() => undefined);
  }
}

export let poolInstance: Pool = process.env.NODE_ENV === "production" ? createPool() : (global.pgPool ??= createPool());

export const db = {
  async query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) {
    try {
      return await getPool().query<T>(text, params);
    } catch (error) {
      if (!isClosedConnectionError(error)) {
        throw error;
      }

      resetPool();
      return getPool().query<T>(text, params);
    }
  },
  connect: () => getPool().connect(),
};

export default db;
