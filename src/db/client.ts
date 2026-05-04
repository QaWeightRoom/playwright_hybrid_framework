import { Pool } from 'pg';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      max: 5,
      idleTimeoutMillis: 10_000,
    });
    pool.on('error', (err) => logger.error({ err }, 'unexpected pg pool error'));
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
