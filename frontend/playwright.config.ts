import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, devices } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDb = path.resolve(__dirname, '..', 'tests', 'e2e_fixture.db.json');

// Dedicated ports so tests never clash with the user's running dev servers.
const TEST_API_PORT = 8001;
const TEST_UI_PORT = 5180;

// ─────────────────────────────────────────────────────────────────────────────
// TWO SEPARATE PLAYWRIGHT PROJECTS — keep them separate, always.
//
//   "e2e"         → behavioural tests (frontend/e2e/**/*.spec.ts, NOT screenshots)
//                   Run in CI on every PR:  npx playwright test --project=e2e
//
//   "screenshots" → documentation screenshots only (frontend/e2e/screenshots.spec.ts)
//                   Run in CI on merge to main only:
//                   npx playwright test --project=screenshots
//
// WHY SEPARATE:
//   - E2e tests have assertions and must fail loudly when behaviour breaks.
//   - Screenshot captures have no assertions; they must not pollute test results
//     or block PRs, and they need to be resilient (a slow render ≠ a test failure).
//   - Keeping them in one named-project config is simpler and safer than a second
//     config file that extends this one via mergeConfig — mergeConfig concatenates
//     arrays rather than replacing them, so testIgnore overrides are unreliable.
//
// DO NOT collapse these two projects back into one, or use mergeConfig again.
// ─────────────────────────────────────────────────────────────────────────────

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${TEST_UI_PORT}`,
    actionTimeout: 10_000,
    trace: 'on-first-retry',
  },
  projects: [
    {
      // Behavioural e2e tests — every spec EXCEPT screenshots.spec.ts.
      // These run on every PR and must never include screenshot captures.
      name: 'e2e',
      testIgnore: ['**/screenshots.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Documentation screenshot captures — screenshots.spec.ts only.
      // No assertions; runs on merge to main to refresh docs/screenshots/.
      // Add a new test here whenever a new page is added to the app.
      name: 'screenshots',
      testMatch: ['**/screenshots.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
      retries: 0, // a bad screenshot is silent; don't waste time retrying
    },
  ],
  webServer: [
    {
      command: `python -m uvicorn safe.api.main:app --host 127.0.0.1 --port ${TEST_API_PORT}`,
      port: TEST_API_PORT,
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env as Record<string, string>,
        SAFE_DB_PATH: fixtureDb,
        SAFE_DEV_ROUTES: '1',
      },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `npm run dev -- --port ${TEST_UI_PORT}`,
      port: TEST_UI_PORT,
      env: {
        ...process.env as Record<string, string>,
        API_PORT: String(TEST_API_PORT),
      },
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
