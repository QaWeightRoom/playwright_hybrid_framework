import { test, expect } from '@/fixtures';

test.describe('UsersApi (sample, against jsonplaceholder)', () => {
  test('lists users', async ({ usersApi }) => {
    const users = await usersApi.list();
    expect(users.length).toBeGreaterThan(0);
    expect(users[0]).toHaveProperty('email');
  });

  test('gets a single user by id', async ({ usersApi }) => {
    const user = await usersApi.get(1);
    expect(user.id).toBe(1);
    expect(user.email).toMatch(/@/);
  });
});
