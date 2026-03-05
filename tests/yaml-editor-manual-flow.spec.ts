/**
 * YAML Editor Manual Flow - Step-by-step with screenshots at each step
 * Run: npx playwright test tests/yaml-editor-manual-flow.spec.ts
 * Screenshots saved to test-results/yaml-flow-screenshots/
 */
import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';
const SCREENSHOT_DIR = path.join(process.cwd(), 'test-results', 'yaml-flow-screenshots');

test('YAML editor flow with step-by-step screenshots', async ({ page }) => {
  test.setTimeout(60000);
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // Step 1: Navigate
  await page.goto(`${BASE_URL}/otel-flow`);
  await page.waitForSelector('[data-testid="rf__wrapper"]', { timeout: 20000 });
  await page.waitForTimeout(2500);

  // Load scenario with Collector: open Scenario dropdown (shows "Simple" by default)
  const scenarioBtn = page.locator('button').filter({ hasText: /^Simple$|^With Agent$|^Gateway$|^Scenario$/ }).first();
  await scenarioBtn.click();
  await page.waitForTimeout(500);
  const withAgentOption = page.locator('button:has-text("With Agent")').first();
  await withAgentOption.click();
  await page.waitForTimeout(1500);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1-initial-canvas.png'), fullPage: true });
  console.log('Step 1: Initial canvas screenshot saved');

  // Step 2 & 3: Find and click Collector node (Agent scenario has "EDOT Agent" or similar label)
  const collectorNode = page.locator('.react-flow__node').filter({
    has: page.locator('text=/Agent|Collector|Gateway/i'),
  }).first();
  await collectorNode.click({ timeout: 10000 });
  await page.waitForTimeout(800);

  // Step 4: Config panel visible
  await page.waitForSelector('text=Configure Node', { timeout: 3000 });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '2-config-panel.png'), fullPage: true });
  console.log('Step 4: Config panel screenshot saved');

  // Step 5: Click View YAML Configuration
  const viewYamlBtn = page.locator('button:has-text("View YAML Configuration")');
  await viewYamlBtn.click();
  await page.waitForTimeout(1200);

  // Step 6: YAML flyout open
  await page.waitForSelector('h2:has-text("Collector YAML Config")', { timeout: 3000 });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '3-yaml-flyout-view.png'), fullPage: true });
  console.log('Step 6: YAML flyout (View mode) screenshot saved');

  // Step 7: Click Edit in the View|Edit toggle
  const editBtn = page.getByRole('button', { name: 'Edit' }).first();
  await editBtn.click();
  await page.waitForTimeout(1500); // Monaco loads async

  // Step 8: Verify Monaco editor and take screenshot
  const monacoEditor = page.locator('.monaco-editor').first();
  await monacoEditor.waitFor({ state: 'visible', timeout: 8000 });
  const editorContent = await page.locator('.view-lines').first().textContent();
  const hasYaml = editorContent && /receivers|service|exporters|processors/i.test(editorContent);
  console.log('Monaco editor content visible:', hasYaml);
  console.log('Editor text preview:', editorContent?.slice(0, 200) || '(empty)');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '4-monaco-edit-mode.png'), fullPage: true });
  console.log('Step 8: Monaco Edit mode screenshot saved');
});
