import { faker } from '@faker-js/faker';

let counter = 0;

function workerSuffix(): string {
  const w = process.env.TEST_WORKER_INDEX ?? '0';
  return `w${w}`;
}

export const fakerHelpers = {
  uniqueEmail(): string {
    counter += 1;
    const ts = Date.now();
    return `test+${workerSuffix()}-${ts}-${counter}@example.com`;
  },
  uniqueUsername(): string {
    counter += 1;
    return `user_${workerSuffix()}_${Date.now()}_${counter}`;
  },
  fullName(): string {
    return faker.person.fullName();
  },
  raw: faker,
};
