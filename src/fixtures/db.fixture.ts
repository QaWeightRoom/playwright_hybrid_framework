import type { Pool } from 'pg';
import { getPool, closePool } from '@/db/client';

// Worker-scoped fixtures — these go into the WorkerFixtures type parameter
// of test.extend() (see Task 16).
export type DbFixtures = {
  db: Pool;
  _dbCleanup: void;
};

export const dbFixtures = {
  db: [
    async ({}, use: (v: Pool) => Promise<void>) => {
      const pool = getPool();
      await use(pool);
      // Pool stays open for the worker; closed by _dbCleanup on worker teardown.
    },
    { scope: 'worker' as const },
  ],

  // Worker-scoped auto fixture: closes the pool when the worker shuts down.
  _dbCleanup: [
    async ({}, use: (v: void) => Promise<void>) => {
      await use();
      await closePool();
    },
    { scope: 'worker' as const, auto: true },
  ],
};
