import { test, expect } from '@playwright/test';
import { env } from '@/config/env';

test('env loader exposes a typed BASE_URL', () => {
  expect(env.BASE_URL).toMatch(/^https?:\/\//);
});

test('env loader coerces DB_PORT to a number', () => {
  expect(typeof env.DB_PORT).toBe('number');
  expect(env.DB_PORT).toBeGreaterThan(0);
});

test('env loader exposes the chosen TEST_ENV', () => {
  expect(['local', 'dev', 'staging', 'prod']).toContain(env.TEST_ENV);
});
