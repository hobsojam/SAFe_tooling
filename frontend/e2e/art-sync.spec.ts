import { expect, test } from '@playwright/test';
import { goToPage, resetDb, selectPI, waitForAppReady } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetDb();
  await selectPI(page);
  await goToPage(page, 'ART Sync');
});

// ── heading ────────────────────────────────────────────────────────────────────

test('shows page heading with PI name', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /ART Sync — PI 2026\.1/ })).toBeVisible();
});

// ── grid structure ─────────────────────────────────────────────────────────────

test('renders a column for each non-IP iteration', async ({ page }) => {
  for (const n of [1, 2, 3, 4]) {
    await expect(page.getByRole('columnheader', { name: `Iteration ${n}` })).toBeVisible();
  }
});

test('does not render a column for the IP iteration', async ({ page }) => {
  await expect(page.getByRole('columnheader', { name: 'Iteration 5' })).not.toBeVisible();
});

test('renders a row for each team', async ({ page }) => {
  for (const team of ['Alpha', 'Beta', 'Delta', 'Gamma']) {
    await expect(page.getByRole('cell', { name: team, exact: true })).toBeVisible();
  }
});

// ── cell values ────────────────────────────────────────────────────────────────

test('cells with committed stories show done / committed fraction', async ({ page }) => {
  // All fixture stories are not_started, so done=0 for every cell
  // Fixture: Alpha has stories in iter 1, 2, 3 — each shows "0 / N"
  await expect(page.getByText('0 / 2').first()).toBeVisible();
});

test('cells with no stories show a dash', async ({ page }) => {
  // Alpha has no stories in iteration 4
  await expect(page.getByText('—').first()).toBeVisible();
});

// ── legend ─────────────────────────────────────────────────────────────────────

test('shows legend with all three status labels', async ({ page }) => {
  await expect(page.getByText('All done')).toBeVisible();
  await expect(page.getByText('In progress')).toBeVisible();
  await expect(page.getByText('Not started')).toBeVisible();
});

// ── empty state (PI 2026.2 has no stories) ─────────────────────────────────────

test('still renders grid for PI with no stories (all cells show dash)', async ({ page }) => {
  await resetDb();
  await page.getByRole('combobox').selectOption({ label: 'PI 2026.2' });
  await page.waitForURL(/\/pi\/.+\/board/);
  await waitForAppReady(page);
  await goToPage(page, 'ART Sync');
  // Grid should appear but all cells are empty
  await expect(page.getByRole('columnheader', { name: 'Iteration 1' })).toBeVisible();
  await expect(page.getByText('—').first()).toBeVisible();
});
