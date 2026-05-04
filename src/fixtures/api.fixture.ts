import type { APIRequestContext } from '@playwright/test';
import { UsersApi } from '@/api/users.api';

export type ApiFixtures = {
  usersApi: UsersApi;
};

// `request` here is Playwright's built-in APIRequestContext — unauthenticated.
// To attach auth from .auth/<role>.json, replace this fixture with one that
// constructs a new request context from a saved storageState. See the comment
// in `src/api/base.client.ts` for the two recommended approaches.
export const apiFixtures = {
  usersApi: async (
    { request }: { request: APIRequestContext },
    use: (v: UsersApi) => Promise<void>,
  ) => {
    await use(new UsersApi(request));
  },
};
