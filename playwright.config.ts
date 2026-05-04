import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: [['list']],
  projects: [
    {
      name: 'unit',
      testDir: './tests/unit',
      use: {},
    },
  ],
});
