import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '@/config/env';
import { storageStatePath } from '@/utils/auth';

const authDir = path.resolve(process.cwd(), '.auth');
if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

setup('authenticate as admin', async ({ page }) => {
  await page.goto(new URL('/login', env.BASE_URL).toString());
  await page.locator('#username').fill(env.ADMIN_USER_EMAIL);
  await page.locator('#password').fill(env.ADMIN_USER_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('#flash')).toContainText(/You logged into a secure area/i);
  await page.context().storageState({ path: storageStatePath('admin') });
});

setup('authenticate as standard user', async ({ page }) => {
  await page.goto(new URL('/login', env.BASE_URL).toString());
  await page.locator('#username').fill(env.STANDARD_USER_EMAIL);
  await page.locator('#password').fill(env.STANDARD_USER_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('#flash')).toContainText(/You logged into a secure area/i);
  await page.context().storageState({ path: storageStatePath('standard') });
});
