import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, devices } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDb = path.resolve(__dirname, '..', 'tests', 'e2e_fixture.db.json');

const TEST_API_PORT = 8001;
const TEST_UI_PORT = 5180;

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/screenshots.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${TEST_UI_PORT}`,
    actionTimeout: 10_000,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
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
