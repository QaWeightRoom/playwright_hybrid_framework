import type { APIRequestContext } from '@playwright/test';
import { UsersApi } from '@/api/users.api';

export type ApiFixtures = {
  usersApi: UsersApi;
};

export const apiFixtures = {
  usersApi: async (
    { request }: { request: APIRequestContext },
    use: (v: UsersApi) => Promise<void>,
  ) => {
    await use(new UsersApi(request));
  },
};
