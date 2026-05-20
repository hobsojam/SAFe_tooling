import { expect, test } from '@playwright/test';
import { goToPage, resetDb, selectPI } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetDb();
  await selectPI(page);
  await goToPage(page, 'Objectives');
});

test('shows Objectives heading', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /PI Objectives/ })).toBeVisible();
});

test('+ New Objective button opens modal', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Objective' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'New Objective' })).toBeVisible();
});

test('modal closes on Cancel', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Objective' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('create form requires description', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Objective' }).click();
  await page.getByLabel('Description').clear();
  await page.getByRole('button', { name: 'Add Objective' }).click();
  await expect(page.getByText('Description is required.').first()).toBeVisible();
});

test('can create a committed objective', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Objective' }).click();
  await page.getByLabel('Description').fill('Deliver auth service v2');
  await page.getByLabel('Planned BV (1–10)').fill('8');
  await page.getByRole('button', { name: 'Add Objective' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('table').getByText('Deliver auth service v2', { exact: true })).toBeVisible();
  const newRow = page.getByRole('row', { name: /Deliver auth service v2/ });
  await expect(newRow.getByText('Committed')).toBeVisible();
});

test('can create a stretch objective', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Objective' }).click();
  await page.getByLabel('Description').fill('Nice-to-have SSO feature');
  await page.getByLabel('Stretch objective').check();
  await page.getByRole('button', { name: 'Add Objective' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('table').getByText('Nice-to-have SSO feature')).toBeVisible();
  const newRow = page.getByRole('row', { name: /Nice-to-have SSO feature/ });
  await expect(newRow.getByText('Stretch')).toBeVisible();
});

test('can edit an objective description', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Objective' }).click();
  await page.getByLabel('Description').fill('Original description');
  await page.getByRole('button', { name: 'Add Objective' }).click();

  await page.locator('table').getByRole('button', { name: 'Original description' }).click();
  await page.getByLabel('Description').fill('Updated description');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.locator('table').getByText('Updated description')).toBeVisible();
  await expect(page.locator('table').getByText('Original description')).not.toBeVisible();
});

test('can score actual BV on an objective', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Objective' }).click();
  await page.getByLabel('Description').fill('Objective to score');
  await page.getByLabel('Planned BV (1–10)').fill('9');
  await page.getByRole('button', { name: 'Add Objective' }).click();

  await page.locator('table').getByRole('button', { name: 'Objective to score' }).click();
  await page.getByLabel('Actual BV').fill('7');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  const row = page.getByRole('row', { name: /Objective to score/ });
  await expect(row.getByText('7')).toBeVisible();
});

test('delete shows inline confirmation', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Objective' }).click();
  await page.getByLabel('Description').fill('Objective to delete');
  await page.getByRole('button', { name: 'Add Objective' }).click();

  const row = page.getByRole('row', { name: /Objective to delete/ });
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('table').getByText(/Delete.*Objective to delete/)).toBeVisible();
});

test('cancel delete dismisses confirmation', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Objective' }).click();
  await page.getByLabel('Description').fill('Keep this objective');
  await page.getByRole('button', { name: 'Add Objective' }).click();

  const row = page.getByRole('row', { name: /Keep this objective/ });
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('table').getByText('Keep this objective')).toBeVisible();
});

test('can delete an objective', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Objective' }).click();
  await page.getByLabel('Description').fill('To be deleted');
  await page.getByRole('button', { name: 'Add Objective' }).click();

  const row = page.getByRole('row', { name: /To be deleted/ });
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, delete' }).click();
  await expect(page.locator('table').getByText('To be deleted')).not.toBeVisible();
});
