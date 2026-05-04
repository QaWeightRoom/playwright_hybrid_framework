import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';
import { storageStatePath } from './src/utils/auth';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: env.CI,
  retries: env.CI ? 2 : 0,
  workers: env.CI ? 2 : undefined,
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'unit',
      testDir: './tests/unit',
      use: {},
    },
    {
      name: 'setup',
      testMatch: /.*auth\.setup\.ts/,
      use: { baseURL: env.BASE_URL },
    },
    {
      name: 'e2e',
      testDir: './tests/e2e',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: env.BASE_URL,
        storageState: storageStatePath('standard'),
      },
    },
    {
      name: 'api',
      testDir: './tests/api',
      dependencies: ['setup'],
      use: {
        baseURL: env.API_BASE_URL,
      },
    },
  ],
});
