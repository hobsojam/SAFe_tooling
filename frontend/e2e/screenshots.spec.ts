import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { test } from '@playwright/test';
import { goToPage, resetDb, selectPI } from './helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.resolve(__dirname, '../../docs/screenshots');

async function snap(page: Parameters<typeof goToPage>[0], filePath: string) {
  // networkidle ensures React Query fetches have all completed before capture
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: filePath, fullPage: false });
}

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  await resetDb();
  await selectPI(page);
});

test('board', async ({ page }) => {
  await snap(page, path.join(SCREENSHOTS_DIR, 'board.png'));
});

test('backlog', async ({ page }) => {
  await goToPage(page, 'Backlog');
  await snap(page, path.join(SCREENSHOTS_DIR, 'backlog.png'));
});

test('capacity', async ({ page }) => {
  await goToPage(page, 'Capacity');
  await snap(page, path.join(SCREENSHOTS_DIR, 'capacity.png'));
});

test('risks', async ({ page }) => {
  await goToPage(page, 'Risks');
  await snap(page, path.join(SCREENSHOTS_DIR, 'risks.png'));
});

test('pi-health', async ({ page }) => {
  await goToPage(page, 'PI Health');
  await snap(page, path.join(SCREENSHOTS_DIR, 'pi-health.png'));
});
