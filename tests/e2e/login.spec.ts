import { test, expect } from '@/fixtures';
import { env } from '@/config/env';
import { usersDb } from '@/db/users.db';

test.describe('Login flow', () => {
  // The default storageState ('standard') means the user is already logged in
  // from auth.setup.ts. We open a new context here to demonstrate logging in
  // explicitly via the LoginPage object.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('logs in with valid credentials', async ({ loginPage, page }) => {
    await loginPage.open();
    await loginPage.loginAs(env.STANDARD_USER_EMAIL, env.STANDARD_USER_PASSWORD);
    await expect(page.locator('#flash')).toContainText(/You logged into a secure area/i);
  });

  test('shows an error with invalid credentials', async ({ loginPage, page }) => {
    await loginPage.open();
    await loginPage.loginAs('definitely-not-a-user', 'wrong');
    await expect(page.locator('#flash')).toContainText(/Your username is invalid/i);
  });
});

test.describe('DB-backed seeding (sample)', () => {
  test.skip(!env.RUN_DB_TESTS, 'Set RUN_DB_TESTS=1 and provide DB_* vars to run.');

  test('seededUser fixture creates and cleans up a row', async ({ seededUser, db }) => {
    expect(seededUser.id).toBeGreaterThan(0);
    const found = await usersDb.findById(db, seededUser.id);
    expect(found).not.toBeNull();
    expect(found?.email).toBe(seededUser.email);
  });
});
