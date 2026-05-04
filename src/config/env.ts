import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

const TEST_ENV = (process.env.TEST_ENV ?? 'local') as string;

loadDotenv({ path: path.resolve(process.cwd(), '.env') });
loadDotenv({ path: path.resolve(process.cwd(), `.env.${TEST_ENV}`), override: true });

const EnvSchema = z.object({
  TEST_ENV: z.enum(['local', 'dev', 'staging', 'prod']).default('local'),
  BASE_URL: z.string().url(),
  API_BASE_URL: z.string().url(),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  ADMIN_USER_EMAIL: z.string().min(1),
  ADMIN_USER_PASSWORD: z.string().min(1),
  STANDARD_USER_EMAIL: z.string().min(1),
  STANDARD_USER_PASSWORD: z.string().min(1),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  CI: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === 'true' || v === '1')
    .default(false),
  RUN_DB_TESTS: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === 'true' || v === '1')
    .default(false),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = Object.freeze(parsed.data);
export type Env = typeof env;
