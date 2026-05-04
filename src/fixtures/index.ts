import { test as base } from '@playwright/test';
import { pagesFixtures, type PagesFixtures } from '@/fixtures/pages.fixture';
import { apiFixtures, type ApiFixtures } from '@/fixtures/api.fixture';
import { dbFixtures, type DbFixtures } from '@/fixtures/db.fixture';
import { dataFixtures, type DataFixtures } from '@/fixtures/data.fixture';

// Test-scoped fixtures: re-instantiated per test.
type TestScopedFixtures = PagesFixtures & ApiFixtures & DataFixtures;

// Worker-scoped fixtures: shared across all tests in a worker (one pg.Pool per worker).
type WorkerScopedFixtures = DbFixtures;

// Explicit per-fixture assignment (rather than spread) keeps the tuple types
// `[fn, { scope: 'worker' }]` narrow — spreading widens them to `(fn|{scope})[]`
// and breaks the extend() signature.
export const test = base.extend<TestScopedFixtures, WorkerScopedFixtures>({
  loginPage: pagesFixtures.loginPage,
  usersApi: apiFixtures.usersApi,
  db: dbFixtures.db,
  _dbCleanup: dbFixtures._dbCleanup,
  seededUser: dataFixtures.seededUser,
});

export { expect } from '@playwright/test';
