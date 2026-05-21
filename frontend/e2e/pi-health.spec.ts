import { expect, test } from '@playwright/test';
import { goToPage, resetDb, selectPI } from './helpers';

// Fixture data for PI 2026.1:
//   Objectives: 5 committed (Alpha×2, Beta×2, Gamma×1), 2 stretch (Alpha×1, Delta×1)
//   Predictability: 43% — committed planned=42, actual=18 (obj1:10, obj2:8 scored)
//   Risks: 3 total — r1 unroamed, r2 mitigated, r3 owned → 2 unresolved
//   Dependencies: 3 total — d1 resolved, d2 identified, d3 in_progress → 2 open
//   No capacity plans in fixture → capacity cells show "—"

test.beforeEach(async ({ page }) => {
  await resetDb();
  await selectPI(page);
  await goToPage(page, 'PI Health');
});

test('shows PI Health heading with PI name', async ({ page }) => {
  await expect(
    page.getByRole('heading', { name: /PI Health — PI 2026\.1/ }),
  ).toBeVisible();
});

test('PI Health link appears in sidebar after selecting a PI', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'PI Health', exact: true })).toBeVisible();
});

test('objectives card shows 5 committed and 2 stretch', async ({ page }) => {
  const card = page.locator('main').locator('a[href$="/objectives"]');
  await expect(card.getByText('5')).toBeVisible();
  await expect(card.getByText('committed')).toBeVisible();
  await expect(card.getByText('+2 stretch')).toBeVisible();
});

test('risks card shows 2 unresolved of 3 total', async ({ page }) => {
  const card = page.locator('main').locator('a[href$="/risks"]');
  await expect(card.getByText('2')).toBeVisible();
  await expect(card.getByText('of 3 total')).toBeVisible();
});

test('dependencies card shows 2 open of 3 total', async ({ page }) => {
  const card = page.locator('main').locator('a[href$="/dependencies"]');
  await expect(card.getByText('2')).toBeVisible();
  await expect(card.getByText('of 3 total')).toBeVisible();
});

test('predictability card shows 43% ART predictability', async ({ page }) => {
  const card = page.locator('main').locator('a[href$="/predictability"]');
  await expect(card.getByText('43%')).toBeVisible();
  await expect(card.getByText('ART · target 80–100%')).toBeVisible();
});

test('capacity table shows all 4 ART teams', async ({ page }) => {
  for (const team of ['Alpha', 'Beta', 'Gamma', 'Delta']) {
    await expect(page.getByRole('cell', { name: team, exact: true })).toBeVisible();
  }
});

test('capacity table shows correct column headers', async ({ page }) => {
  for (const col of ['Team', 'Available (days)', 'Committed (pts)', 'Load %']) {
    await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
  }
});
