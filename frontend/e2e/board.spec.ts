import { expect, test } from '@playwright/test';
import { resetDb, selectPI } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetDb();
  await selectPI(page);
});

test('shows program board heading with PI name', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Program Board — PI 2026\.1/ })).toBeVisible();
});

test('shows iteration column headers', async ({ page }) => {
  await expect(page.getByText('I1', { exact: true })).toBeVisible();
  await expect(page.getByText('I2', { exact: true })).toBeVisible();
  await expect(page.getByText('I3', { exact: true })).toBeVisible();
  await expect(page.getByText('I4', { exact: true })).toBeVisible();
  await expect(page.getByText(/I5.*IP/)).toBeVisible();
  await expect(page.getByText('Unplanned', { exact: true })).toBeVisible();
});

test('shows all team names in the board rows', async ({ page }) => {
  // All ART teams appear as rows, regardless of whether they have assigned features
  await expect(page.getByText('Alpha', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Beta', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Gamma', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Delta', { exact: true }).first()).toBeVisible();
});

test('shows all four features', async ({ page }) => {
  // Use exact:true to avoid matching "Auth service token…" in the dependency description
  await expect(page.getByText('Auth Service', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('SSO Integration', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Observability Dashboard', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('CI/CD Pipeline Upgrade', { exact: true }).first()).toBeVisible();
});

test('Auth Service placed in Iteration 1 column', async ({ page }) => {
  // The fixture assigns Auth Service to Alpha team, Iteration 1.
  // Board cells have data-cell-team and data-cell-iter attributes for reliable lookup.
  const i1Cell = page.locator('[data-cell-team="Alpha"][data-cell-iter="I1"]');
  await expect(i1Cell.getByText('Auth Service')).toBeVisible();
});

test('dependencies table shown below the board', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Dependencies/ })).toBeVisible();
  await expect(page.getByText('Auth API contract').first()).toBeVisible();
});

test('cross-team dependency shown as red arrow on the board grid', async ({ page }) => {
  // The fixture has exactly 1 cross-team dependency (Observability Dashboard → Auth Service)
  // and 2 same-team dependencies; only the cross-team one should produce an SVG arrow.
  await expect(page.locator('[data-dep-id]')).toHaveCount(1);
});

test('dependency arrow visible on first load without user interaction', async ({ page }) => {
  // Regression: arrows were only appearing after a feature was dragged because the
  // measurement effect depended solely on measureArrows (derived from ctDeps), which
  // could be stable across the Spinner→Board transition leaving boardRef unmeasured.
  await expect(page.locator('[data-dep-id]')).toHaveCount(1);
  // Verify the SVG is actually in the DOM (not just a count of 0 being wrong)
  await expect(page.locator('svg[aria-hidden="true"]')).toBeVisible();
});

test('same-team dependencies do not produce board arrows', async ({ page }) => {
  // Total deps = 3, cross-team = 1, so same-team = 2 produce no arrows
  const arrows = page.locator('[data-dep-id]');
  await expect(arrows).toHaveCount(1);
  // Confirm the two same-team dep descriptions are visible in the table but not as arrows
  await expect(page.getByText('Auth API contract', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Observability metrics endpoint', { exact: false }).first()).toBeVisible();
});

test('Unassigned section is always visible', async ({ page }) => {
  await expect(page.getByText(/Unassigned \(/).first()).toBeVisible();
});

test('shows Unassigned section with correct count when features have no team', async ({ page }) => {
  // Fixture includes "Reporting Module" with no team_id
  await expect(page.getByText(/Unassigned \(1\)/).first()).toBeVisible();
});

test('unassigned feature appears in the Unassigned section as a draggable card', async ({ page }) => {
  await expect(page.getByText('Reporting Module', { exact: true }).first()).toBeVisible();
});

test('dragging an assigned feature to the Unassigned section removes its team', async ({ page }) => {
  // Auth Service starts assigned to Alpha. Drag it onto Reporting Module which is
  // already in the unassigned drop zone — the zone covers the whole area.
  // Use explicit mouse steps to generate enough intermediate pointermove events to
  // cross dnd-kit PointerSensor's activationConstraint: { distance: 5 } in headless CI.
  const src = page.getByText('Auth Service', { exact: true }).first();
  const dest = page.getByText('Reporting Module', { exact: true }).first();
  const srcBox = (await src.boundingBox())!;
  const destBox = (await dest.boundingBox())!;
  await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(destBox.x + destBox.width / 2, destBox.y + destBox.height / 2, { steps: 20 });
  await page.mouse.up();
  // Count increases from 1 to 2 and Auth Service appears in the unassigned list
  await expect(page.getByText(/Unassigned \(2\)/).first()).toBeVisible();
});

test('feature whose dependency provider is in the same iteration is marked at-risk', async ({ page }) => {
  // Dep 3 (mitigated): Observability Dashboard (consumer, I1) needs Auth Service (provider, I1).
  // Provider is in the same iteration as consumer, so it can't be done first → consumer is at-risk.
  await expect(page.locator('[data-at-risk="true"]', { hasText: 'Observability Dashboard' })).toBeVisible();
});

test('feature whose dependency provider is in an earlier iteration is not at-risk', async ({ page }) => {
  // Dep 2 (identified): CI/CD Pipeline Upgrade (consumer, I3) needs Observability Dashboard (provider, I1).
  // Provider (I1) is strictly before consumer (I3) → dependency will be satisfied → consumer is not at-risk.
  await expect(page.locator('[data-at-risk="true"]', { hasText: 'CI/CD Pipeline Upgrade' })).not.toBeVisible();
});

test('feature that only provides dependencies is not marked at-risk', async ({ page }) => {
  // Auth Service is the provider in dep 3 but never the consumer of an unresolved dep.
  await expect(page.locator('[data-at-risk="true"]', { hasText: 'Auth Service' })).not.toBeVisible();
});

test('unassigned feature is marked at-risk', async ({ page }) => {
  // Reporting Module has no team — always at-risk regardless of dependencies
  await expect(page.locator('[data-at-risk="true"]', { hasText: 'Reporting Module' })).toBeVisible();
});

test('feature only in a resolved dependency is not marked at-risk', async ({ page }) => {
  // SSO Integration only appears in the resolved dep (Auth Service → SSO Integration)
  // It is assigned to a team, so it should not be red
  await expect(page.locator('[data-at-risk="true"]', { hasText: 'SSO Integration' })).not.toBeVisible();
});
