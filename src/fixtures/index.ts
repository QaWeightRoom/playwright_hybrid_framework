import { test as base } from '@playwright/test';
import { pagesFixtures, type PagesFixtures } from '@/fixtures/pages.fixture';
import { apiFixtures, type ApiFixtures } from '@/fixtures/api.fixture';
import { dbFixtures, type DbFixtures } from '@/fixtures/db.fixture';
import { dataFixtures, type DataFixtures } from '@/fixtures/data.fixture';

// Test-scoped fixtures: re-instantiated per test.
type TestScopedFixtures = PagesFixtures & ApiFixtures & DataFixtures;

// Worker-scoped fixtures: shared across all tests in a worker (one pg.Pool per worker).
type WorkerScopedFixtures = DbFixtures;

export const test = base.extend<TestScopedFixtures, WorkerScopedFixtures>(
  {
    ...pagesFixtures,
    ...apiFixtures,
    ...dbFixtures,
    ...dataFixtures,
  } as unknown as Parameters<typeof base.extend<TestScopedFixtures, WorkerScopedFixtures>>[0],
);

export { expect } from '@playwright/test';
