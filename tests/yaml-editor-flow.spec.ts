/**
 * YAML Editor Flow Test
 * Verifies the YAML config flyout and Monaco editor work correctly.
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';

test.describe('YAML Editor Flyout', () => {
  test('full flow: canvas -> select Collector -> View YAML -> Edit mode -> Monaco shows content', async ({
    page,
  }) => {
    // Step 1: Navigate and take initial screenshot
    await page.goto(`${BASE_URL}/otel-flow`);
    await page.waitForSelector('[data-testid="rf__wrapper"]', { timeout: 10000 });
    await page.waitForTimeout(1500); // Let initial UI settle
    await expect(page).toHaveScreenshot('yaml-flow-1-initial.png', { maxDiffPixelRatio: 0.1 });

    // Step 2: Ensure we have nodes - load a scenario if canvas is empty
    const canvas = page.locator('.react-flow');
    const nodeCount = await page.locator('.react-flow__node').count();
    if (nodeCount === 0) {
      // Add nodes via sidebar - click Collector Agent to add
      const collectorAgent = page.locator('text=Collector Agent').first();
      if (await collectorAgent.isVisible()) {
        await collectorAgent.click();
        await page.waitForTimeout(500);
        // May need to click on canvas to place
        await canvas.click({ position: { x: 400, y: 300 } });
        await page.waitForTimeout(500);
      }
    }

    // Find and click a Collector node (Collector Agent or Collector Gateway)
    const collectorNode = page.locator('.react-flow__node').filter({
      has: page.locator('text=/Collector (Agent|Gateway)/i'),
    }).first();

    // Fallback: click any node with "Collector" in it
    const anyCollector = page.locator('.react-flow__node').filter({
      hasText: /Collector/i,
    }).first();

    const nodeToClick = (await collectorNode.count()) > 0 ? collectorNode : anyCollector;
    await expect(nodeToClick).toBeVisible({ timeout: 5000 });
    await nodeToClick.click();
    await page.waitForTimeout(800);

    // Step 3: Config panel should appear - take screenshot
    const configPanel = page.locator('text=Configure Node').first();
    await expect(configPanel).toBeVisible({ timeout: 3000 });
    await expect(page).toHaveScreenshot('yaml-flow-2-config-panel.png', { maxDiffPixelRatio: 0.1 });

    // Step 4: Click "View YAML Configuration"
    const viewYamlBtn = page.locator('button:has-text("View YAML Configuration")');
    await expect(viewYamlBtn).toBeVisible({ timeout: 2000 });
    await viewYamlBtn.click();
    await page.waitForTimeout(1000);

    // Flyout should open
    const flyoutTitle = page.locator('h2:has-text("Collector YAML Config")');
    await expect(flyoutTitle).toBeVisible({ timeout: 3000 });
    await expect(page).toHaveScreenshot('yaml-flow-3-yaml-flyout-view.png', { maxDiffPixelRatio: 0.1 });

    // Step 5: Click "Edit" to switch to edit mode (EuiButtonGroup uses radio-style buttons)
    const editBtn = page.getByRole('button', { name: 'Edit' }).or(page.locator('button').filter({ hasText: /^Edit$/ })).first();
    await expect(editBtn).toBeVisible({ timeout: 2000 });
    await editBtn.click();
    await page.waitForTimeout(1200); // Monaco loads async

    // Step 6: Verify Monaco editor shows content (not empty)
    const monacoEditor = page.locator('.monaco-editor').first();
    await expect(monacoEditor).toBeVisible({ timeout: 5000 });
    const editorText = await page.locator('.view-lines').first().textContent();
    const hasYamlContent =
      editorText && (editorText.includes('receivers') || editorText.includes('service') || editorText.includes('exporters'));
    expect(hasYamlContent, 'Monaco editor should show YAML content (receivers/service/exporters)').toBe(true);

    await expect(page).toHaveScreenshot('yaml-flow-4-monaco-edit-mode.png', { maxDiffPixelRatio: 0.1 });

    // Step 7: Type something to verify editor is interactive
    await monacoEditor.click();
    await page.keyboard.type('# Test comment', { delay: 50 });
    await page.waitForTimeout(300);

    // Step 8: Final screenshot with typed content
    await expect(page).toHaveScreenshot('yaml-flow-5-monaco-typed.png', { maxDiffPixelRatio: 0.15 });
  });
});
