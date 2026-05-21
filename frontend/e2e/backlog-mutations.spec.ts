import { expect, test } from '@playwright/test';
import { goToPage, resetDb, selectPI } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetDb();
  await selectPI(page);
  await goToPage(page, 'Backlog');
});

test('New Feature button opens modal', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Feature' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'New Feature' })).toBeVisible();
});

test('modal closes on Cancel', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Feature' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('create form requires name', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Feature' }).click();
  await page.getByLabel('Name').clear();
  await page.getByRole('button', { name: 'Add Feature' }).click();
  await expect(page.getByText('Feature name is required.')).toBeVisible();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('can create a new feature', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Feature' }).click();
  await page.getByLabel('Name').fill('Mobile App Redesign');
  await page.getByLabel('User / Business Value').fill('8');
  await page.getByLabel('Time Criticality').fill('6');
  await page.getByLabel('Risk Reduction / OE').fill('4');
  await page.getByLabel('Job Size').fill('3');
  await page.getByRole('button', { name: 'Add Feature' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText('Mobile App Redesign')).toBeVisible();
});

test('WSJF score is computed and shown after creation', async ({ page }) => {
  // CoD = 8+6+4 = 18, Job Size = 3, WSJF = 6
  await page.getByRole('button', { name: '+ New Feature' }).click();
  await page.getByLabel('Name').fill('WSJF Computed Feature');
  await page.getByLabel('User / Business Value').fill('8');
  await page.getByLabel('Time Criticality').fill('6');
  await page.getByLabel('Risk Reduction / OE').fill('4');
  await page.getByLabel('Job Size').fill('3');
  await page.getByRole('button', { name: 'Add Feature' }).click();
  const row = page.getByRole('row', { name: /WSJF Computed Feature/ });
  // CoD = 18
  await expect(row.getByText('18')).toBeVisible();
});

test('Edit button opens modal pre-filled', async ({ page }) => {
  const row = page.getByRole('row', { name: /Auth Service/ });
  await row.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('heading', { name: 'Edit Feature' })).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('Auth Service');
});

test('can edit a feature name', async ({ page }) => {
  const row = page.getByRole('row', { name: /CI\/CD Pipeline Upgrade/ });
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Name').fill('CI/CD Pipeline Upgrade v2');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText('CI/CD Pipeline Upgrade v2')).toBeVisible();
});

test('can edit a feature status', async ({ page }) => {
  const row = page.getByRole('row', { name: /Auth Service/ });
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Status').selectOption('implementing');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(row.getByText('implementing')).toBeVisible();
});

test('can delete a newly created feature', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Feature' }).click();
  await page.getByLabel('Name').fill('TEMP: to be deleted');
  await page.getByLabel('User / Business Value').fill('1');
  await page.getByLabel('Time Criticality').fill('1');
  await page.getByLabel('Risk Reduction / OE').fill('1');
  await page.getByLabel('Job Size').fill('1');
  await page.getByRole('button', { name: 'Add Feature' }).click();
  await expect(page.getByText('TEMP: to be deleted')).toBeVisible();

  const row = page.getByRole('row', { name: /TEMP: to be deleted/ });
  page.once('dialog', (d) => d.accept());
  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('TEMP: to be deleted')).not.toBeVisible();
});
