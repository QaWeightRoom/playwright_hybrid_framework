import type { Page } from '@playwright/test';
import { LoginPage } from '@/pages/login.page';

export type PagesFixtures = {
  loginPage: LoginPage;
};

export const pagesFixtures = {
  loginPage: async ({ page }: { page: Page }, use: (v: LoginPage) => Promise<void>) => {
    await use(new LoginPage(page));
  },
};
