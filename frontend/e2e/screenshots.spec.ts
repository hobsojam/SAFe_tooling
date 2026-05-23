// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTATION SCREENSHOTS — not behavioural tests.
//
// This file is intentionally excluded from the "e2e" Playwright project and
// runs only in the "screenshots" project (on merge to main).  See
// playwright.config.ts for the rationale and the project definitions.
//
// Rules for this file:
//   - No assertions (expect calls).  A screenshot is a best-effort capture,
//     not a correctness check.
//   - Add one test per page whenever a new page is added to the app.
//   - Keep the test names identical to their output filenames so it's obvious
//     which screenshot each test produces.
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { test } from '@playwright/test';
import { goToPage, resetDb, selectPI, waitForAppReady } from './helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.resolve(__dirname, '../../../docs/screenshots');

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  await resetDb();
  await selectPI(page);
});

test('board', async ({ page }) => {
  await waitForAppReady(page);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'board.png') });
});

test('backlog', async ({ page }) => {
  await goToPage(page, 'Backlog');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'backlog.png') });
});

test('capacity', async ({ page }) => {
  await goToPage(page, 'Capacity');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'capacity.png') });
});

test('risks', async ({ page }) => {
  await goToPage(page, 'Risks');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'risks.png') });
});

test('pi-health', async ({ page }) => {
  await goToPage(page, 'PI Health');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'pi-health.png') });
});

test('inspect-adapt', async ({ page }) => {
  await page.getByRole('link', { name: 'Inspect & Adapt' }).click();
  await page.waitForURL(/\/inspect-adapt/);
  await waitForAppReady(page);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'inspect-adapt.png') });
});

test('stories', async ({ page }) => {
  await page.getByRole('link', { name: 'Stories' }).click();
  await page.waitForURL(/\/stories/);
  await waitForAppReady(page);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'stories.png') });
});

test('roadmap', async ({ page }) => {
  await page.getByRole('link', { name: 'Roadmap' }).click();
  await page.waitForURL(/\/roadmap/);
  await waitForAppReady(page);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'roadmap.png') });
});
