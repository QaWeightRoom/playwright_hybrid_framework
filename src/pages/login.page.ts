import type { Page } from '@playwright/test';
import { BasePage } from '@/pages/base.page';

export class LoginPage extends BasePage {
  private readonly usernameInput = this.page.locator('#username');
  private readonly passwordInput = this.page.locator('#password');
  private readonly submitButton = this.page.locator('button[type="submit"]');
  private readonly flash = this.page.locator('#flash');

  constructor(page: Page) {
    super(page);
  }

  async open(): Promise<void> {
    await this.goto('/login');
  }

  async loginAs(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async successMessage(): Promise<string> {
    return (await this.flash.textContent())?.trim() ?? '';
  }
}
