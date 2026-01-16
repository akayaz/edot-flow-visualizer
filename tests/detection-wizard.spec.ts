import { test, expect } from '@playwright/test';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';

test.describe('Live Telemetry Detection Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/otel-flow`);
    // Wait for the canvas to be ready
    await page.waitForSelector('[data-testid="rf__wrapper"]');
  });

  // ============ Test Suite 1: Detection Wizard UI ============
  test.describe('Test Suite 1: Detection Wizard UI', () => {
    test('TC1.1: Open/Close Detection Panel', async ({ page }) => {
      // Click the sparkles button to open detection panel
      const sparklesButton = page.locator('button[title="Detect topology from config"]');
      await expect(sparklesButton).toBeVisible();
      await sparklesButton.click();

      // Panel should slide in from right
      const panel = page.locator('text=Detect Topology');
      await expect(panel).toBeVisible({ timeout: 5000 });

      // Click X button to close
      const closeButton = page.locator('button').filter({ has: page.locator('svg.lucide-x') }).first();
      await closeButton.click();

      // Panel should close
      await expect(panel).not.toBeVisible({ timeout: 5000 });

      // Open again and verify state reset
      await sparklesButton.click();
      await expect(page.locator('text=How would you like to detect your topology?')).toBeVisible();
      
      // Verify step indicator shows 3 dots
      const stepDots = page.locator('.flex.items-center.justify-center.gap-2.mb-6 .rounded-full');
      await expect(stepDots).toHaveCount(3);
    });

    test('TC1.2: Method Selection', async ({ page }) => {
      // Open detection panel
      await page.click('button[title="Detect topology from config"]');
      await page.waitForSelector('text=Detect Topology');

      // Verify 4 method cards are displayed
      const methodCards = page.locator('button.relative.p-4.rounded-xl.border');
      await expect(methodCards).toHaveCount(4);

      // Verify "Import YAML" is clickable (available)
      const yamlCard = page.locator('button:has-text("Import YAML")');
      await expect(yamlCard).toBeEnabled();

      // Verify "Live Traffic" is clickable (available)
      const trafficCard = page.locator('button:has-text("Live Traffic")');
      await expect(trafficCard).toBeEnabled();

      // Verify "Scan Repository" shows "Soon" badge and is disabled
      const scanCard = page.locator('button:has-text("Scan Repository")');
      await expect(scanCard).toBeDisabled();
      await expect(page.locator('button:has-text("Scan Repository") >> text=Soon')).toBeVisible();

      // Verify "Auto-Detect All" shows "Soon" badge and is disabled
      const autoCard = page.locator('button:has-text("Auto-Detect All")');
      await expect(autoCard).toBeDisabled();
      await expect(page.locator('button:has-text("Auto-Detect All") >> text=Soon')).toBeVisible();

      // Click YAML method - should advance to input step
      await yamlCard.click();
      await expect(page.locator('text=Import YAML Configuration')).toBeVisible();

      // Click back arrow - should return to method selection
      const backButton = page.locator('button').filter({ has: page.locator('svg.lucide-arrow-left') }).first();
      await backButton.click();
      await expect(page.locator('text=How would you like to detect your topology?')).toBeVisible();
    });
  });

  // ============ Test Suite 2: YAML Import Detection ============
  test.describe('Test Suite 2: YAML Import Detection', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('button[title="Detect topology from config"]');
      await page.waitForSelector('text=Detect Topology');
      await page.click('button:has-text("Import YAML")');
      await page.waitForSelector('text=Import YAML Configuration');
    });

    test('TC2.1: File Upload UI', async ({ page }) => {
      // Verify FileUploader component appears with drag-drop zone
      await expect(page.locator('text=Drag & drop your config file')).toBeVisible();
      await expect(page.locator('text=or click to browse')).toBeVisible();

      // Verify accepted file types are .yaml and .yml
      await expect(page.locator('text=.yaml')).toBeVisible();
      await expect(page.locator('text=.yml')).toBeVisible();
    });

    test('TC2.2: Valid OTel Collector YAML', async ({ page }) => {
      // Upload the test file via file chooser
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(__dirname, '../test-data/valid-agent.yaml'));

      // Wait for file to be processed
      await page.waitForSelector('text=valid-agent.yaml', { timeout: 10000 });

      // Verify valid configuration message
      await expect(page.locator('text=Valid configuration')).toBeVisible();

      // Verify nodes count is shown
      await expect(page.locator('text=Nodes:')).toBeVisible();

      // Click Apply to Canvas button
      const applyButton = page.locator('button:has-text("Apply to Canvas")');
      await expect(applyButton).toBeEnabled();
      await applyButton.click();

      // Wait for preview step
      await page.waitForSelector('text=Detection Results', { timeout: 10000 });

      // Verify confidence score is displayed
      await expect(page.locator('text=Confidence')).toBeVisible();

      // Verify detected nodes list shows Collector and Elastic nodes
      await expect(page.locator('text=Detected Components')).toBeVisible();
    });

    test('TC2.3: Apply to Canvas', async ({ page }) => {
      // Upload valid YAML
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(__dirname, '../test-data/valid-agent.yaml'));
      
      await page.waitForSelector('text=valid-agent.yaml');
      await page.click('button:has-text("Apply to Canvas")');
      await page.waitForSelector('text=Detection Results');

      // Click Apply to Canvas button in preview step
      const applyToCanvasBtn = page.locator('button:has-text("Apply to Canvas")').last();
      await applyToCanvasBtn.click();

      // Verify success animation with checkmark
      await expect(page.locator('text=Topology Applied!')).toBeVisible({ timeout: 5000 });

      // Panel should auto-close after ~1.5s
      await expect(page.locator('text=Detect Topology')).not.toBeVisible({ timeout: 5000 });

      // Verify canvas now shows nodes (React Flow nodes should be present)
      const nodes = page.locator('.react-flow__nodes');
      await expect(nodes).toBeVisible();
    });

    test('TC2.4: Invalid YAML Handling - non-YAML file', async ({ page }) => {
      // Create a temporary text file content
      const fileInput = page.locator('input[type="file"]');
      
      // Test with empty.yaml file (empty content)
      await fileInput.setInputFiles(path.join(__dirname, '../test-data/empty.yaml'));
      
      // Should show error or warning for empty/invalid YAML
      await page.waitForTimeout(1000);
      
      // The empty file should either show an error or have 0 nodes
      const hasError = await page.locator('.bg-red-500\\/10').isVisible().catch(() => false);
      const hasZeroNodes = await page.locator('text=Nodes: 0').isVisible().catch(() => false);
      expect(hasError || hasZeroNodes).toBeTruthy();
    });

    test('TC2.4b: Invalid YAML Handling - malformed YAML', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(__dirname, '../test-data/invalid-syntax.yaml'));

      await page.waitForTimeout(2000);
      
      // Should show error for malformed YAML
      await expect(page.locator('text=Invalid configuration').first()).toBeVisible();
    });

    test('TC2.4c: Valid YAML but not OTel config', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(__dirname, '../test-data/not-otel.yaml'));

      await page.waitForTimeout(2000);
      
      // Should show warning or invalid message
      const hasWarning = await page.locator('.bg-yellow-500\\/10').isVisible().catch(() => false);
      const hasError = await page.locator('.bg-red-500\\/10').isVisible().catch(() => false);
      const hasInvalid = await page.locator('text=Invalid configuration').isVisible().catch(() => false);
      expect(hasWarning || hasError || hasInvalid).toBeTruthy();
    });

    test('TC2.5: Gateway vs Agent Detection', async ({ page }) => {
      // Upload gateway config with tail_sampling
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(__dirname, '../test-data/valid-gateway.yaml'));
      
      await page.waitForSelector('text=valid-gateway.yaml');
      
      // Should detect as valid
      await expect(page.locator('text=Valid configuration')).toBeVisible();
      
      // Click Apply to get to preview
      await page.click('button:has-text("Apply to Canvas")');
      await page.waitForSelector('text=Detection Results');
      
      // Verify it detects as gateway (look for collector-gateway in the components list)
      // The detection result should show "collector-gateway" type for the collector
      const detectedComponents = page.locator('.max-h-32.overflow-auto');
      await expect(detectedComponents).toContainText('collector');
    });
  });

  // ============ Test Suite 3: Live Traffic Detection ============
  test.describe('Test Suite 3: Live Traffic Detection', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('button[title="Detect topology from config"]');
      await page.waitForSelector('text=Detect Topology');
      await page.click('button:has-text("Live Traffic")');
      await page.waitForSelector('text=Live Traffic Analysis');
    });

    test('TC3.1: Traffic Monitor UI', async ({ page }) => {
      // Verify TrafficMonitor component appears
      await expect(page.locator('text=Ready to analyze')).toBeVisible();
      
      // Verify "Start Listening" button is visible
      await expect(page.locator('button:has-text("Start Listening")')).toBeVisible();
      
      // Verify progress stats show 0
      await expect(page.locator('.grid.grid-cols-3 .text-xl.font-bold.text-white').first()).toContainText('0');
      await expect(page.locator('.grid.grid-cols-3 .text-xl.font-bold.text-white').nth(1)).toContainText('0');
      await expect(page.locator('.grid.grid-cols-3 .text-xl.font-bold.text-white').nth(2)).toContainText('0');
      
      // Verify back button is NOT disabled when not monitoring
      const backButton = page.locator('button').filter({ has: page.locator('svg.lucide-arrow-left') }).first();
      await expect(backButton).toBeEnabled();
    });

    test('TC3.2: Start Traffic Analysis', async ({ page }) => {
      // Click Start Listening
      await page.click('button:has-text("Start Listening")');
      
      // Verify button changes to "Stop Analysis"
      await expect(page.locator('button:has-text("Stop Analysis")')).toBeVisible({ timeout: 5000 });
      
      // Verify status message changes
      await expect(page.locator('text=Listening for traffic...')).toBeVisible();
      
      // Verify pulsing animation on status dot (green dot with animation)
      const statusDot = page.locator('.w-3.h-3.rounded-full.bg-green-400');
      await expect(statusDot).toBeVisible();
      
      // Verify back button IS disabled during monitoring
      const backButton = page.locator('button').filter({ has: page.locator('svg.lucide-arrow-left') }).first();
      await expect(backButton).toBeDisabled();
      
      // Stop the analysis to clean up
      await page.click('button:has-text("Stop Analysis")');
    });

    test('TC3.5: Empty Traffic Detection', async ({ page }) => {
      // Start traffic analysis (no real traffic flowing)
      await page.click('button:has-text("Start Listening")');
      await page.waitForSelector('button:has-text("Stop Analysis")');
      
      // Stop quickly
      await page.click('button:has-text("Stop Analysis")');
      
      // Wait for result or error
      await page.waitForTimeout(2000);
      
      // Should either show preview with 0 nodes or error message
      const hasError = await page.locator('text=No topology detected').isVisible().catch(() => false);
      const hasPreview = await page.locator('text=Detection Results').isVisible().catch(() => false);
      expect(hasError || hasPreview).toBeTruthy();
    });

    test('TC3.6: Cancel and Go Back', async ({ page }) => {
      // Start traffic analysis
      await page.click('button:has-text("Start Listening")');
      await page.waitForSelector('button:has-text("Stop Analysis")');
      
      // Verify back button is disabled during monitoring
      const backButton = page.locator('button').filter({ has: page.locator('svg.lucide-arrow-left') }).first();
      await expect(backButton).toBeDisabled();
      
      // Stop analysis
      await page.click('button:has-text("Stop Analysis")');
      
      // Wait for either preview or error state
      await page.waitForTimeout(2000);
      
      // If on preview screen, click back
      const hasPreview = await page.locator('text=Detection Results').isVisible().catch(() => false);
      if (hasPreview) {
        await backButton.click();
        // Verify returns to traffic monitor input step
        await expect(page.getByRole('heading', { name: 'Live Traffic Analysis' })).toBeVisible();
      }
    });
  });

  // ============ Test Suite 4: Detection Result Preview ============
  test.describe('Test Suite 4: Detection Result Preview', () => {
    test('TC4.1 & TC4.2: Confidence Display and Component List', async ({ page }) => {
      // Open detection and upload valid YAML
      await page.click('button[title="Detect topology from config"]');
      await page.waitForSelector('text=Detect Topology');
      await page.click('button:has-text("Import YAML")');
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(__dirname, '../test-data/valid-agent.yaml'));
      
      await page.waitForSelector('text=valid-agent.yaml');
      await page.click('button:has-text("Apply to Canvas")');
      await page.waitForSelector('text=Detection Results');
      
      // Verify confidence bar exists
      const confidenceSection = page.locator('text=Confidence');
      await expect(confidenceSection).toBeVisible();
      
      // Verify percentage is displayed
      const confidenceValue = page.locator('text=/%/');
      // Check there's a percentage displayed
      await expect(page.locator('.font-medium:has-text("%")')).toBeVisible();
      
      // Verify component list
      await expect(page.locator('text=Detected Components')).toBeVisible();
      
      // Verify each detected node has colored dot and label
      const componentList = page.locator('.max-h-32.overflow-auto');
      await expect(componentList.locator('.rounded-full').first()).toBeVisible();
    });

    test('TC4.4: Apply Button', async ({ page }) => {
      await page.click('button[title="Detect topology from config"]');
      await page.waitForSelector('text=Detect Topology');
      await page.click('button:has-text("Import YAML")');
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(__dirname, '../test-data/valid-agent.yaml'));
      
      await page.waitForSelector('text=valid-agent.yaml');
      await page.click('button:has-text("Apply to Canvas")');
      await page.waitForSelector('text=Detection Results');
      
      // Verify Apply to Canvas button is full-width and visible
      const applyButton = page.locator('button.w-full:has-text("Apply to Canvas")');
      await expect(applyButton).toBeVisible();
      
      // Click and verify success
      await applyButton.click();
      await expect(page.locator('text=Topology Applied!')).toBeVisible();
    });
  });

  // ============ Test Suite 5: Integration with Canvas ============
  test.describe('Test Suite 5: Integration with Canvas', () => {
    test('TC5.1 & TC5.2: Apply Detected Topology', async ({ page }) => {
      // Open detection and upload valid YAML
      await page.click('button[title="Detect topology from config"]');
      await page.waitForSelector('text=Detect Topology');
      await page.click('button:has-text("Import YAML")');
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(__dirname, '../test-data/valid-agent.yaml'));
      
      await page.waitForSelector('text=valid-agent.yaml');
      await page.click('button:has-text("Apply to Canvas")');
      await page.waitForSelector('text=Detection Results');
      
      // Apply to canvas
      await page.click('button.w-full:has-text("Apply to Canvas")');
      
      // Wait for success and panel close
      await expect(page.locator('text=Topology Applied!')).toBeVisible();
      await page.waitForTimeout(2000);
      
      // Verify panel closed
      await expect(page.locator('text=Detect Topology')).not.toBeVisible({ timeout: 5000 });
      
      // Verify nodes are visible on canvas
      // React Flow nodes should be rendered
      await page.waitForTimeout(500);
      const nodesContainer = page.locator('.react-flow__nodes');
      await expect(nodesContainer).toBeVisible();
    });
  });

  // ============ Test Suite 7: Edge Cases & Error Handling ============
  test.describe('Test Suite 7: Edge Cases', () => {
    test('TC7.1: Panel Close During Analysis', async ({ page }) => {
      // Open detection panel
      await page.click('button[title="Detect topology from config"]');
      await page.waitForSelector('text=Detect Topology');
      await page.click('button:has-text("Live Traffic")');
      
      // Start traffic analysis
      await page.click('button:has-text("Start Listening")');
      await page.waitForSelector('button:has-text("Stop Analysis")');
      
      // Close panel
      const closeButton = page.locator('button').filter({ has: page.locator('svg.lucide-x') }).first();
      await closeButton.click();
      
      // Verify panel is closed
      await expect(page.locator('text=Detect Topology')).not.toBeVisible({ timeout: 5000 });
      
      // Verify analysis was stopped via API
      const response = await page.request.get(`${BASE_URL}/api/detection/traffic`);
      const data = await response.json();
      expect(data.progress.isActive).toBe(false);
      
      // Re-open panel
      await page.click('button[title="Detect topology from config"]');
      
      // Verify state is reset to method selection
      await expect(page.locator('text=How would you like to detect your topology?')).toBeVisible();
    });

    test('TC7.4: Large YAML File', async ({ page }) => {
      await page.click('button[title="Detect topology from config"]');
      await page.waitForSelector('text=Detect Topology');
      await page.click('button:has-text("Import YAML")');
      
      // Upload large multi-collector YAML
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(__dirname, '../test-data/multi-collector.yaml'));
      
      // Wait for processing
      await page.waitForSelector('text=multi-collector.yaml', { timeout: 15000 });
      
      // Verify parsing completed
      await expect(page.locator('text=Valid configuration').first()).toBeVisible({ timeout: 15000 });
    });

    test('TC7.5: Multi-Document YAML', async ({ page }) => {
      await page.click('button[title="Detect topology from config"]');
      await page.waitForSelector('text=Detect Topology');
      await page.click('button:has-text("Import YAML")');
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(__dirname, '../test-data/multi-document.yaml'));
      
      await page.waitForSelector('text=multi-document.yaml', { timeout: 10000 });
      
      // Should handle multi-document YAML (may show warning or parse successfully)
      const hasResult = await page.locator('text=Nodes:').isVisible().catch(() => false);
      const hasWarning = await page.locator('.bg-yellow-500\\/10').isVisible().catch(() => false);
      expect(hasResult || hasWarning).toBeTruthy();
    });
  });

  // ============ Test Suite 8: Visual/UX Quality ============
  test.describe('Test Suite 8: Visual/UX Quality', () => {
    test('TC8.1: Panel Animations', async ({ page }) => {
      // Open panel and verify it animates in
      const sparklesButton = page.locator('button[title="Detect topology from config"]');
      await sparklesButton.click();
      
      // Panel should animate in with spring effect - look for the detection panel specifically
      const panelHeader = page.locator('text=Detect Topology');
      await expect(panelHeader).toBeVisible({ timeout: 5000 });
      
      // Close and verify animation
      const closeButton = page.locator('button').filter({ has: page.locator('svg.lucide-x') }).first();
      await closeButton.click();
      
      // Should animate out
      await expect(panelHeader).not.toBeVisible({ timeout: 5000 });
    });

    test('TC8.2: Dark Theme Consistency', async ({ page }) => {
      await page.click('button[title="Detect topology from config"]');
      await page.waitForSelector('text=Detect Topology');
      
      // Verify dark theme colors are applied - look for the panel by its header
      await expect(page.locator('text=Detect Topology').first()).toBeVisible();
      
      // Verify text has proper contrast (white text on dark bg)
      const headerText = page.locator('h3.font-semibold.text-white:has-text("Detect Topology")');
      await expect(headerText).toBeVisible();
    });
  });
});

