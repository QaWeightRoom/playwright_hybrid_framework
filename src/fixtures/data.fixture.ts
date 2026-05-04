import type { Pool } from 'pg';
import { usersDb, type SeededUser } from '@/db/users.db';
import { fakerHelpers } from '@/utils/faker';
import { logger } from '@/utils/logger';

export type DataFixtures = {
  seededUser: SeededUser;
};

export const dataFixtures = {
  seededUser: async (
    { db }: { db: Pool },
    use: (v: SeededUser) => Promise<void>,
  ) => {
    const user = await usersDb.insertUser(db, { email: fakerHelpers.uniqueEmail() });
    logger.debug({ userId: user.id }, 'seededUser fixture created');
    try {
      await use(user);
    } finally {
      await usersDb.deleteUserById(db, user.id).catch((err) =>
        logger.warn({ err, userId: user.id }, 'seededUser cleanup failed'),
      );
    }
  },
};
