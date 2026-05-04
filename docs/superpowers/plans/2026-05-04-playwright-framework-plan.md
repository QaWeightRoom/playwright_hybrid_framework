# Playwright E2E + API Framework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-05-04-playwright-framework-design.md`](../specs/2026-05-04-playwright-framework-design.md)

**Goal:** Build a TypeScript Playwright template for E2E + REST API testing with PostgreSQL precondition seeding, multi-environment config, fixture-based POM, retries with traces on failure, and a GitHub Actions workflow.

**Architecture:** Framework code in `src/`, specs in `tests/`. A typed `env` loader reads `.env` + `.env.{TEST_ENV}` with zod validation. Page objects, API service clients, the PG pool, and per-test seeded data are all delivered through Playwright fixtures merged into a single `test` export.

**Tech Stack:** TypeScript 5, Node 20, Playwright (`@playwright/test`), `pg`, `dotenv`, `zod`, `pino`, `@faker-js/faker`. Tooling: ESLint, Prettier. CI: GitHub Actions.

---

## File Structure

Created over the course of this plan:

```
agenticPW/
├─ .gitignore
├─ .env                                       # gitignored, dev defaults
├─ .env.example                               # committed template
├─ package.json
├─ tsconfig.json
├─ .eslintrc.cjs
├─ .prettierrc
├─ playwright.config.ts
├─ .github/workflows/playwright.yml
├─ README.md
├─ src/
│  ├─ config/
│  │  ├─ env.ts                # zod-validated env loader
│  │  └─ types.ts              # AppEnv, UserRole types
│  ├─ pages/
│  │  ├─ base.page.ts
│  │  └─ login.page.ts
│  ├─ components/              # (empty in scaffold; pattern documented in README)
│  ├─ api/
│  │  ├─ base.client.ts
│  │  └─ users.api.ts
│  ├─ db/
│  │  ├─ client.ts             # pg.Pool factory + close hook
│  │  └─ users.db.ts           # typed CRUD helpers
│  ├─ fixtures/
│  │  ├─ index.ts              # merges all fixtures into one test
│  │  ├─ pages.fixture.ts
│  │  ├─ api.fixture.ts
│  │  ├─ db.fixture.ts
│  │  └─ data.fixture.ts       # seededUser etc. with auto-cleanup
│  └─ utils/
│     ├─ logger.ts             # pino
│     ├─ faker.ts              # uniqueEmail with worker-id prefix
│     └─ auth.ts               # storage state path resolver
└─ tests/
   ├─ auth.setup.ts            # writes .auth/<role>.json
   ├─ unit/
   │  ├─ env.test.ts
   │  ├─ faker.test.ts
   │  └─ auth.test.ts
   ├─ e2e/
   │  └─ login.spec.ts
   └─ api/
      └─ users.spec.ts
```

The DB-seeded sample test is included inside `tests/e2e/login.spec.ts` and is `test.skip()`'d unless `RUN_DB_TESTS=1` is set, because the public demo app used for the out-of-the-box bootstrap doesn't expose a database.

---

## Sample Targets (out-of-the-box runnable)

- **E2E**: `https://practice.expandtesting.com/login` (form takes `practice` / `SuperSecretPassword!`).
- **API**: `https://jsonplaceholder.typicode.com` (no auth, returns deterministic fake data).
- **DB sample**: skipped by default; demonstrates the fixture pattern. To exercise it locally, the engineer runs Postgres (via Docker or otherwise), sets `DB_*` vars, and `RUN_DB_TESTS=1`.

These are placeholder targets — the consuming team replaces them per `README.md` Step 2.

---

## Task 0: Initialize git repo and project directory

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Initialize git**

```bash
git init -b main
```

- [ ] **Step 2: Create `.gitignore`**

```gitignore
# Dependencies
node_modules/

# Env files (committed: .env.example only)
.env
.env.*
!.env.example

# Auth state (generated at runtime)
.auth/

# Test artifacts
playwright-report/
test-results/
blob-report/
playwright/.cache/

# IDE / OS
.vscode/
.idea/
.DS_Store
Thumbs.db

# Build
dist/
*.tsbuildinfo
```

- [ ] **Step 3: Stage existing spec + .gitignore and commit**

```bash
git add .gitignore docs/
git commit -m "chore: init repo with spec and gitignore"
```

Expected: clean commit, working tree clean afterwards.

---

## Task 1: Initialize Node + TypeScript project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`

- [ ] **Step 1: Initialize npm**

```bash
npm init -y
```

- [ ] **Step 2: Install runtime + dev dependencies**

```bash
npm install --save-dev @playwright/test typescript @types/node \
  dotenv zod pg @types/pg @faker-js/faker pino pino-pretty \
  eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin \
  eslint-plugin-playwright prettier eslint-config-prettier
```

- [ ] **Step 3: Install Playwright browsers**

```bash
npx playwright install --with-deps chromium
```

Expected: chromium downloaded to `~/.cache/ms-playwright` (or Windows equivalent).

- [ ] **Step 4: Replace `package.json` with the framework template**

Open `package.json` and replace its contents with:

```json
{
  "name": "playwright-framework-template",
  "version": "0.1.0",
  "description": "Opinionated Playwright + PostgreSQL test framework template",
  "private": true,
  "type": "module",
  "scripts": {
    "test":         "playwright test",
    "test:local":   "cross-env TEST_ENV=local playwright test",
    "test:dev":     "cross-env TEST_ENV=dev playwright test",
    "test:staging": "cross-env TEST_ENV=staging playwright test",
    "test:prod":    "cross-env TEST_ENV=prod playwright test",
    "test:e2e":     "playwright test --project=e2e",
    "test:api":     "playwright test --project=api",
    "test:unit":    "playwright test --project=unit",
    "test:debug":   "playwright test --debug",
    "test:headed":  "playwright test --headed",
    "report":       "playwright show-report",
    "lint":         "eslint . --ext .ts",
    "format":       "prettier --write \"**/*.{ts,json,md,yml}\"",
    "typecheck":    "tsc --noEmit"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 5: Install `cross-env` for the env-prefixed npm scripts**

```bash
npm install --save-dev cross-env
```

(`cross-env` is what makes `TEST_ENV=foo` work the same on PowerShell, cmd, and bash.)

- [ ] **Step 6: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": false,
    "declaration": false,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "types": ["node"]
  },
  "include": ["src/**/*", "tests/**/*", "playwright.config.ts"],
  "exclude": ["node_modules", "playwright-report", "test-results", "dist"]
}
```

- [ ] **Step 7: Verify typecheck passes on an empty project**

```bash
npx tsc --noEmit
```

Expected: exits 0 with no output.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json
git commit -m "chore: init typescript + playwright + dependencies"
```

---

## Task 2: ESLint + Prettier config

**Note:** ESLint 9+ uses flat config (`eslint.config.js`), not the legacy `.eslintrc.cjs`. The `--ext` CLI flag is also gone — file globs go in the config.

**Files:**
- Create: `eslint.config.js`
- Create: `.prettierrc`
- Create: `.prettierignore`
- Modify: `package.json` (lint script — remove `--ext .ts`)

- [ ] **Step 1: Create `eslint.config.js` (flat config)**

```js
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import playwright from 'eslint-plugin-playwright';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['node_modules/**', 'playwright-report/**', 'test-results/**', 'dist/**', '.auth/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      playwright,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...playwright.configs['flat/recommended'].rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'playwright/no-skipped-test': 'off',
    },
  },
  prettier,
];
```

If `@eslint/js` is not in `node_modules`, install it:

```bash
npm install --save-dev @eslint/js
```

Also fix the lint script in `package.json` — remove `--ext .ts` (no longer supported):

```json
"lint": "eslint .",
```

- [ ] **Step 2: Create `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

- [ ] **Step 3: Create `.prettierignore`**

```
node_modules
playwright-report
test-results
dist
.auth
package-lock.json
```

- [ ] **Step 4: Verify lint runs (no files yet, should be clean)**

```bash
npm run lint
```

Expected: exits 0; "No files matching the pattern" is acceptable.

- [ ] **Step 5: Commit**

```bash
git add .eslintrc.cjs .prettierrc .prettierignore
git commit -m "chore: add eslint + prettier config"
```

---

## Task 3: `.env` files

**Files:**
- Create: `.env.example`
- Create: `.env` (gitignored — for local typecheck/tests to load something)

- [ ] **Step 1: Create `.env.example`**

```bash
# Which environment to load. One of: local | dev | staging | prod.
# Determines which .env.{TEST_ENV} file is loaded on top of .env.
TEST_ENV=local

# Application URLs
BASE_URL=https://practice.expandtesting.com
API_BASE_URL=https://jsonplaceholder.typicode.com

# PostgreSQL connection (used by db/* helpers and data fixtures).
# Sample DB-backed test is skipped unless RUN_DB_TESTS=1.
DB_HOST=localhost
DB_PORT=5432
DB_NAME=testdb
DB_USER=postgres
DB_PASSWORD=postgres

# Test users (one per role). Add more roles as needed.
ADMIN_USER_EMAIL=practice
ADMIN_USER_PASSWORD=SuperSecretPassword!
STANDARD_USER_EMAIL=practice
STANDARD_USER_PASSWORD=SuperSecretPassword!

# Logging
LOG_LEVEL=info

# Set to 1 to include the DB-backed sample test in the run.
RUN_DB_TESTS=0
```

- [ ] **Step 2: Create local `.env` (copy of example for first-run convenience)**

```bash
cp .env.example .env
```

(On Windows PowerShell: `Copy-Item .env.example .env`.)

- [ ] **Step 3: Verify gitignore is keeping `.env` out**

```bash
git status --short .env .env.example
```

Expected: `.env.example` is shown (untracked or staged), `.env` is NOT shown.

- [ ] **Step 4: Commit `.env.example`**

```bash
git add .env.example
git commit -m "chore: add .env.example template"
```

---

## Task 4: Minimal Playwright config (enough to run unit tests)

We need a working test runner before we can TDD anything.

**Files:**
- Create: `playwright.config.ts` (will be expanded in Task 17)

- [ ] **Step 1: Create initial `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: [['list']],
  projects: [
    {
      name: 'unit',
      testDir: './tests/unit',
      use: {},
    },
  ],
});
```

- [ ] **Step 2: Verify it parses**

```bash
npx playwright test --list
```

Expected: "Error: No tests found" (because `tests/unit/` doesn't exist yet) — that's fine; config parsed successfully.

- [ ] **Step 3: Commit**

```bash
git add playwright.config.ts
git commit -m "chore: minimal playwright config (unit project only)"
```

---

## Task 5: Typed env loader (TDD)

**Files:**
- Create: `tests/unit/env.test.ts`
- Create: `src/config/env.ts`
- Create: `src/config/types.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/env.test.ts`:

```ts
import { test, expect } from '@playwright/test';
import { env } from '@/config/env';

test('env loader exposes a typed BASE_URL', () => {
  expect(env.BASE_URL).toMatch(/^https?:\/\//);
});

test('env loader coerces DB_PORT to a number', () => {
  expect(typeof env.DB_PORT).toBe('number');
  expect(env.DB_PORT).toBeGreaterThan(0);
});

test('env loader exposes the chosen TEST_ENV', () => {
  expect(['local', 'dev', 'staging', 'prod']).toContain(env.TEST_ENV);
});
```

(The "throws on missing var" path is exercised implicitly: if zod validation broke, the import would throw and every test would fail.)

- [ ] **Step 2: Run — expect fail**

```bash
npx playwright test --project=unit tests/unit/env.test.ts
```

Expected: tests fail because `src/config/env.ts` doesn't exist yet.

- [ ] **Step 3: Implement `src/config/types.ts`**

```ts
export type AppEnv = 'local' | 'dev' | 'staging' | 'prod';

export type UserRole = 'admin' | 'standard';
```

- [ ] **Step 4: Implement `src/config/env.ts`**

```ts
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
```

- [ ] **Step 5: Run — expect pass**

```bash
npx playwright test --project=unit tests/unit/env.test.ts
```

Expected: both tests pass.

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add tests/unit/env.test.ts src/config/env.ts src/config/types.ts
git commit -m "feat(config): typed env loader with zod validation"
```

---

## Task 6: Logger utility

**Files:**
- Create: `src/utils/logger.ts`

No test — pino is well-tested upstream; we wrap it minimally.

- [ ] **Step 1: Implement `src/utils/logger.ts`**

```ts
import pino from 'pino';
import { env } from '@/config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: env.CI
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } },
});
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/utils/logger.ts
git commit -m "feat(utils): pino logger driven by env.LOG_LEVEL"
```

---

## Task 7: Faker wrapper with worker-isolated unique values (TDD)

**Files:**
- Create: `tests/unit/faker.test.ts`
- Create: `src/utils/faker.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/faker.test.ts`:

```ts
import { test, expect } from '@playwright/test';
import { fakerHelpers } from '@/utils/faker';

test('uniqueEmail returns a syntactically valid email', () => {
  const email = fakerHelpers.uniqueEmail();
  expect(email).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
});

test('uniqueEmail produces different values across calls', () => {
  const a = fakerHelpers.uniqueEmail();
  const b = fakerHelpers.uniqueEmail();
  expect(a).not.toBe(b);
});

test('uniqueEmail embeds the worker index for cross-worker isolation', () => {
  const email = fakerHelpers.uniqueEmail();
  // TEST_WORKER_INDEX is set by Playwright; defaults to "0" when not in a worker.
  const expectedWorker = process.env.TEST_WORKER_INDEX ?? '0';
  expect(email).toContain(`w${expectedWorker}`);
});
```

- [ ] **Step 2: Run — expect fail**

```bash
npx playwright test --project=unit tests/unit/faker.test.ts
```

Expected: fails with "Cannot find module '@/utils/faker'".

- [ ] **Step 3: Implement `src/utils/faker.ts`**

```ts
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
```

- [ ] **Step 4: Run — expect pass**

```bash
npx playwright test --project=unit tests/unit/faker.test.ts
```

Expected: all three tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/faker.test.ts src/utils/faker.ts
git commit -m "feat(utils): faker wrapper with worker-isolated unique generators"
```

---

## Task 8: Auth utility — storage state path resolver (TDD)

**Files:**
- Create: `tests/unit/auth.test.ts`
- Create: `src/utils/auth.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/auth.test.ts`:

```ts
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { storageStatePath } from '@/utils/auth';

test('storageStatePath returns .auth/<role>.json under cwd', () => {
  const p = storageStatePath('admin');
  expect(p).toBe(path.resolve(process.cwd(), '.auth', 'admin.json'));
});

test('storageStatePath rejects empty role', () => {
  expect(() => storageStatePath('' as never)).toThrow(/role/i);
});
```

- [ ] **Step 2: Run — expect fail**

```bash
npx playwright test --project=unit tests/unit/auth.test.ts
```

- [ ] **Step 3: Implement `src/utils/auth.ts`**

```ts
import path from 'node:path';
import type { UserRole } from '@/config/types';

export function storageStatePath(role: UserRole): string {
  if (!role) {
    throw new Error('storageStatePath: role is required');
  }
  return path.resolve(process.cwd(), '.auth', `${role}.json`);
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npx playwright test --project=unit tests/unit/auth.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tests/unit/auth.test.ts src/utils/auth.ts
git commit -m "feat(utils): storage state path resolver"
```

---

## Task 9: Database client (singleton pg.Pool)

**Files:**
- Create: `src/db/client.ts`

No unit test — exercising it requires a real Postgres. The DB-seeded sample test (Task 19) acts as the integration test, gated behind `RUN_DB_TESTS=1`.

- [ ] **Step 1: Implement `src/db/client.ts`**

```ts
import { Pool } from 'pg';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      max: 5,
      idleTimeoutMillis: 10_000,
    });
    pool.on('error', (err) => logger.error({ err }, 'unexpected pg pool error'));
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/db/client.ts
git commit -m "feat(db): pg.Pool singleton with graceful shutdown"
```

---

## Task 10: Users DB helpers

**Files:**
- Create: `src/db/users.db.ts`

No unit test (same reason as Task 9). Shape and signatures must match what `data.fixture.ts` (Task 16) calls.

- [ ] **Step 1: Implement `src/db/users.db.ts`**

```ts
import type { Pool } from 'pg';

export type SeededUser = {
  id: number;
  email: string;
  createdAt: Date;
};

export type InsertUserInput = {
  email: string;
};

/**
 * Sample schema assumed:
 *   CREATE TABLE users (
 *     id          serial PRIMARY KEY,
 *     email       text UNIQUE NOT NULL,
 *     created_at  timestamptz NOT NULL DEFAULT now()
 *   );
 */
export const usersDb = {
  async insertUser(pool: Pool, input: InsertUserInput): Promise<SeededUser> {
    const result = await pool.query<{ id: number; email: string; created_at: Date }>(
      'INSERT INTO users (email) VALUES ($1) RETURNING id, email, created_at',
      [input.email],
    );
    const row = result.rows[0];
    if (!row) throw new Error('insertUser: no row returned');
    return { id: row.id, email: row.email, createdAt: row.created_at };
  },

  async deleteUserById(pool: Pool, id: number): Promise<void> {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
  },

  async findByEmail(pool: Pool, email: string): Promise<SeededUser | null> {
    const result = await pool.query<{ id: number; email: string; created_at: Date }>(
      'SELECT id, email, created_at FROM users WHERE email = $1',
      [email],
    );
    const row = result.rows[0];
    return row ? { id: row.id, email: row.email, createdAt: row.created_at } : null;
  },
};
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/db/users.db.ts
git commit -m "feat(db): users helpers (insert/delete/find) with parameterized SQL"
```

---

## Task 11: BasePage and LoginPage

**Files:**
- Create: `src/pages/base.page.ts`
- Create: `src/pages/login.page.ts`

Selectors target `https://practice.expandtesting.com/login`. Replace per `README.md` Step 2 when adapting to a real app.

- [ ] **Step 1: Implement `src/pages/base.page.ts`**

```ts
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
```

- [ ] **Step 2: Implement `src/pages/login.page.ts`**

```ts
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
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/base.page.ts src/pages/login.page.ts
git commit -m "feat(pages): BasePage and LoginPage for sample login flow"
```

---

## Task 12: API base client and Users API service

**Files:**
- Create: `src/api/base.client.ts`
- Create: `src/api/users.api.ts`

- [ ] **Step 1: Implement `src/api/base.client.ts`**

```ts
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
```

- [ ] **Step 2: Implement `src/api/users.api.ts`**

```ts
import type { APIRequestContext } from '@playwright/test';
import { BaseClient } from '@/api/base.client';

export type ApiUser = {
  id: number;
  name: string;
  username: string;
  email: string;
};

export class UsersApi extends BaseClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async list(): Promise<ApiUser[]> {
    return this.json(await this.request.get('/users'));
  }

  async get(id: number): Promise<ApiUser> {
    return this.json(await this.request.get(`/users/${id}`));
  }

  async create(payload: Omit<ApiUser, 'id'>): Promise<ApiUser> {
    return this.json(
      await this.request.post('/users', { data: payload, headers: { 'Content-Type': 'application/json' } }),
    );
  }
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/api/base.client.ts src/api/users.api.ts
git commit -m "feat(api): BaseClient + UsersApi service wrapper"
```

---

## Task 13: Pages and API fixtures

**Files:**
- Create: `src/fixtures/pages.fixture.ts`
- Create: `src/fixtures/api.fixture.ts`

These export *fixture maps* — small objects describing how to instantiate the page/api for each test. They will be merged inside `src/fixtures/index.ts` (Task 16).

- [ ] **Step 1: Implement `src/fixtures/pages.fixture.ts`**

```ts
import type { Page } from '@playwright/test';
import { LoginPage } from '@/pages/login.page';

export type PagesFixtures = {
  loginPage: LoginPage;
};

export const pagesFixtures = {
  loginPage: async ({ page }: { page: Page }, use: (v: LoginPage) => Promise<void>) => {
    await use(new LoginPage(page));
  },
};
```

- [ ] **Step 2: Implement `src/fixtures/api.fixture.ts`**

```ts
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
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/fixtures/pages.fixture.ts src/fixtures/api.fixture.ts
git commit -m "feat(fixtures): page object and API service fixture maps"
```

---

## Task 14: DB fixture (worker-scoped Pool + close hook)

**Files:**
- Create: `src/fixtures/db.fixture.ts`

- [ ] **Step 1: Implement `src/fixtures/db.fixture.ts`**

```ts
import type { Pool } from 'pg';
import { getPool, closePool } from '@/db/client';

// Worker-scoped fixtures — these go into the WorkerFixtures type parameter
// of test.extend() (see Task 16).
export type DbFixtures = {
  db: Pool;
  _dbCleanup: void;
};

export const dbFixtures = {
  db: [
    async ({}, use: (v: Pool) => Promise<void>) => {
      const pool = getPool();
      await use(pool);
      // Pool stays open for the worker; closed by _dbCleanup on worker teardown.
    },
    { scope: 'worker' as const },
  ],

  // Worker-scoped auto fixture: closes the pool when the worker shuts down.
  _dbCleanup: [
    async ({}, use: (v: void) => Promise<void>) => {
      await use();
      await closePool();
    },
    { scope: 'worker' as const, auto: true },
  ],
};
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/fixtures/db.fixture.ts
git commit -m "feat(fixtures): worker-scoped pg pool with shutdown hook"
```

---

## Task 15: Data fixture (seededUser with auto-cleanup)

**Files:**
- Create: `src/fixtures/data.fixture.ts`

- [ ] **Step 1: Implement `src/fixtures/data.fixture.ts`**

```ts
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
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/fixtures/data.fixture.ts
git commit -m "feat(fixtures): seededUser data fixture with try/finally cleanup"
```

---

## Task 16: Merge into custom `test` export

**Files:**
- Create: `src/fixtures/index.ts`

- [ ] **Step 1: Implement `src/fixtures/index.ts`**

```ts
import { test as base } from '@playwright/test';
import { pagesFixtures, type PagesFixtures } from '@/fixtures/pages.fixture';
import { apiFixtures, type ApiFixtures } from '@/fixtures/api.fixture';
import { dbFixtures, type DbFixtures } from '@/fixtures/db.fixture';
import { dataFixtures, type DataFixtures } from '@/fixtures/data.fixture';

// Test-scoped fixtures: re-instantiated per test.
type TestScopedFixtures = PagesFixtures & ApiFixtures & DataFixtures;

// Worker-scoped fixtures: shared across all tests in a worker (one pg.Pool per worker).
type WorkerScopedFixtures = DbFixtures;

export const test = base.extend<TestScopedFixtures, WorkerScopedFixtures>({
  ...pagesFixtures,
  ...apiFixtures,
  ...dbFixtures,
  ...dataFixtures,
});

export { expect } from '@playwright/test';
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0. If you see errors about fixture option types, the upstream fixture maps' `[fn, options]` tuples need their `as const` markers (already in Task 14) — check that.

- [ ] **Step 3: Commit**

```bash
git add src/fixtures/index.ts
git commit -m "feat(fixtures): merge fixture maps into single custom test export"
```

---

## Task 17: Auth setup test (writes storage state per role)

**Files:**
- Create: `tests/auth.setup.ts`

- [ ] **Step 1: Implement `tests/auth.setup.ts`**

```ts
import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '@/config/env';
import { storageStatePath } from '@/utils/auth';

const authDir = path.resolve(process.cwd(), '.auth');
if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

setup('authenticate as admin', async ({ page }) => {
  await page.goto(new URL('/login', env.BASE_URL).toString());
  await page.locator('#username').fill(env.ADMIN_USER_EMAIL);
  await page.locator('#password').fill(env.ADMIN_USER_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('#flash')).toContainText(/You logged into a secure area/i);
  await page.context().storageState({ path: storageStatePath('admin') });
});

setup('authenticate as standard user', async ({ page }) => {
  await page.goto(new URL('/login', env.BASE_URL).toString());
  await page.locator('#username').fill(env.STANDARD_USER_EMAIL);
  await page.locator('#password').fill(env.STANDARD_USER_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('#flash')).toContainText(/You logged into a secure area/i);
  await page.context().storageState({ path: storageStatePath('standard') });
});
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add tests/auth.setup.ts
git commit -m "feat(setup): per-role auth setup writing .auth/<role>.json"
```

---

## Task 18: Final `playwright.config.ts` with all projects

**Files:**
- Modify: `playwright.config.ts` (full replacement)

- [ ] **Step 1: Replace `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';
import { storageStatePath } from './src/utils/auth';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: env.CI,
  retries: env.CI ? 2 : 0,
  workers: env.CI ? 2 : undefined,
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'unit',
      testDir: './tests/unit',
      use: {},
    },
    {
      name: 'setup',
      testMatch: /.*auth\.setup\.ts/,
      use: { baseURL: env.BASE_URL },
    },
    {
      name: 'e2e',
      testDir: './tests/e2e',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: env.BASE_URL,
        storageState: storageStatePath('standard'),
      },
    },
    {
      name: 'api',
      testDir: './tests/api',
      dependencies: ['setup'],
      use: {
        baseURL: env.API_BASE_URL,
      },
    },
  ],
});
```

- [ ] **Step 2: Verify config still parses**

```bash
npx playwright test --list
```

Expected: lists tests from `tests/unit/` (env, faker, auth) — no errors. The `setup`, `e2e`, `api` projects show no tests yet because we haven't written specs.

- [ ] **Step 3: Commit**

```bash
git add playwright.config.ts
git commit -m "feat(config): full playwright config with setup/e2e/api/unit projects"
```

---

## Task 19: Sample E2E test

**Files:**
- Create: `tests/e2e/login.spec.ts`

- [ ] **Step 1: Implement `tests/e2e/login.spec.ts`**

```ts
import { test, expect } from '@/fixtures';
import { env } from '@/config/env';

test.describe('Login flow', () => {
  // The default storageState ('standard') means the user is already logged in
  // from auth.setup.ts. We open a new context here to demonstrate logging in
  // explicitly via the LoginPage object.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('logs in with valid credentials', async ({ loginPage, page }) => {
    await loginPage.open();
    await loginPage.loginAs(env.STANDARD_USER_EMAIL, env.STANDARD_USER_PASSWORD);
    await expect(page.locator('#flash')).toContainText(/You logged into a secure area/i);
  });

  test('shows an error with invalid credentials', async ({ loginPage, page }) => {
    await loginPage.open();
    await loginPage.loginAs('definitely-not-a-user', 'wrong');
    await expect(page.locator('#flash')).toContainText(/Your username is invalid/i);
  });
});

test.describe('DB-backed seeding (sample)', () => {
  test.skip(!env.RUN_DB_TESTS, 'Set RUN_DB_TESTS=1 and provide DB_* vars to run.');

  test('seededUser fixture creates and cleans up a row', async ({ seededUser, db }) => {
    expect(seededUser.id).toBeGreaterThan(0);
    const found = await db.query('SELECT id FROM users WHERE id = $1', [seededUser.id]);
    expect(found.rowCount).toBe(1);
  });
});
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Run the e2e project against the public demo**

```bash
npx playwright test --project=e2e
```

Expected: 2 passed (login flow tests), 1 skipped (DB sample). The `setup` project runs first because of `dependencies: ['setup']`.

If the public demo is unreachable, the test will fail at the network level — that's an environment issue, not a framework defect. Note it and skip the run; the typecheck passing is sufficient verification.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/login.spec.ts
git commit -m "test(e2e): sample login flow + db-seeded sample (skipped by default)"
```

---

## Task 20: Sample API test

**Files:**
- Create: `tests/api/users.spec.ts`

- [ ] **Step 1: Implement `tests/api/users.spec.ts`**

```ts
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
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Run the api project**

```bash
npx playwright test --project=api
```

Expected: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add tests/api/users.spec.ts
git commit -m "test(api): sample users API tests against jsonplaceholder"
```

---

## Task 21: Verify the whole test suite end-to-end

- [ ] **Step 1: Run every project**

```bash
npm test
```

Expected:
- `unit` project: 8 tests pass (3 env + 3 faker + 2 auth).
- `setup` project: 2 setup steps pass (admin + standard).
- `e2e` project: 2 pass + 1 skipped.
- `api` project: 2 pass.

- [ ] **Step 2: Open the HTML report and confirm trace-viewer is wired**

```bash
npm run report
```

Expected: HTML report opens in browser. Click any test → "Trace" link is **disabled** (no failures, no retries → no trace was captured). To verify the trace path works, set `retries: 1` temporarily in `playwright.config.ts` and force-fail one test, then re-run + reopen the report; the "Trace" link should now open the embedded trace viewer. Revert the change after verifying.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: exits 0 (warnings allowed; no errors).

- [ ] **Step 4: Commit any incidental fixes**

If lint or typecheck surfaced anything, fix and commit:

```bash
git add -A
git commit -m "chore: post-integration cleanup"
```

(Skip this step if there's nothing to commit.)

---

## Task 22: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/playwright.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
name: Playwright Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        type: choice
        options: [dev, staging]
        default: dev

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    name: Run tests
    runs-on: ubuntu-latest
    timeout-minutes: 30

    env:
      TEST_ENV: ${{ inputs.environment || 'dev' }}
      CI: true
      BASE_URL:               ${{ secrets.BASE_URL }}
      API_BASE_URL:           ${{ secrets.API_BASE_URL }}
      DB_HOST:                ${{ secrets.DB_HOST }}
      DB_PORT:                ${{ secrets.DB_PORT }}
      DB_NAME:                ${{ secrets.DB_NAME }}
      DB_USER:                ${{ secrets.DB_USER }}
      DB_PASSWORD:            ${{ secrets.DB_PASSWORD }}
      ADMIN_USER_EMAIL:       ${{ secrets.ADMIN_USER_EMAIL }}
      ADMIN_USER_PASSWORD:    ${{ secrets.ADMIN_USER_PASSWORD }}
      STANDARD_USER_EMAIL:    ${{ secrets.STANDARD_USER_EMAIL }}
      STANDARD_USER_PASSWORD: ${{ secrets.STANDARD_USER_PASSWORD }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run tests
        run: npx playwright test
        # To enable sharding later:
        #   1. Add `strategy: { matrix: { shard: [1, 2, 3, 4] } }` at job level
        #   2. Change to: npx playwright test --shard=${{ matrix.shard }}/${{ strategy.job-total }}
        #   3. Suffix artifact names with -shard-${{ matrix.shard }}

      - name: Upload HTML report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14

      - name: Upload traces & test-results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: test-results/
          retention-days: 14
```

- [ ] **Step 2: Validate YAML locally (optional sanity check)**

```bash
node -e "require('js-yaml')" 2>/dev/null && \
  node -e "console.log(JSON.stringify(require('js-yaml').load(require('fs').readFileSync('.github/workflows/playwright.yml','utf8')), null, 2))" | head -20
```

If `js-yaml` isn't installed, skip this step — GitHub will validate on push.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/playwright.yml
git commit -m "ci: github actions workflow with retries, traces, and artifact upload"
```

---

## Task 23: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

````markdown
# Playwright Framework Template

Opinionated TypeScript test framework for E2E (browser) and REST API testing, with PostgreSQL precondition seeding, multi-environment config, and a GitHub Actions workflow.

## Quick Start

```bash
git clone <this-repo> my-tests && cd my-tests
npm install
npx playwright install --with-deps chromium
cp .env.example .env
npm test
```

The first run executes against public demo targets (`practice.expandtesting.com` for E2E, `jsonplaceholder.typicode.com` for API). The DB-backed sample test is skipped unless `RUN_DB_TESTS=1`.

## Layout

```
src/
├─ config/    # zod-validated env loader
├─ pages/     # page objects (extend BasePage)
├─ api/       # service wrappers (extend BaseClient)
├─ db/        # pg.Pool + typed query helpers
├─ fixtures/  # custom test merging pages, api, db, data
└─ utils/     # logger, faker, auth helpers
tests/
├─ unit/      # unit tests for framework code
├─ auth.setup.ts
├─ e2e/
└─ api/
```

## Environment Variables

All vars are validated by `src/config/env.ts`. See `.env.example` for the complete list.

| Var | Purpose |
|---|---|
| `TEST_ENV` | Selects which `.env.{env}` overlay loads (`local` \| `dev` \| `staging` \| `prod`) |
| `BASE_URL` | App under test |
| `API_BASE_URL` | API under test |
| `DB_*` | PostgreSQL connection |
| `ADMIN_USER_*`, `STANDARD_USER_*` | Test account credentials |
| `LOG_LEVEL` | pino level (`trace`..`error`) |
| `RUN_DB_TESTS` | `1` to include the DB-backed sample test |

## Multi-Environment

Create `.env.dev`, `.env.staging`, `.env.prod` (gitignored). Run with:

- bash: `TEST_ENV=staging npm test`
- PowerShell: `$env:TEST_ENV='staging'; npm test`
- shortcuts: `npm run test:dev` / `test:staging` / `test:prod`

## Adding to the Framework

| To add… | Create file… | Wire into… |
|---|---|---|
| Page | `src/pages/<name>.page.ts` extending `BasePage` | `src/fixtures/pages.fixture.ts` |
| API service | `src/api/<name>.api.ts` extending `BaseClient` | `src/fixtures/api.fixture.ts` |
| DB helpers | `src/db/<entity>.db.ts` | called from a data fixture |
| Seeded entity | new fixture in `src/fixtures/data.fixture.ts` | typed in `AllFixtures` |
| User role | new `setup(...)` in `tests/auth.setup.ts` | `storageStatePath('<role>')` in config |
| Environment | `.env.<name>` + add to `EnvSchema` enum | new `npm run test:<name>` script |

## CI

`.github/workflows/playwright.yml` runs on push/PR to `main` and via manual dispatch. Configure these GitHub secrets in your repo settings before the first run:

`BASE_URL`, `API_BASE_URL`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `ADMIN_USER_EMAIL`, `ADMIN_USER_PASSWORD`, `STANDARD_USER_EMAIL`, `STANDARD_USER_PASSWORD`.

Sharding is documented inline in the workflow but disabled by default — enable when the suite outgrows a single runner.

## Reports & Traces

- `npm run report` opens the local HTML report.
- On CI, the HTML report is uploaded on every run; raw `test-results/` (with traces) are uploaded only on failure.
- Traces are captured `on-first-retry` — view by clicking "Trace" on a failed test in the HTML report (embedded trace viewer).

## Adapting

See the spec at `docs/superpowers/specs/2026-05-04-playwright-framework-design.md` Section 7 for a full adaptation walkthrough, including which parts to delete if you don't need API tests or DB seeding.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with quick start, layout, env vars, and CI setup"
```

---

## Task 24: Final verification

- [ ] **Step 1: Fresh-clone simulation**

```bash
rm -rf node_modules
npm ci
npx playwright install --with-deps chromium
npm run typecheck
npm run lint
npm test
```

Expected: typecheck clean, lint clean (warnings OK), all unit + setup + e2e + api projects pass with the DB sample skipped.

- [ ] **Step 2: Confirm `.auth/` was created and is gitignored**

```bash
ls .auth/
git status .auth/
```

Expected: `admin.json` and `standard.json` exist; `git status` shows nothing in `.auth/` (gitignored).

- [ ] **Step 3: Tag the initial template release**

```bash
git tag -a v0.1.0 -m "Initial template release"
```

(Don't push — leave that decision to whoever forks the template.)

---

## Spec Coverage Self-Review

| Spec Section | Implemented in |
|---|---|
| 1. Architecture (TEST_ENV, fixtures, projects) | Tasks 5, 16, 18 |
| 2. Component breakdown (`src/`) | Tasks 5–16 (each subfolder) |
| 3. Multi-env loader with zod | Task 5 |
| 4. Auth via storage state + setup project | Tasks 8, 17, 18 |
| 4. Fixture-based POM, fixture-based API services | Tasks 13, 16 |
| 4. Per-test data lifecycle (seed + cleanup) | Tasks 14, 15 |
| 4. API auth via shared storage state | Task 18 (`storageState` on `e2e`); API project uses Playwright's request context with the same baseURL — additional auth wiring is left to the consuming project, since `jsonplaceholder` requires no auth |
| 5. Reporting, retries, traces | Task 18 |
| 6. GitHub Actions workflow (no sharding) | Task 22 |
| 7. Adaptation guide | Task 23 (README) |

**Note on Section 4 API auth:** The spec says API services should attach the same auth as the browser. The implementation in this plan stops short of that wiring because the sample API target doesn't require auth. The hook is in place (Task 12 `BaseClient` accepts an `APIRequestContext`); when adapting to a real backend, define the API project's `extraHTTPHeaders` or build a custom `request` fixture that reads from `storageStatePath('standard')`. README Step 2 calls this out.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-04-playwright-framework-plan.md`.**
