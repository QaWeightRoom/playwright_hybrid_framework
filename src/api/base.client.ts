import type { APIRequestContext, APIResponse } from '@playwright/test';

export abstract class BaseClient {
  constructor(protected readonly request: APIRequestContext) {}

  protected async json<T>(response: APIResponse): Promise<T> {
    if (!response.ok()) {
      const body = await response.text().catch(() => '<no body>');
      throw new Error(`API ${response.status()} ${response.url()}: ${body}`);
    }
    return (await response.json()) as T;
  }
}
