import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { expect, type Page } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDb = path.resolve(__dirname, '../../tests/e2e_fixture.db.json');
const cleanFixture = path.resolve(__dirname, '../../tests/e2e_fixture.clean.json');
const TEST_API_URL = 'http://localhost:8001';

export async function waitForAppReady(page: Page): Promise<void> {
  await page.getByLabel('Loading').waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
}

export async function resetDb(): Promise<void> {
  fs.copyFileSync(cleanFixture, fixtureDb);
  await fetch(`${TEST_API_URL}/dev/reset-db`, { method: 'POST' });
}

export async function selectPI(page: Page, name = 'PI 2026.1') {
  await page.goto('/');
  await expect(page.getByRole('combobox')).toBeVisible();
  await page.getByRole('combobox').selectOption({ label: name });
  await page.waitForURL(/\/pi\/.+\/board/);
  await waitForAppReady(page);
}

const PAGE_SLUGS: Partial<Record<string, string>> = {
  'PI Health': 'health',
  'PI Setup': 'setup',
  'Team Setup': 'team-setup',
};

export async function goToPage(page: Page, label: 'PI Health' | 'Board' | 'Backlog' | 'Objectives' | 'Predictability' | 'Capacity' | 'Risks' | 'Dependencies' | 'PI Setup' | 'Team Setup') {
  await page.getByRole('link', { name: label }).click();
  const slug = PAGE_SLUGS[label] ?? label.toLowerCase();
  await page.waitForURL(new RegExp(`/${slug}`));
  await waitForAppReady(page);
}
