import { expect, test } from '@playwright/test';
import { goToPage, resetDb, selectPI } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetDb();
  await selectPI(page);
  await goToPage(page, 'PI Setup');
});

test('shows Setup heading', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'PI Setup' })).toBeVisible();
});

test('shows PI name in details section', async ({ page }) => {
  await expect(page.locator('dd', { hasText: 'PI 2026.1' })).toBeVisible();
});

test('shows PI status badge', async ({ page }) => {
  await expect(page.getByText('active')).toBeVisible();
});

test('shows five iterations', async ({ page }) => {
  // Fixture has 5 iterations (I1–I4 + IP)
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(5);
});

test('Edit link shows inline form with current name', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByLabel('Name')).toHaveValue('PI 2026.1');
});

test('Cancel edit restores read-only view', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByLabel('Name')).not.toBeVisible();
  await expect(page.locator('dd', { hasText: 'PI 2026.1' })).toBeVisible();
});

test('can rename the PI', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Name').fill('PI 2026.1 — Renamed');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByLabel('Name')).not.toBeVisible();
  await expect(page.locator('dd', { hasText: 'PI 2026.1 — Renamed' })).toBeVisible();
});

test('Activate button is disabled when PI is active', async ({ page }) => {
  // Fixture PI is already active
  await expect(page.getByRole('button', { name: 'Activate' })).toBeDisabled();
});

test('Close button is enabled when PI is active', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Close' })).toBeEnabled();
});

test('can close an active PI', async ({ page }) => {
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText('closed')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close' })).toBeDisabled();
});

test('+ Add link shows new iteration form', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add' }).click();
  await expect(page.getByRole('heading', { name: 'New Iteration' })).toBeVisible();
});

test('iteration form requires dates', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByRole('button', { name: 'Add Iteration' }).click();
  await expect(page.getByText('Start and end dates are required.')).toBeVisible();
});

test('can add a new iteration', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByLabel('Start Date').fill('2026-01-12');
  await page.getByLabel('End Date').fill('2026-01-23');
  await page.getByRole('button', { name: 'Add Iteration' }).click();
  await expect(page.getByRole('heading', { name: 'New Iteration' })).not.toBeVisible();
  // Now 6 rows
  await expect(page.locator('tbody tr')).toHaveCount(6);
});

test('can delete an iteration', async ({ page }) => {
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(5);
  await rows.first().getByRole('button', { name: 'Delete' }).click();
  await expect(rows).toHaveCount(4);
});

test('delete PI section is visible', async ({ page }) => {
  await expect(page.getByText('Delete this PI')).toBeVisible();
});

test('Delete PI requires confirmation', async ({ page }) => {
  await page.getByRole('button', { name: 'Delete PI' }).click();
  await expect(page.getByText('Are you sure? This cannot be undone.')).toBeVisible();
});

test('can cancel PI deletion', async ({ page }) => {
  await page.getByRole('button', { name: 'Delete PI' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Are you sure? This cannot be undone.')).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'PI Setup' })).toBeVisible();
});
