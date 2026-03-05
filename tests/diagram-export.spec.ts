import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function openDiagramTab(page: Page): Promise<void> {
  const exportButton = page.locator('a,button').filter({ hasText: /^Export/ }).first();
  await expect(exportButton).toBeVisible();
  await exportButton.click();

  const diagramTab = page.getByRole('tab', { name: 'Diagram' });
  await expect(diagramTab).toBeVisible();
  await diagramTab.click();
}

async function ensureTopology(page: Page): Promise<void> {
  const clearButton = page.getByLabel('Clear canvas');
  if (await clearButton.isEnabled()) {
    return;
  }

  const scenarioTrigger = page.locator('button, a').filter({
    hasText: /Simple|Agent|Gateway|Production|Docker|Kubernetes|Scenario/,
  }).first();
  await expect(scenarioTrigger).toBeVisible();
  await scenarioTrigger.click();

  const preferredScenario = page.locator('text=With Agent').first();
  if (await preferredScenario.isVisible()) {
    await preferredScenario.click();
  } else {
    await page.locator('text=Simple').first().click();
  }

  await expect(clearButton).toBeEnabled({ timeout: 10_000 });
}

test.describe('Diagram export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/otel-flow`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="rf__wrapper"]');
  });

  test('shows diagram tab and format options', async ({ page }) => {
    await ensureTopology(page);
    await openDiagramTab(page);

    await expect(page.getByRole('button', { name: 'PNG', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'SVG', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'JPEG', exact: true })).toBeVisible();
    await expect(page.getByText('Preview', { exact: true })).toBeVisible();
  });

  test('disables diagram actions when canvas is empty', async ({ page }) => {
    const clearButton = page.getByLabel('Clear canvas');
    await expect(clearButton).toBeVisible();
    if (await clearButton.isEnabled()) {
      await clearButton.click();
      await page.waitForTimeout(300);
    }

    await openDiagramTab(page);
    await expect(page.getByRole('button', { name: /Download/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Copy to Clipboard' })).toBeDisabled();
  });

  test('downloads valid png export', async ({ page }) => {
    await ensureTopology(page);
    await openDiagramTab(page);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download PNG', exact: true }).click(),
    ]);

    const filePath = path.join('test-results', download.suggestedFilename());
    await download.saveAs(filePath);
    const stat = fs.statSync(filePath);
    expect(download.suggestedFilename()).toMatch(/\.png$/);
    expect(stat.size).toBeGreaterThan(5_000);
  });

  test('downloads valid svg export', async ({ page }) => {
    await ensureTopology(page);
    await openDiagramTab(page);
    await page.getByRole('button', { name: 'SVG', exact: true }).click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download SVG', exact: true }).click(),
    ]);

    const filePath = path.join('test-results', download.suggestedFilename());
    await download.saveAs(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(download.suggestedFilename()).toMatch(/\.svg$/);
    expect(content).toContain('<svg');
    expect(content).toContain('</svg>');
  });

  test('copies diagram to clipboard and shows confirmation', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE_URL });
    await ensureTopology(page);
    await openDiagramTab(page);

    await page.getByRole('button', { name: 'Copy to Clipboard' }).click();
    await expect(page.getByText('Copied to clipboard')).toBeVisible();
  });

  test('diagram tab visual regression', async ({ page }) => {
    await ensureTopology(page);
    await openDiagramTab(page);
    await expect(page).toHaveScreenshot('export-diagram-tab.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});
