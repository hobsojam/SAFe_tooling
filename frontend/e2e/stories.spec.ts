import { expect, test } from '@playwright/test';
import { goToPage, resetDb, selectPI } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetDb();
  await selectPI(page);
  await goToPage(page, 'Backlog');
});

test('story expand toggle is shown for each feature', async ({ page }) => {
  const rows = page.getByRole('row').filter({ has: page.getByRole('button', { name: /▶|▼|Stories/ }) });
  await expect(rows.first()).toBeVisible();
});

test('expanding a feature shows story panel', async ({ page }) => {
  const featureRow = page.getByRole('row', { name: /Auth Service/ });
  await featureRow.getByRole('button', { name: /▶|▼|Stories/ }).click();
  await expect(page.getByRole('button', { name: '+ Add Story' }).first()).toBeVisible();
});

test('can add a story to a feature', async ({ page }) => {
  const featureRow = page.getByRole('row', { name: /Auth Service/ });
  await featureRow.getByRole('button', { name: /▶|▼|Stories/ }).click();
  await page.getByRole('button', { name: '+ Add Story' }).click();
  await page.getByRole('textbox', { name: 'Story name' }).fill('New login story');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('table').getByText('New login story')).toBeVisible();
});

test('add story requires name', async ({ page }) => {
  const featureRow = page.getByRole('row', { name: /Auth Service/ });
  await featureRow.getByRole('button', { name: /▶|▼|Stories/ }).click();
  await page.getByRole('button', { name: '+ Add Story' }).click();
  await page.getByRole('textbox', { name: 'Story name' }).clear();
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Name is required.').first()).toBeVisible();
});

test('can edit a story name', async ({ page }) => {
  const featureRow = page.getByRole('row', { name: /Auth Service/ });
  await featureRow.getByRole('button', { name: /▶|▼|Stories/ }).click();
  await page.getByRole('button', { name: '+ Add Story' }).click();
  await page.getByRole('textbox', { name: 'Story name' }).fill('Story to edit');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('table').getByText('Story to edit')).toBeVisible();

  const storyRow = page.locator('table table').getByRole('row', { name: /Story to edit/ });
  await storyRow.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('textbox', { name: 'Story name' }).fill('Story edited');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('table').getByText('Story edited')).toBeVisible();
  await expect(page.locator('table').getByText('Story to edit')).not.toBeVisible();
});

test('can delete a story', async ({ page }) => {
  const featureRow = page.getByRole('row', { name: /Auth Service/ });
  await featureRow.getByRole('button', { name: /▶|▼|Stories/ }).click();
  await page.getByRole('button', { name: '+ Add Story' }).click();
  await page.getByRole('textbox', { name: 'Story name' }).fill('Story to delete');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('table').getByText('Story to delete')).toBeVisible();

  const storyRow = page.locator('table table').getByRole('row', { name: /Story to delete/ });
  await storyRow.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Yes, delete' }).click();
  await expect(page.locator('table').getByText('Story to delete')).not.toBeVisible();
});

test('cancel delete dismisses confirmation', async ({ page }) => {
  const featureRow = page.getByRole('row', { name: /Auth Service/ });
  await featureRow.getByRole('button', { name: /▶|▼|Stories/ }).click();
  await page.getByRole('button', { name: '+ Add Story' }).click();
  await page.getByRole('textbox', { name: 'Story name' }).fill('Keep this story');
  await page.getByRole('button', { name: 'Add' }).click();

  const storyRow = page.locator('table table').getByRole('row', { name: /Keep this story/ });
  await storyRow.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('table').getByText('Keep this story')).toBeVisible();
});

test('collapsing a feature hides the story panel', async ({ page }) => {
  const featureRow = page.getByRole('row', { name: /Auth Service/ });
  const toggle = featureRow.getByRole('button', { name: /▶|▼|Stories/ });
  await toggle.click();
  await expect(page.getByText('+ Add Story').first()).toBeVisible();
  await toggle.click();
  await expect(page.getByText('+ Add Story')).not.toBeVisible();
});
