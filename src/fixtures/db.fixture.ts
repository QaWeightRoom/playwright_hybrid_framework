import type { Pool } from 'pg';
import { getPool, closePool } from '@/db/client';

// Worker-scoped fixtures — these go into the WorkerFixtures type parameter
// of test.extend() (see Task 16).
export type DbFixtures = {
  db: Pool;
  _dbCleanup: void;
};

type DbFixtureDefinition = [
  (options: {}, use: (v: Pool) => Promise<void>) => Promise<void>,
  { scope: 'worker' }
];

type DbCleanupFixtureDefinition = [
  (options: {}, use: (v: void) => Promise<void>) => Promise<void>,
  { scope: 'worker'; auto: boolean }
];

export const dbFixtures = {
  db: [
    async ({}, use: (v: Pool) => Promise<void>) => {
      const pool = getPool();
      await use(pool);
      // Pool stays open for the worker; closed by _dbCleanup on worker teardown.
    },
    { scope: 'worker' as const },
  ] as DbFixtureDefinition,

  // Worker-scoped auto fixture: closes the pool when the worker shuts down.
  _dbCleanup: [
    async ({}, use: (v: void) => Promise<void>) => {
      await use();
      await closePool();
    },
    { scope: 'worker' as const, auto: true },
  ] as DbCleanupFixtureDefinition,
};
