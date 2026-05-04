import { test, expect } from '@playwright/test';
import { fakerHelpers } from '@/utils/faker';

test('uniqueEmail returns a syntactically valid email', () => {
  const email = fakerHelpers.uniqueEmail();
  expect(email).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
});

test('uniqueEmail produces different values across calls', () => {
  const a = fakerHelpers.uniqueEmail();
  const b = fakerHelpers.uniqueEmail();
  expect(a).not.toBe(b);
});

test('uniqueEmail embeds the worker index for cross-worker isolation', () => {
  const email = fakerHelpers.uniqueEmail();
  const expectedWorker = process.env.TEST_WORKER_INDEX ?? '0';
  expect(email).toContain(`w${expectedWorker}`);
});
