import { expect, test } from '@playwright/test';
import { goToPage, resetDb, selectPI } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetDb();
  await selectPI(page);
  await goToPage(page, 'Backlog');
});

test('shows backlog heading with PI name', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Program Backlog — PI 2026\.1/ })).toBeVisible();
});

test('shows fixture features', async ({ page }) => {
  const table = page.locator('table');
  await expect(table.getByText('Auth Service')).toBeVisible();
  await expect(table.getByText('SSO Integration')).toBeVisible();
  await expect(table.getByText('Observability Dashboard')).toBeVisible();
  await expect(table.getByText('CI/CD Pipeline Upgrade')).toBeVisible();
});

test('top-ranked feature has highest WSJF score', async ({ page }) => {
  // API Gateway: WSJF = 20/3 = 6.67 — highest
  const rows = page.locator('tbody tr');
  const firstRow = rows.first();
  await expect(firstRow.getByText('API Gateway')).toBeVisible();
  await expect(firstRow.getByText('6.67')).toBeVisible();
});

test('shows column headers for WSJF table', async ({ page }) => {
  for (const col of ['Feature', 'Status', 'Team', 'CoD', 'Size', 'WSJF']) {
    await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
  }
});

test('shows team assignments', async ({ page }) => {
  // Teams are fetched in a separate query from features; wait for names to resolve
  await expect(page.getByRole('cell', { name: /Alpha|Beta|Gamma|Delta/ }).first()).toBeVisible();
  const teamCellCount = await page.getByRole('cell', { name: /Alpha|Beta|Gamma|Delta/ }).count();
  // 5 features visible per page; 9 of 10 fixture features have a team assigned
  expect(teamCellCount).toBeGreaterThanOrEqual(4);
});
