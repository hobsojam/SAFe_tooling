import { expect, test } from '@playwright/test';
import { resetDb } from './helpers';

test.beforeEach(async () => {
  await resetDb();
});

test('sidebar shows app name and PI selector on load', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('SAFe Tools').first()).toBeVisible();
  await expect(page.getByRole('combobox')).toBeVisible();
  await expect(page.getByRole('combobox')).toContainText('Select PI…');
});

test('placeholder shown when no PI selected', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Select a Program Increment to get started.').first()).toBeVisible();
});

test('selecting a PI navigates to the board page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox').selectOption({ label: 'PI 2026.1' });
  await page.waitForURL(/\/pi\/.+\/board/);
  await expect(page.getByRole('heading', { name: /Program Board/ })).toBeVisible();
});

test('nav links appear after selecting a PI', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox').selectOption({ label: 'PI 2026.1' });
  await page.waitForURL(/\/pi\/.+\/board/);

  await expect(page.getByRole('link', { name: 'Board' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Backlog' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Risks' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Dependencies' })).toBeVisible();
});

test('clicking Backlog nav link navigates correctly', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox').selectOption({ label: 'PI 2026.1' });
  await page.waitForURL(/\/pi\/.+\/board/);
  await page.getByRole('link', { name: 'Backlog' }).click();
  await page.waitForURL(/\/pi\/.+\/backlog/);
  await expect(page.getByRole('heading', { name: /Program Backlog/ })).toBeVisible();
});

test('clicking Risks nav link navigates correctly', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox').selectOption({ label: 'PI 2026.1' });
  await page.waitForURL(/\/pi\/.+\/board/);
  await page.getByRole('link', { name: 'Risks' }).click();
  await page.waitForURL(/\/pi\/.+\/risks/);
  await expect(page.getByRole('heading', { name: /Risk Register/ })).toBeVisible();
});

test('clicking Dependencies nav link navigates correctly', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox').selectOption({ label: 'PI 2026.1' });
  await page.waitForURL(/\/pi\/.+\/board/);
  await page.getByRole('link', { name: 'Dependencies' }).click();
  await page.waitForURL(/\/pi\/.+\/dependencies/);
  await expect(page.getByRole('heading', { name: /Dependencies/ })).toBeVisible();
});

test('New PI button is visible in the sidebar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '+ New PI' })).toBeVisible();
});

test('disclaimer is visible in the sidebar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/Unofficial SAFe® tooling/).first()).toBeVisible();
});
