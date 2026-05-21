import { expect, test } from '@playwright/test';
import { resetDb, selectPI } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetDb();
  // Navigate via sidebar — ART Setup is always visible, no PI required
  await page.goto('/');
  await page.getByRole('link', { name: 'ART Setup' }).click();
  await page.waitForURL(/\/art-setup/);
});

test('shows ART Setup heading', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'ART Setup' })).toBeVisible();
});

test('shows fixture ART', async ({ page }) => {
  await expect(page.getByRole('cell', { name: 'Platform ART' })).toBeVisible();
});

test('shows team count for the fixture ART', async ({ page }) => {
  // Fixture has 2 teams in Platform ART
  const row = page.getByRole('row', { name: /Platform ART/ });
  await expect(row.getByRole('cell', { name: '2' })).toBeVisible();
});

test('ART Setup link is visible without a PI selected', async ({ page }) => {
  // Already on the page without selecting a PI in beforeEach
  await expect(page.getByRole('heading', { name: 'ART Setup' })).toBeVisible();
});

test('ART Setup link is visible when a PI is selected', async ({ page }) => {
  await selectPI(page);
  await page.getByRole('link', { name: 'ART Setup' }).click();
  await page.waitForURL(/\/art-setup/);
  await expect(page.getByRole('heading', { name: 'ART Setup' })).toBeVisible();
});

test('+ Add ART button opens add form', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add ART' }).click();
  await expect(page.getByRole('heading', { name: 'New ART' })).toBeVisible();
});

test('add form requires a name', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add ART' }).click();
  await page.getByLabel('Name').clear();
  await page.getByRole('button', { name: 'Add ART' }).click();
  await expect(page.getByText('Name is required.')).toBeVisible();
});

test('can add a new ART', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add ART' }).click();
  await page.getByLabel('Name').fill('Payments ART');
  await page.getByRole('button', { name: 'Add ART' }).click();
  await expect(page.getByRole('heading', { name: 'New ART' })).not.toBeVisible();
  await expect(page.getByRole('cell', { name: 'Payments ART' })).toBeVisible();
});

test('Cancel add form closes without saving', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add ART' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { name: 'New ART' })).not.toBeVisible();
});

test('Edit button shows inline input with current name', async ({ page }) => {
  const row = page.getByRole('row', { name: /Platform ART/ });
  await row.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('textbox', { name: 'ART name' })).toHaveValue('Platform ART');
});

test('can rename an ART', async ({ page }) => {
  const row = page.getByRole('row', { name: /Platform ART/ });
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('textbox', { name: 'ART name' }).fill('Platform ART — Renamed');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('cell', { name: 'Platform ART — Renamed' })).toBeVisible();
});

test('Cancel edit restores read-only row', async ({ page }) => {
  const row = page.getByRole('row', { name: /Platform ART/ });
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('textbox', { name: 'ART name' })).not.toBeVisible();
  await expect(page.getByRole('cell', { name: 'Platform ART' })).toBeVisible();
});

test('Delete button shows inline confirmation', async ({ page }) => {
  const row = page.getByRole('row', { name: /Platform ART/ });
  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText(/Delete.*Platform ART/)).toBeVisible();
});

test('Cancel delete dismisses confirmation', async ({ page }) => {
  const row = page.getByRole('row', { name: /Platform ART/ });
  await row.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('cell', { name: 'Platform ART' })).toBeVisible();
});

test('can delete a newly created ART', async ({ page }) => {
  // Create a fresh ART (no teams or PIs) so the delete succeeds without a 409
  await page.getByRole('button', { name: '+ Add ART' }).click();
  await page.getByLabel('Name').fill('Temporary ART');
  await page.getByRole('button', { name: 'Add ART' }).click();
  await expect(page.getByRole('cell', { name: 'Temporary ART' })).toBeVisible();

  const row = page.getByRole('row', { name: /Temporary ART/ });
  await row.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Yes, delete' }).click();
  await expect(page.getByRole('cell', { name: 'Temporary ART' })).not.toBeVisible();
});
