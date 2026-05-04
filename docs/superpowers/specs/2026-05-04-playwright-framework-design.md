# Playwright E2E + API Test Framework — Design Spec

**Date:** 2026-05-04
**Status:** Approved (ready for implementation planning)
**Goal:** A reusable, opinionated TypeScript Playwright template for E2E and REST API testing with PostgreSQL precondition seeding, multi-environment support, and CI integration. Built to be forked and adapted to any project.

---

## 1. Architecture Overview

A TypeScript Playwright template that runs both **E2E** (browser) and **API** (HTTP) tests against any of N environments selected by a single `TEST_ENV` variable. Framework code lives in `src/`, specs live in `tests/`. Tests get everything they need — a logged-in `page`, typed page objects, API service clients, a PG client, and isolated test data — through **Playwright fixtures**. No manual wiring inside test bodies.

```
┌──────────────────────────────────────────────────────┐
│  TEST_ENV=staging npx playwright test                │
└──────────┬───────────────────────────────────────────┘
           ▼
   ┌──────────────┐    loads     ┌────────────────┐
   │ env loader   │ ───────────▶ │ .env + .env.{e}│
   └──────┬───────┘               └────────────────┘
          ▼
   ┌──────────────────────────────────────────────────┐
   │ playwright.config.ts                             │
   │  • projects: setup → e2e (chromium) → api        │
   │  • retries: 2 in CI, 0 local                     │
   │  • reporter: html + traces on first retry        │
   └──────┬───────────────────────────────────────────┘
          ▼
   ┌──────────────────────────────────────────────────┐
   │ Custom test = base test + fixtures               │
   │  • page objects, API services, db client, data   │
   └──────┬───────────────────────────────────────────┘
          ▼
       tests/e2e/*.spec.ts   tests/api/*.spec.ts
```

**Key invariants:**
- A test never instantiates a page object, opens a DB connection, or reads `process.env` directly — it pulls everything from fixtures.
- Sensitive values (DB password, login creds, API keys) come from `.env*` files and are never committed.
- A failed test in CI auto-retries; on the retry, full trace + screenshot + video are captured and bundled into the HTML report.

---

## 2. Component Breakdown (`src/`)

```
src/
├─ config/
│  ├─ env.ts          # loads .env + .env.{TEST_ENV}, validates with zod, exports typed `env`
│  └─ types.ts        # AppEnv, UserRole, etc.
├─ pages/
│  ├─ base.page.ts    # BasePage: common nav/wait helpers
│  ├─ login.page.ts   # LoginPage extends BasePage
│  └─ ...             # one file per page
├─ components/
│  ├─ header.component.ts
│  └─ modal.component.ts   # composed inside page objects when reused
├─ api/
│  ├─ base.client.ts  # wraps Playwright APIRequestContext, attaches base URL + auth header
│  ├─ users.api.ts    # UsersApi: createUser(), getUser(id), deleteUser(id)
│  └─ orders.api.ts   # OrdersApi: ...
├─ db/
│  ├─ client.ts       # singleton `pg.Pool`, built from env, graceful shutdown hook
│  ├─ users.db.ts     # typed query helpers: insertUser, deleteUserById, findByEmail
│  └─ orders.db.ts    # ...
├─ fixtures/
│  ├─ index.ts        # `export const test = base.extend<Fixtures>({...})`
│  ├─ pages.fixture.ts    # provides loginPage, dashboardPage, ...
│  ├─ api.fixture.ts      # provides usersApi, ordersApi, ... (uses authed `request`)
│  ├─ db.fixture.ts       # provides `db` (pg.Pool) + per-test cleanup tracker
│  └─ data.fixture.ts     # provides `seededUser`, `seededOrder` — auto cleanup on teardown
└─ utils/
   ├─ logger.ts       # pino, log level from env
   ├─ faker.ts        # wrapper exposing project-specific generators (uniqueEmail, etc.)
   └─ auth.ts         # storage state path resolver per role
```

**Conventions:**
- File naming: `<name>.<kind>.ts` (`login.page.ts`, `users.api.ts`, `users.db.ts`) — grep-friendly, predictable.
- Each `*.db.ts` and `*.api.ts` file owns one domain entity. Tests never write SQL or raw `request()` calls inline.
- All fixtures merge into one `test` export from `src/fixtures/index.ts` — specs only import from there.

---

## 3. Configuration & Multi-Environment

### Files at repo root

```
.env              # shared, non-secret defaults
.env.example      # committed template — every var documented, no real values
.env.local        # gitignored — developer-specific overrides
.env.dev          # gitignored — dev environment secrets
.env.staging      # gitignored — staging secrets
.env.prod         # gitignored — prod secrets (often read-only / smoke-only)
```

`.gitignore` ignores `.env`, `.env.*`, allows `.env.example`.

### Loader (`src/config/env.ts`)

1. Resolve `TEST_ENV` (defaults to `local`).
2. `dotenv.config({ path: '.env' })` — base defaults.
3. `dotenv.config({ path: '.env.${TEST_ENV}', override: true })` — env-specific overrides win.
4. Parse with **zod** schema → throw a clear error on startup if any required var is missing/malformed.
5. Export a frozen, typed `env` object — the only place in the codebase that reads `process.env`.

### Schema (illustrative)

```ts
const EnvSchema = z.object({
  TEST_ENV: z.enum(['local', 'dev', 'staging', 'prod']),
  BASE_URL: z.string().url(),
  API_BASE_URL: z.string().url(),
  DB_HOST: z.string(),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  ADMIN_USER_EMAIL: z.string().email(),
  ADMIN_USER_PASSWORD: z.string().min(1),
  STANDARD_USER_EMAIL: z.string().email(),
  STANDARD_USER_PASSWORD: z.string().min(1),
  LOG_LEVEL: z.enum(['trace','debug','info','warn','error']).default('info'),
  CI: z.coerce.boolean().default(false),
});
export const env = EnvSchema.parse(process.env);
```

### Usage

`import { env } from '@/config/env'` — `playwright.config.ts`, fixtures, db client, api client all read from this single source. Tests never touch `process.env`.

### Switching environments

- bash: `TEST_ENV=staging npx playwright test`
- PowerShell: `$env:TEST_ENV='staging'; npx playwright test`
- npm scripts (`test:dev`, `test:staging`, `test:prod`) wrap this for convenience.

---

## 4. Fixtures, Auth Flow & Data Lifecycle

### Auth via storage state + setup project

`playwright.config.ts` defines a dependency chain:

```
projects:
  - name: setup        → matches **/auth.setup.ts
  - name: e2e          → use chromium, depends on [setup]
  - name: api          → no browser, depends on [setup]
```

`tests/auth.setup.ts` runs once per role and writes `.auth/<role>.json`:

```ts
setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(env.ADMIN_USER_EMAIL);
  await page.getByLabel('Password').fill(env.ADMIN_USER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
  await page.context().storageState({ path: '.auth/admin.json' });
});
// + similar for 'standard' and any other roles
```

`.auth/` is gitignored. The `e2e` project loads `storageState: '.auth/standard.json'` by default; tests that need a different role override it via fixture.

### The custom `test` (`src/fixtures/index.ts`)

```ts
type Fixtures = {
  // pages
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  // api services (already authenticated)
  usersApi: UsersApi;
  ordersApi: OrdersApi;
  // db
  db: Pool;
  // data — auto-cleanup
  seededUser: SeededUser;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  dashboardPage: async ({ page }, use) => use(new DashboardPage(page)),

  usersApi: async ({ request }, use) => use(new UsersApi(request)),
  ordersApi: async ({ request }, use) => use(new OrdersApi(request)),

  db: [async ({}, use) => {
    await use(getPool());            // singleton, one Pool per worker
  }, { scope: 'worker' }],

  seededUser: async ({ db }, use) => {
    const user = await usersDb.insertUser(db, { email: faker.uniqueEmail() });
    await use(user);
    await usersDb.deleteUserById(db, user.id);   // teardown — runs even on failure
  },
});

export { expect } from '@playwright/test';
```

### Per-test data lifecycle invariants

- Every fixture that creates data also tears it down in the same fixture's teardown half. No "cleanup file" to forget.
- Fixtures are composable — `seededOrder` depends on `seededUser`; ordering is automatic.
- `db` Pool is **worker-scoped** (one per parallel worker, not per test) → no connection storm.
- Faker is wrapped in `src/utils/faker.ts` to centralize project-specific generators (e.g., `uniqueEmail()` adds a worker-id prefix to avoid cross-worker collisions).

### API auth

`BaseClient` reads the same `.auth/<role>.json`, extracts the cookie/token, and attaches it to every `request` call → API services are authenticated identically to the browser.

---

## 5. Reporting, Retries & Traces

### `playwright.config.ts` — relevant settings

```ts
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!env.CI,                      // fail CI if .only left in code
  retries: env.CI ? 2 : 0,                   // 2 retries in CI, none locally
  workers: env.CI ? 2 : undefined,           // tune per CI runner
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],                                // human-readable console output
  ],
  use: {
    baseURL: env.BASE_URL,
    trace: 'on-first-retry',                 // trace captured automatically when a test retries
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'e2e',
      testDir: './tests/e2e',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/standard.json' },
      dependencies: ['setup'],
    },
    {
      name: 'api',
      testDir: './tests/api',
      use: { baseURL: env.API_BASE_URL },
      dependencies: ['setup'],
    },
  ],
});
```

### Failure → diagnosis flow

1. Test fails in CI → Playwright auto-retries (up to 2x).
2. On the **first retry**, `trace: 'on-first-retry'` records a full trace (DOM snapshots, network, console, source). Screenshot taken on every failure; video kept for any test that ultimately failed.
3. All artifacts land in `test-results/<test-id>/` and are linked from the HTML report.
4. The HTML report opens **trace.zip directly in the embedded trace viewer** when you click "Trace" on a failed test — no separate `npx playwright show-trace` step needed for the reader.
5. CI uploads `playwright-report/` and `test-results/` as workflow artifacts.

### Why `on-first-retry` (not `retain-on-failure`)

- Tracing has overhead (~10-20% on slow runners). Capturing only on retry keeps the happy path fast.
- If a test passes on retry, you still get the trace from the failing attempt → flaky tests are debuggable, not just suppressed.

### Local runs

- `retries: 0` — fail fast while developing.
- `npx playwright test --trace on` available for debugging a single spec.
- `npx playwright show-report` opens the same HTML report locally.

---

## 6. GitHub Actions Workflow

Single test job. Sharding intentionally omitted; instructions for enabling it later are inline.

**File:** `.github/workflows/playwright.yml`

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
      # Secrets injected from GitHub repo/environment secrets — never committed
      BASE_URL:           ${{ secrets.BASE_URL }}
      API_BASE_URL:       ${{ secrets.API_BASE_URL }}
      DB_HOST:            ${{ secrets.DB_HOST }}
      DB_PORT:            ${{ secrets.DB_PORT }}
      DB_NAME:            ${{ secrets.DB_NAME }}
      DB_USER:            ${{ secrets.DB_USER }}
      DB_PASSWORD:        ${{ secrets.DB_PASSWORD }}
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

**Key choices:**
- **`concurrency` group**: a new push to a PR cancels the previous run — saves CI minutes.
- **Secrets**: every sensitive `.env` value is mirrored as a GitHub secret. The README documents which secrets must be configured. Non-secret values (`BASE_URL` in dev, etc.) can move to GitHub `vars` if preferred.
- **Artifacts on `if: always()`**: HTML report uploaded for both pass and fail so reviewers can browse it; raw `test-results/` only on failure to save storage.
- **`workflow_dispatch` input**: lets a human trigger the suite against `dev` or `staging` from the Actions tab without code changes.

**Not included (and why):**
- No PR comment bot — keeps the template dependency-free; teams add `daun/playwright-report-summary` later if wanted.
- No sharding — single job suffices for an empty starter; clear enable-path documented inline.

---

## 7. Adapting the Template to a New Project

The template is built to be **forked, renamed, and trimmed** rather than installed as a package. Everything a consuming team needs to change lives in a small, predictable set of places.

### Step 1 — Bootstrap (5 min)

1. Clone the repo, rename the folder, run `npm install`.
2. Copy `.env.example` → `.env.local` and fill in real values for your local target.
3. `npx playwright install` (one-time browser download).
4. `npm test` — sample tests (login, one API service, one DB-seeded test) should pass green out of the box against a public demo app (e.g., `https://practice.expandtesting.com`) so the template is verifiably runnable before any customization.

### Step 2 — Point at your app (15 min)

- Update `BASE_URL`, `API_BASE_URL`, DB credentials in your `.env.*` files.
- Replace the sample login selectors in `tests/auth.setup.ts` and `src/pages/login.page.ts` with your app's.
- Add/remove user roles by extending `tests/auth.setup.ts` and the `storageState` declarations in `playwright.config.ts`.
- Update the `EnvSchema` in `src/config/env.ts` with any new required env vars — zod will fail loudly if missing.

### Step 3 — Add your domain (ongoing)

| To add… | Create file… | Wire into… |
|---|---|---|
| A new page | `src/pages/<name>.page.ts` (extend `BasePage`) | `src/fixtures/pages.fixture.ts` |
| A new API service | `src/api/<name>.api.ts` (extend `BaseClient`) | `src/fixtures/api.fixture.ts` |
| New DB seed/cleanup helpers | `src/db/<entity>.db.ts` | called from a data fixture |
| A reusable seeded entity | `src/fixtures/data.fixture.ts` (new fixture w/ teardown) | typed in the `Fixtures` interface |
| A new environment | `.env.<name>` + add to `EnvSchema` enum | `npm run test:<name>` script |

### Step 4 — CI (5 min)

- Push to GitHub, configure the secrets listed in `README.md`.
- Optionally adjust the `workflow_dispatch` `environment` choices for your envs.

### Removable parts (YAGNI for some teams)

- **Don't need API tests?** Delete `tests/api/`, `src/api/`, the api fixture, and the `api` project from `playwright.config.ts`.
- **Don't need DB seeding?** Delete `src/db/`, the `db` and `data` fixtures, drop `pg` from `package.json`.
- **Single environment only?** Delete the extra `.env.*` files and remove `TEST_ENV` from the zod schema.

### What's documented in `README.md`

- Quick start (Steps 1–2 above)
- Required environment variables (mirrors `.env.example` with notes)
- Required GitHub secrets (mirrors workflow `env:` block)
- How to add a page/API service/fixture (Step 3 table)
- How to enable sharding in CI (already inline-commented in the workflow)
- How to view traces locally (`npx playwright show-report`) and from CI artifacts

---

## Decisions Reference

| Decision | Choice | Rationale |
|---|---|---|
| Language | TypeScript | Type-safe page objects/fixtures, industry default |
| Database | PostgreSQL via raw `pg` driver + parameterized SQL | No ORM coupling, easy to debug |
| Environments | `TEST_ENV` switches between `.env.{env}` files | Single var controls target; clean for templates |
| Auth | Storage state via `setup` project, one file per role | Fastest, standard Playwright pattern |
| API testing | Playwright `request` + typed service wrappers per entity | Reuse + clean assertions, no extra HTTP lib |
| Reporters | HTML only (with traces on first retry) | Lean default; teams add Allure later if needed |
| CI | GitHub Actions, single job (sharding documented inline) | Most common, free, ready to enable matrix later |
| POM style | Fixture-based POM | Auto-instantiated, type-safe, zero boilerplate in tests |
| Test data | Per-test seed + cleanup via fixtures, faker for uniqueness | Parallel-safe isolation |
| Layout | Layered: `src/` (framework) + `tests/` (specs) | Clear separation; consumers know where to add things |
