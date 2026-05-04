import type { Page, Response } from '@playwright/test';
import { env } from '@/config/env';

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(pathOrUrl = '/'): Promise<Response | null> {
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : new URL(pathOrUrl, env.BASE_URL).toString();
    return this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  async title(): Promise<string> {
    return this.page.title();
  }
}
