import { Pool, PoolConfig } from 'pg';
import { env } from "@/lib/env";

const poolConfig: PoolConfig = {
  connectionString: env.DATABASE_URL,
};

// Use a single pool instance across the application
let pool: Pool;

if (process.env.NODE_ENV === 'production') {
  pool = new Pool(poolConfig);
} else {
  // In development, use a global variable so the pool is preserved across hot reloads
  if (!(global as any).pgPool) {
    (global as any).pgPool = new Pool(poolConfig);
  }
  pool = (global as any).pgPool;
}

export const poolInstance = pool;

export const db = {
  query: (text: string, params?: any[]) => poolInstance.query(text, params),
  connect: () => poolInstance.connect(),
};

export default db;
