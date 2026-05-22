import { expect, test, type Page } from '@playwright/test';
import { resetDb, selectPI, waitForAppReady } from './helpers';

async function goToStories(page: Page) {
  await page.getByRole('link', { name: 'Stories' }).click();
  await page.waitForURL(/\/stories/);
  await waitForAppReady(page);
}

test.beforeEach(async ({ page }) => {
  await resetDb();
  await selectPI(page);
  await goToStories(page);
});

// ── add story ─────────────────────────────────────────────────────────────────

test('New Story button opens the add modal', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Story' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'New Story' })).toBeVisible();
});

test('modal closes on Cancel', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Story' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('can create a new story and it appears in the table', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Story' }).click();
  await page.getByLabel('Name').fill('E2E New Story');
  await page.getByLabel('Points').fill('3');
  // Explicitly select feature and team to avoid race between modal open and query resolution
  await page.locator('#story-feature').selectOption({ label: 'Auth Service' });
  await page.locator('#story-team').selectOption({ label: 'Alpha' });
  await page.getByRole('button', { name: 'Add Story' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('cell', { name: 'E2E New Story' })).toBeVisible();
});

test('new story shows correct feature name in table', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Story' }).click();
  await page.getByLabel('Name').fill('E2E Feature Check');
  await page.getByLabel('Points').fill('3');
  await page.locator('#story-feature').selectOption({ label: 'Auth Service' });
  await page.locator('#story-team').selectOption({ label: 'Alpha' });
  await page.getByRole('button', { name: 'Add Story' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const row = page.getByRole('row', { name: /E2E Feature Check/ });
  await expect(row.getByRole('cell', { name: 'Auth Service' })).toBeVisible();
});

// ── validation ────────────────────────────────────────────────────────────────

test('add form requires name — shows error and keeps modal open', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Story' }).click();
  await page.getByLabel('Name').clear();
  await page.getByRole('button', { name: 'Add Story' }).click();
  await expect(page.getByText('Name is required.')).toBeVisible();
  await expect(page.getByRole('dialog')).toBeVisible();
});

// ── edit story ────────────────────────────────────────────────────────────────

test('Edit button opens modal pre-filled with existing story values', async ({ page }) => {
  const row = page.getByRole('row', { name: /Login flow/ });
  await row.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Edit Story' })).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('Login flow');
});

test('can edit a story name and see the update in the table', async ({ page }) => {
  const row = page.getByRole('row', { name: /Login flow/ });
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Name').fill('Login flow (updated)');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('cell', { name: 'Login flow (updated)' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Login flow', exact: true })).not.toBeVisible();
});

test('can change story points via edit', async ({ page }) => {
  const row = page.getByRole('row', { name: /Token refresh/ });
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Points').fill('8');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const updatedRow = page.getByRole('row', { name: /Token refresh/ });
  await expect(updatedRow.getByText('8')).toBeVisible();
});

// ── delete story ──────────────────────────────────────────────────────────────

test('Delete button shows inline confirmation row', async ({ page }) => {
  const row = page.getByRole('row', { name: /Password reset/ });
  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('button', { name: 'Yes, delete' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
});

test('Cancel delete dismisses confirmation and keeps the row', async ({ page }) => {
  const row = page.getByRole('row', { name: /Password reset/ });
  await row.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Yes, delete' })).not.toBeVisible();
  await expect(page.getByRole('cell', { name: 'Password reset' })).toBeVisible();
});

test('can delete a story and it disappears from the table', async ({ page }) => {
  // Create a story to safely delete (avoids mutating fixture data for other tests)
  await page.getByRole('button', { name: '+ New Story' }).click();
  await page.getByLabel('Name').fill('E2E Delete Target');
  await page.getByLabel('Points').fill('3');
  await page.locator('#story-feature').selectOption({ label: 'Auth Service' });
  await page.locator('#story-team').selectOption({ label: 'Alpha' });
  await page.getByRole('button', { name: 'Add Story' }).click();
  await expect(page.getByRole('cell', { name: 'E2E Delete Target' })).toBeVisible();

  const row = page.getByRole('row', { name: /E2E Delete Target/ });
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, delete' }).click();
  await expect(page.getByRole('cell', { name: 'E2E Delete Target' })).not.toBeVisible();
});
