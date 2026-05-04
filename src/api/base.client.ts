import type { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * Base for service-wrapped API clients.
 *
 * NOTE on authentication:
 * The default `request` context inherits the project's `baseURL` and any
 * `extraHTTPHeaders` set in playwright.config.ts. The sample target (jsonplaceholder)
 * needs no auth, so this base class wires none.
 *
 * For an authenticated backend, choose one of:
 *   1. Set `extraHTTPHeaders: { Authorization: `Bearer ${token}` }` on the `api`
 *      project in playwright.config.ts (simplest if a single static token works).
 *   2. Replace the `request` fixture in `src/fixtures/api.fixture.ts` with a
 *      custom one that builds an `APIRequestContext` from a stored cookie/token —
 *      e.g., load `storageStatePath('standard')` JSON and pass its cookies to
 *      `playwright.request.newContext({ storageState })`.
 */
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
