import { expect, test } from '@playwright/test';
import { goToPage, resetDb, selectPI, waitForAppReady } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetDb();
  await selectPI(page);
  await goToPage(page, 'Inspect & Adapt');
});

// ── heading ──────────────────────────────────────────────────────────────────

test('shows page heading with PI name', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Inspect & Adapt — PI 2026\.1/ })).toBeVisible();
});

// ── ART Predictability section ───────────────────────────────────────────────

test('predictability section shows all four stat cards', async ({ page }) => {
  // Scope to the section to avoid matching the identical Planned BV / Actual BV column headers
  const section = page.getByRole('region', { name: 'ART Predictability' });
  await expect(section.getByText('Planned BV')).toBeVisible();
  await expect(section.getByText('Actual BV')).toBeVisible();
  await expect(section.getByText('Objectives Scored')).toBeVisible();
  await expect(section.getByText('Predictability', { exact: true })).toBeVisible();
});

test('predictability stat values match fixture data', async ({ page }) => {
  // Committed objectives: planned BV 10+10+7+9+6 = 42
  // Scored: 2 (Auth Service v2 actual=10, Observability actual=8), actualBV = 18
  // pct = round(18/42 * 100) = 43
  await expect(page.getByText('42')).toBeVisible();
  await expect(page.getByText('18')).toBeVisible();
  await expect(page.getByText('2 / 5')).toBeVisible();
  await expect(page.getByText('43%')).toBeVisible();
});

test('stretch objective count note is shown', async ({ page }) => {
  await expect(page.getByText(/stretch.*excluded from predictability/i)).toBeVisible();
});

// ── PI Objectives table ───────────────────────────────────────────────────────

test('shows committed objective rows in table', async ({ page }) => {
  await expect(page.getByRole('cell', { name: 'Deliver Auth Service v2' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Observability Dashboard rollout' })).toBeVisible();
});

test('committed objectives have Committed badge', async ({ page }) => {
  const row = page.getByRole('row', { name: /Deliver Auth Service v2/ });
  await expect(row.getByText('Committed')).toBeVisible();
});

test('stretch objectives have Stretch badge', async ({ page }) => {
  const row = page.getByRole('row', { name: /Exploratory SSO stretch goal/ });
  // Use first() because "stretch" in the description cell also matches as a substring
  await expect(row.getByText('Stretch').first()).toBeVisible();
});

test('table shows Planned BV and Actual BV columns', async ({ page }) => {
  await expect(page.getByRole('columnheader', { name: 'Planned BV' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Actual BV' })).toBeVisible();
});

// ── Risk ROAM section ─────────────────────────────────────────────────────────

test('ROAM section shows a card for each status', async ({ page }) => {
  for (const status of ['resolved', 'owned', 'accepted', 'mitigated', 'unroamed']) {
    await expect(page.getByText(status, { exact: true })).toBeVisible();
  }
});

test('ROAM footer shows total risk count and unroamed count', async ({ page }) => {
  // Fixture has 3 risks: 1 unroamed, 1 owned, 1 mitigated
  await expect(page.getByText(/3 total risks/)).toBeVisible();
  await expect(page.getByText(/1 unroamed/)).toBeVisible();
});

// ── empty states (PI 2026.2 has no objectives or risks) ──────────────────────

test('shows empty state when PI has no committed objectives', async ({ page }) => {
  await resetDb();
  await page.getByRole('combobox').selectOption({ label: 'PI 2026.2' });
  await page.waitForURL(/\/pi\/.+\/board/);
  await waitForAppReady(page);
  await goToPage(page, 'Inspect & Adapt');
  await expect(page.getByText(/No committed objectives/)).toBeVisible();
});

test('shows empty state when PI has no objectives at all', async ({ page }) => {
  await resetDb();
  await page.getByRole('combobox').selectOption({ label: 'PI 2026.2' });
  await page.waitForURL(/\/pi\/.+\/board/);
  await waitForAppReady(page);
  await goToPage(page, 'Inspect & Adapt');
  await expect(page.getByText(/No objectives for this PI/)).toBeVisible();
});

test('shows empty state when PI has no risks', async ({ page }) => {
  await resetDb();
  await page.getByRole('combobox').selectOption({ label: 'PI 2026.2' });
  await page.waitForURL(/\/pi\/.+\/board/);
  await waitForAppReady(page);
  await goToPage(page, 'Inspect & Adapt');
  await expect(page.getByText(/No risks recorded for this PI/)).toBeVisible();
});

// ── Problem-Solving Workshop section ─────────────────────────────────────────

test('shows Problem-Solving Workshop section with + New Action button', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Problem-Solving Workshop' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ New Action' })).toBeVisible();
});

test('+ New Action button opens modal', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Action' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'New Improvement Action' })).toBeVisible();
});

test('action modal closes on Cancel', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Action' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('can create an improvement action', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Action' }).click();
  await page.getByLabel('Problem Statement').fill('Slow deploys');
  await page.getByLabel('Root Cause').fill('Manual steps in CI');
  await page.getByRole('textbox', { name: 'Action' }).fill('Automate deployment pipeline');
  await page.getByLabel('Owner').fill('Alice');
  await page.getByRole('button', { name: 'Add Action' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('table').getByText('Slow deploys').last()).toBeVisible();
  await expect(page.locator('table').getByText('Automate deployment pipeline')).toBeVisible();
  await expect(page.locator('table').getByText('Alice')).toBeVisible();
  await expect(page.locator('table').getByText('Open')).toBeVisible();
});

test('can edit an improvement action', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Action' }).click();
  await page.getByLabel('Problem Statement').fill('Original problem');
  await page.getByRole('textbox', { name: 'Action' }).fill('Original action');
  await page.getByRole('button', { name: 'Add Action' }).click();

  await page.locator('table').getByRole('button', { name: 'Original problem' }).click();
  await page.getByLabel('Problem Statement').fill('Updated problem');
  await page.getByLabel('Status').selectOption('in_progress');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page.locator('table').getByText('Updated problem')).toBeVisible();
  await expect(page.locator('table').getByText('In Progress')).toBeVisible();
  await expect(page.locator('table').getByText('Original problem')).not.toBeVisible();
});

test('can delete an improvement action', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Action' }).click();
  await page.getByLabel('Problem Statement').fill('To be deleted');
  await page.getByRole('textbox', { name: 'Action' }).fill('Some action');
  await page.getByRole('button', { name: 'Add Action' }).click();

  const row = page.getByRole('row', { name: /To be deleted/ });
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, delete' }).click();
  await expect(page.locator('table').getByText('To be deleted')).not.toBeVisible();
});
