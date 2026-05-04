import type { Page, Response } from '@playwright/test';

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  // Relative paths resolve against the project's `baseURL` (set in playwright.config.ts).
  // Pass an absolute URL to override.
  async goto(pathOrUrl = '/'): Promise<Response | null> {
    return this.page.goto(pathOrUrl, { waitUntil: 'domcontentloaded' });
  }

  async title(): Promise<string> {
    return this.page.title();
  }
}
