import { expect, test } from '@playwright/test';
import { goToPage, resetDb, selectPI } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetDb();
  await selectPI(page);
  await goToPage(page, 'Risks');
});

test('shows risk register heading with PI name', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Risk Register — PI 2026\.1/ })).toBeVisible();
});

test('shows unroamed count callout', async ({ page }) => {
  // r1 is unroamed; r2 is mitigated; r3 is owned
  await expect(page.getByText('1 unroamed').first()).toBeVisible();
});

test('shows all three risks', async ({ page }) => {
  const table = page.locator('table');
  await expect(
    table.getByText('Auth service external dependency may be unavailable during Iteration 1'),
  ).toBeVisible();
  await expect(table.getByText('SAML library upgrade introduces breaking changes')).toBeVisible();
  await expect(table.getByText('Grafana Cloud trial expires mid-PI')).toBeVisible();
});

test('shows correct ROAM badges', async ({ page }) => {
  const table = page.locator('table');
  await expect(table.getByText('unroamed', { exact: true })).toBeVisible();
  await expect(table.getByText('mitigated', { exact: true })).toBeVisible();
  await expect(table.getByText('owned', { exact: true })).toBeVisible();
});

test('shows owner names', async ({ page }) => {
  await expect(page.getByRole('cell', { name: 'Alice' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Bob' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Carol' })).toBeVisible();
});

test('shows column headers', async ({ page }) => {
  for (const col of ['Description', 'Team', 'Status', 'Owner']) {
    await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
  }
});
