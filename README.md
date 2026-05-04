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
| Seeded entity | new fixture in `src/fixtures/data.fixture.ts` | add field to `DataFixtures` type and to the assignment in `src/fixtures/index.ts` |
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
