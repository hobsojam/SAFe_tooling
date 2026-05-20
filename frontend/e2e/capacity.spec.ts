import { expect, test } from '@playwright/test';
import { goToPage, resetDb, selectPI } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetDb();
  await selectPI(page);
  await goToPage(page, 'Capacity');
});

test('shows Capacity heading', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Capacity/ })).toBeVisible();
});

test('shows iteration rows', async ({ page }) => {
  await expect(page.getByText('Iteration 1').first()).toBeVisible();
  await expect(page.getByText('Iteration 2').first()).toBeVisible();
});

test('shows team columns', async ({ page }) => {
  await expect(page.getByRole('columnheader', { name: 'Alpha' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Beta' })).toBeVisible();
});

test('capacity cells show configured capacity', async ({ page }) => {
  const notSetButtons = page.getByRole('button', { name: /days/ });
  await expect(notSetButtons.first()).toBeVisible();
});

test('clicking a cell opens the capacity modal', async ({ page }) => {
  await page.getByRole('button', { name: /days/ }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Capacity:/ })).toBeVisible();
});

test('modal closes on Cancel', async ({ page }) => {
  await page.getByRole('button', { name: /days/ }).first().click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('can set capacity for a cell', async ({ page }) => {
  await page.getByRole('button', { name: /days/ }).first().click();
  await page.getByLabel('Team Size').fill('6');
  await page.getByLabel('Iteration Days').fill('10');
  await page.getByLabel('PTO Days').fill('0');
  await page.getByLabel('Overhead %').fill('20');
  await page.getByRole('button', { name: 'Set Capacity' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  // 6 * 10 * 0.8 = 48
  await expect(page.getByText('48').first()).toBeVisible();
});

test('live preview shows computed capacity', async ({ page }) => {
  await page.getByRole('button', { name: /days/ }).first().click();
  await page.getByLabel('Team Size').fill('5');
  await page.getByLabel('Iteration Days').fill('10');
  await page.getByLabel('PTO Days').fill('0');
  await page.getByLabel('Overhead %').fill('20');
  // 5 * 10 * 0.8 = 40
  await expect(page.getByText('40').first()).toBeVisible();
});

test('can update an existing capacity plan', async ({ page }) => {
  await page.getByRole('button', { name: /days/ }).first().click();
  await page.getByLabel('Team Size').fill('6');
  await page.getByLabel('Iteration Days').fill('10');
  await page.getByLabel('PTO Days').fill('0');
  await page.getByLabel('Overhead %').fill('20');
  await page.getByRole('button', { name: 'Set Capacity' }).click();

  await page.getByRole('button', { name: /48 days/ }).first().click();
  await page.getByLabel('Team Size').fill('8');
  await page.getByRole('button', { name: 'Set Capacity' }).click();
  // 8 * 10 * 0.8 = 64
  await expect(page.getByText('64').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /64 days/ }).first()).toBeVisible();
});

test('shows committed story points for cells that have stories', async ({ page }) => {
  // Fixture: Alpha team / Iteration 1 — Login flow (3 pts) + Token refresh (2 pts) = 5 pts
  await expect(page.getByText('5 pts committed').first()).toBeVisible();
});

test('shows correct totals for multiple iterations', async ({ page }) => {
  // Alpha/I2: Password reset (2) + SAML handshake (5) = 7 pts
  await expect(page.getByText('7 pts committed').first()).toBeVisible();
  // Beta/I1: Metrics pipeline (4 pts)
  await expect(page.getByText('4 pts committed').first()).toBeVisible();
});
