import { expect, test } from '@playwright/test';
import { goToPage, resetDb, selectPI } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetDb();
  await selectPI(page);
  await goToPage(page, 'Dependencies');
});

test('shows dependencies heading with PI name', async ({ page }) => {
  await expect(
    page.getByRole('heading', { name: /Dependencies — PI 2026\.1/ }),
  ).toBeVisible();
});

test('shows unresolved count callout', async ({ page }) => {
  // d1 is resolved; d2 is identified; d3 is in_progress → 2 unresolved
  await expect(page.getByText('2 unresolved').first()).toBeVisible();
});

test('shows all three dependencies', async ({ page }) => {
  const table = page.locator('table');
  await expect(
    table.getByText('Auth API contract must be finalised before SSO integration begins'),
  ).toBeVisible();
  await expect(
    table.getByText('Observability metrics endpoint needed by CI/CD pipeline health checks'),
  ).toBeVisible();
  await expect(
    table.getByText('Auth service token validation endpoint needed by Observability team'),
  ).toBeVisible();
});

test('shows correct status badges', async ({ page }) => {
  const table = page.locator('table');
  await expect(table.getByText('resolved', { exact: true })).toBeVisible();
  await expect(table.getByText('identified', { exact: true })).toBeVisible();
  await expect(table.getByText('in progress', { exact: true })).toBeVisible();
});

test('shows owner names', async ({ page }) => {
  // d1 owner Alice, d2 owner Carol, d3 owner Bob
  const aliceCount = await page.getByRole('cell', { name: 'Alice' }).count();
  const bobCount = await page.getByRole('cell', { name: 'Bob' }).count();
  const carolCount = await page.getByRole('cell', { name: 'Carol' }).count();
  expect(aliceCount + bobCount + carolCount).toBe(3);
});

test('shows column headers', async ({ page }) => {
  for (const col of ['From', 'To', 'Description', 'Status', 'Owner', 'Needed By']) {
    await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
  }
});
