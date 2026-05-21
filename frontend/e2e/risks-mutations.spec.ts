import { expect, test } from '@playwright/test';
import { goToPage, resetDb, selectPI } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetDb();
  await selectPI(page);
  await goToPage(page, 'Risks');
});

test('New Risk button opens modal', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Risk' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'New Risk' })).toBeVisible();
});

test('modal closes on Cancel', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Risk' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('create form requires description', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Risk' }).click();
  await page.getByRole('button', { name: 'Add Risk' }).click();
  await expect(page.getByText('Description is required.').first()).toBeVisible();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('can create a new risk', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Risk' }).click();
  await page.getByLabel('Description').fill('Database failover risk');
  await page.getByLabel('ROAM Status').selectOption('owned');
  await page.getByLabel('Owner').fill('Dave');
  await page.getByRole('button', { name: 'Add Risk' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('table').getByText('Database failover risk')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Dave' })).toBeVisible();
});

test('new risk appears with correct ROAM badge', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Risk' }).click();
  await page.getByLabel('Description').fill('Risk for badge check');
  await page.getByLabel('ROAM Status').selectOption('mitigated');
  await page.getByRole('button', { name: 'Add Risk' }).click();
  const row = page.getByRole('row', { name: /Risk for badge check/ });
  await expect(row.getByText('mitigated')).toBeVisible();
});

test('Edit button opens modal pre-filled with existing values', async ({ page }) => {
  const row = page.getByRole('row', { name: /Grafana Cloud trial expires mid-PI/ });
  await row.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Edit Risk' })).toBeVisible();
  await expect(page.getByLabel('Description')).toHaveValue('Grafana Cloud trial expires mid-PI');
  await expect(page.getByLabel('Owner')).toHaveValue('Carol');
});

test('can edit a risk owner', async ({ page }) => {
  const row = page.getByRole('row', { name: /Grafana Cloud trial expires mid-PI/ });
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Owner').fill('Dave');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('cell', { name: 'Dave' })).toBeVisible();
});

test('can change ROAM status via edit', async ({ page }) => {
  const row = page.getByRole('row', { name: /Grafana Cloud trial expires mid-PI/ });
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('ROAM Status').selectOption('resolved');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(row.getByText('resolved')).toBeVisible();
});

test('delete shows inline confirmation row', async ({ page }) => {
  const row = page.getByRole('row', { name: /Grafana Cloud trial expires mid-PI/ });
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('table').getByText(/Delete.*Grafana Cloud trial expires mid-PI/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Yes, delete' })).toBeVisible();
});

test('cancel delete dismisses inline confirmation', async ({ page }) => {
  const row = page.getByRole('row', { name: /Grafana Cloud trial expires mid-PI/ });
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Yes, delete' })).not.toBeVisible();
  await expect(page.locator('table').getByText('Grafana Cloud trial expires mid-PI')).toBeVisible();
});

test('can delete a newly created risk', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Risk' }).click();
  await page.getByLabel('Description').fill('TEMP: to be deleted');
  await page.getByRole('button', { name: 'Add Risk' }).click();
  await expect(page.locator('table').getByText('TEMP: to be deleted')).toBeVisible();

  const row = page.getByRole('row', { name: /TEMP: to be deleted/ });
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('table').getByText(/Delete.*TEMP: to be deleted/)).toBeVisible();
  await page.getByRole('button', { name: 'Yes, delete' }).click();
  await expect(page.locator('table').getByText('TEMP: to be deleted')).not.toBeVisible();
});
