import { expect, test } from '@playwright/test';
import { goToPage, resetDb, selectPI } from './helpers';

// Fixture objectives for PI 2026.1 (committed only; stretch excluded from predictability):
//   Alpha: obj1 planned=10 actual=10, obj4 planned=7 actual=null  → plannedBV=17, actual=10 → 59%
//   Beta:  obj2 planned=10 actual=8,  obj7 planned=6 actual=null  → plannedBV=16, actual=8  → 50%
//   Gamma: obj5 planned=9  actual=null                            → plannedBV=9,  actual=0  → not yet scored
//   Delta: no committed objectives
// ART total: plannedBV=42, actualBV=18 → 43%

test.beforeEach(async ({ page }) => {
  await resetDb();
  await selectPI(page);
  await goToPage(page, 'Predictability');
});

test('shows ART Predictability heading with PI name', async ({ page }) => {
  await expect(
    page.getByRole('heading', { name: /ART Predictability — PI 2026\.1/ }),
  ).toBeVisible();
});

test('shows explanatory subtitle', async ({ page }) => {
  await expect(page.getByText(/Committed objectives only/).first()).toBeVisible();
});

test('shows correct column headers', async ({ page }) => {
  for (const col of ['Team', 'Objectives', 'Planned BV', 'Actual BV', 'Predictability']) {
    await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
  }
});

test('shows both ART team rows', async ({ page }) => {
  await expect(page.getByRole('cell', { name: 'Alpha', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Beta', exact: true })).toBeVisible();
});

test('Alpha team shows 59% predictability badge', async ({ page }) => {
  const alphaRow = page.getByRole('row', { name: /Alpha/ });
  await expect(alphaRow.getByText('59%')).toBeVisible();
});

test('Beta team shows 50% predictability badge', async ({ page }) => {
  const betaRow = page.getByRole('row', { name: /Beta/ });
  await expect(betaRow.getByText('50%')).toBeVisible();
});

test('ART Total row shows 43% predictability', async ({ page }) => {
  // Alpha: 10/17=59%, Beta: 8/16=50%, Gamma: 0/9=not scored → ART: 18/42=43%
  await expect(page.locator('tfoot').getByText('43%')).toBeVisible();
});

test('ART Total counts only committed objectives (stretch excluded)', async ({ page }) => {
  // 5 committed objectives (Alpha×2, Beta×2, Gamma×1); 2 stretch are excluded
  const footer = page.locator('tfoot');
  await expect(footer.getByRole('cell', { name: '5', exact: true })).toBeVisible();
});

test('Alpha planned BV is 17', async ({ page }) => {
  const alphaRow = page.getByRole('row', { name: /Alpha/ });
  await expect(alphaRow.getByRole('cell', { name: '17', exact: true }).first()).toBeVisible();
});

test('Predictability nav link appears in sidebar after selecting a PI', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'Predictability' })).toBeVisible();
});

test('shows footnote explaining the formula', async ({ page }) => {
  await expect(page.getByText(/Predictability = Actual BV ÷ Planned BV × 100/).first()).toBeVisible();
  await expect(page.getByText(/Stretch objectives are excluded/).first()).toBeVisible();
});
