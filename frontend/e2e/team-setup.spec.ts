import { expect, test } from '@playwright/test';
import { goToPage, resetDb, selectPI } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetDb();
  await selectPI(page);
  await goToPage(page, 'Team Setup');
});

test('shows Team Setup heading', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Team Setup' })).toBeVisible();
});

test('shows ART name below heading', async ({ page }) => {
  await expect(page.getByText('Platform ART').first()).toBeVisible();
});

test('shows both fixture teams', async ({ page }) => {
  await expect(page.getByRole('cell', { name: 'Alpha', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Beta', exact: true })).toBeVisible();
});

test('shows member counts for each team', async ({ page }) => {
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(4);
});

test('+ Add Team button opens add form', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add Team' }).click();
  await expect(page.getByRole('heading', { name: 'New Team' })).toBeVisible();
});

test('add form requires name', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add Team' }).click();
  await page.getByLabel('Name').clear();
  await page.getByRole('button', { name: 'Add Team' }).click();
  await expect(page.getByText('Name is required.').first()).toBeVisible();
});

test('can add a new team', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add Team' }).click();
  await page.getByLabel('Name').fill('Epsilon');
  await page.getByLabel('Members').fill('7');
  await page.getByRole('button', { name: 'Add Team' }).click();
  await expect(page.getByRole('heading', { name: 'New Team' })).not.toBeVisible();
  await expect(page.getByRole('cell', { name: 'Epsilon', exact: true })).toBeVisible();
});

test('Cancel add form closes without saving', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add Team' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { name: 'New Team' })).not.toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(4);
});

test('Edit button shows inline edit form with current values', async ({ page }) => {
  const row = page.getByRole('row', { name: /Alpha/ });
  await row.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('textbox', { name: 'Team name' })).toHaveValue('Alpha');
});

test('can rename a team', async ({ page }) => {
  const row = page.getByRole('row', { name: /Alpha/ });
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('textbox', { name: 'Team name' }).fill('Alpha Renamed');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('cell', { name: 'Alpha Renamed' })).toBeVisible();
});

test('Cancel edit restores read-only row', async ({ page }) => {
  const row = page.getByRole('row', { name: /Alpha/ });
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('textbox', { name: 'Team name' })).not.toBeVisible();
  await expect(page.getByRole('cell', { name: 'Alpha', exact: true })).toBeVisible();
});

test('Delete button shows inline confirmation', async ({ page }) => {
  const row = page.getByRole('row', { name: /Alpha/ });
  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('table').getByText(/Delete.*Alpha/).first()).toBeVisible();
});

test('Cancel delete dismisses confirmation', async ({ page }) => {
  const row = page.getByRole('row', { name: /Alpha/ });
  await row.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('cell', { name: 'Alpha', exact: true })).toBeVisible();
});

test('can delete a newly created team', async ({ page }) => {
  // Create a team first so we can delete it without 409 conflicts
  await page.getByRole('button', { name: '+ Add Team' }).click();
  await page.getByLabel('Name').fill('Epsilon');
  await page.getByLabel('Members').fill('4');
  await page.getByRole('button', { name: 'Add Team' }).click();
  await expect(page.getByRole('cell', { name: 'Epsilon', exact: true })).toBeVisible();

  const row = page.getByRole('row', { name: /Epsilon/ });
  await row.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Yes, delete' }).click();
  await expect(page.getByRole('cell', { name: 'Epsilon', exact: true })).not.toBeVisible();
});
