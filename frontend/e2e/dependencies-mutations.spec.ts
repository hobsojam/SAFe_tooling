import { expect, test } from '@playwright/test';
import { goToPage, resetDb, selectPI } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetDb();
  await selectPI(page);
  await goToPage(page, 'Dependencies');
});

test('New Dependency button opens modal', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Dependency' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'New Dependency' })).toBeVisible();
});

test('modal closes on Cancel', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Dependency' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('create form requires description', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Dependency' }).click();
  await page.getByRole('button', { name: 'Add Dependency' }).click();
  await expect(page.getByText('Description is required.').first()).toBeVisible();
});

test('create form requires from and to features', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Dependency' }).click();
  await page.getByLabel('Description').fill('A dependency');
  await page.getByLabel('From Feature').selectOption({ value: '' });
  await page.getByRole('button', { name: 'Add Dependency' }).click();
  await expect(page.getByText('From and To features are required.').first()).toBeVisible();
});

test('can create a new dependency', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Dependency' }).click();
  await page.getByLabel('Description').fill('Payment gateway API needed by checkout');
  await page.getByLabel('From Feature').selectOption({ label: 'Auth Service (Alpha)' });
  await page.getByLabel('To Feature').selectOption({ label: 'Observability Dashboard (Beta)' });
  await page.getByLabel('Owner').fill('Eve');
  await page.getByRole('button', { name: 'Add Dependency' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('table').getByText('Payment gateway API needed by checkout')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Eve' })).toBeVisible();
});

test('Edit button opens modal pre-filled and features are disabled', async ({ page }) => {
  const row = page.getByRole('row', { name: /Observability metrics endpoint/ });
  await row.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('heading', { name: 'Edit Dependency' })).toBeVisible();
  await expect(page.getByLabel('Description')).toHaveValue(
    'Observability metrics endpoint needed by CI/CD pipeline health checks',
  );
  await expect(page.getByLabel('From Feature')).toBeDisabled();
  await expect(page.getByLabel('To Feature')).toBeDisabled();
});

test('can edit dependency status', async ({ page }) => {
  const row = page.getByRole('row', { name: /Observability metrics endpoint/ });
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Status').selectOption('resolved');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(row.getByText('resolved')).toBeVisible();
});

test('delete shows inline confirmation row', async ({ page }) => {
  const row = page.getByRole('row', { name: /Observability metrics endpoint/ });
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('table').getByText(/Delete.*Observability metrics endpoint/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Yes, delete' })).toBeVisible();
});

test('cancel delete dismisses inline confirmation', async ({ page }) => {
  const row = page.getByRole('row', { name: /Observability metrics endpoint/ });
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Yes, delete' })).not.toBeVisible();
  await expect(page.locator('table').getByText('Observability metrics endpoint needed by CI/CD pipeline health checks')).toBeVisible();
});

test('can delete a newly created dependency', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Dependency' }).click();
  await page.getByLabel('Description').fill('TEMP: to be deleted');
  await page.getByLabel('From Feature').selectOption({ label: 'Auth Service (Alpha)' });
  await page.getByLabel('To Feature').selectOption({ label: 'Observability Dashboard (Beta)' });
  await page.getByRole('button', { name: 'Add Dependency' }).click();
  await expect(page.locator('table').getByText('TEMP: to be deleted')).toBeVisible();

  const row = page.getByRole('row', { name: /TEMP: to be deleted/ });
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('table').getByText(/Delete.*TEMP: to be deleted/)).toBeVisible();
  await page.getByRole('button', { name: 'Yes, delete' }).click();
  await expect(page.locator('table').getByText('TEMP: to be deleted')).not.toBeVisible();
});
