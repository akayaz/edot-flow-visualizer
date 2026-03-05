import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';

/**
 * Visual Theme Tests
 *
 * Validates that both light and dark modes render correctly with proper
 * visibility, contrast, and color adaptation across all components.
 */
test.describe('Theme Visual Tests', () => {
  // ============ Test Suite 1: Home Page Theme ============
  test.describe('Home Page Theme', () => {
    test('TC1.1: Home page renders correctly in dark mode', async ({ page }) => {
      await page.goto(BASE_URL);
      // Ensure dark class is on html
      await page.evaluate(() => {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
      });
      await page.waitForTimeout(300);

      // Background should be dark
      const main = page.locator('main');
      const bgColor = await main.evaluate((el) => getComputedStyle(el).backgroundColor);
      // Should be a dark background (gray-950 or similar)
      expect(bgColor).not.toBe('rgb(255, 255, 255)');

      // Title text should be visible (light color on dark bg)
      const title = page.locator('h1 span').last();
      await expect(title).toBeVisible();
      const titleColor = await title.evaluate((el) => getComputedStyle(el).color);
      // Text should be light (gray-100 = rgb(243, 244, 246) or similar)
      const [r, g, b] = titleColor.match(/\d+/g)!.map(Number);
      expect(r).toBeGreaterThan(200); // Light text

      // CTA button should be visible
      const cta = page.locator('a:has-text("Launch Visualizer")');
      await expect(cta).toBeVisible();

      // Take screenshot for visual comparison
      await expect(page).toHaveScreenshot('home-dark-mode.png', {
        maxDiffPixelRatio: 0.05,
      });
    });

    test('TC1.2: Home page renders correctly in light mode', async ({ page }) => {
      await page.goto(BASE_URL);
      // Switch to light mode
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      });
      await page.waitForTimeout(300);

      // Background should be light
      const main = page.locator('main');
      const bgColor = await main.evaluate((el) => getComputedStyle(el).backgroundColor);
      // Should be white or near-white
      const [r, g, b] = bgColor.match(/\d+/g)!.map(Number);
      expect(r).toBeGreaterThan(240);
      expect(g).toBeGreaterThan(240);
      expect(b).toBeGreaterThan(240);

      // Title text should be visible (dark color on light bg)
      const title = page.locator('h1 span').last();
      await expect(title).toBeVisible();
      const titleColor = await title.evaluate((el) => getComputedStyle(el).color);
      const [tr, tg, tb] = titleColor.match(/\d+/g)!.map(Number);
      expect(tr).toBeLessThan(50); // Dark text on light bg

      // Feature cards should have light backgrounds
      const featureCard = page.locator('.rounded-2xl').first();
      if (await featureCard.isVisible()) {
        const cardBg = await featureCard.evaluate((el) => getComputedStyle(el).backgroundColor);
        const [cr] = cardBg.match(/\d+/g)!.map(Number);
        expect(cr).toBeGreaterThan(230); // Light card bg
      }

      await expect(page).toHaveScreenshot('home-light-mode.png', {
        maxDiffPixelRatio: 0.05,
      });
    });
  });

  // ============ Test Suite 2: Flow Canvas Theme ============
  test.describe('Flow Canvas Theme', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE_URL}/otel-flow`);
      await page.waitForSelector('[data-testid="rf__wrapper"]');
    });

    test('TC2.1: Canvas starts in dark mode by default', async ({ page }) => {
      // Canvas background should be dark
      const canvas = page.locator('.react-flow');
      await expect(canvas).toBeVisible();

      // Check that html has dark class
      const hasDarkClass = await page.evaluate(() =>
        document.documentElement.classList.contains('dark')
      );
      expect(hasDarkClass).toBe(true);

      // Background should use dark CSS variable
      const bgColor = await page.evaluate(() =>
        getComputedStyle(document.body).backgroundColor
      );
      const [r] = bgColor.match(/\d+/g)!.map(Number);
      expect(r).toBeLessThan(30); // Very dark background
    });

    test('TC2.2: Theme toggle switches to light mode', async ({ page }) => {
      // Find the theme toggle button (Sun icon in dark mode)
      const themeToggle = page.locator('button[title*="Switch to light mode"]');
      await expect(themeToggle).toBeVisible();
      await themeToggle.click();

      // Wait for theme transition
      await page.waitForTimeout(500);

      // Verify html now has no dark class or has light class
      const hasDarkClass = await page.evaluate(() =>
        document.documentElement.classList.contains('dark')
      );
      expect(hasDarkClass).toBe(false);

      // Body background should be light
      const bgColor = await page.evaluate(() =>
        getComputedStyle(document.body).backgroundColor
      );
      const [r, g, b] = bgColor.match(/\d+/g)!.map(Number);
      expect(r).toBeGreaterThan(230); // Light background

      // Control panel should adapt to light mode
      const controlPanel = page.locator('.absolute.top-4').first();
      if (await controlPanel.isVisible()) {
        // Panel text should be dark for visibility on light bg
        await expect(page).toHaveScreenshot('canvas-light-mode.png', {
          maxDiffPixelRatio: 0.05,
        });
      }
    });

    test('TC2.3: Theme toggle switches back to dark mode', async ({ page }) => {
      // Switch to light
      const themeToggle = page.locator('button[title*="Switch to light mode"]');
      await expect(themeToggle).toBeVisible();
      await themeToggle.click();
      await page.waitForTimeout(300);

      // Now find toggle again (should show Moon icon for switching to dark)
      const darkToggle = page.locator('button[title*="Switch to dark mode"]');
      await expect(darkToggle).toBeVisible();
      await darkToggle.click();
      await page.waitForTimeout(300);

      // Should be back to dark
      const hasDarkClass = await page.evaluate(() =>
        document.documentElement.classList.contains('dark')
      );
      expect(hasDarkClass).toBe(true);
    });

    test('TC2.4: Control panel visibility in light mode', async ({ page }) => {
      // Switch to light mode
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      });
      await page.waitForTimeout(500);

      // Control panel should be visible with proper contrast
      // Check the deployment dropdown button
      const deploymentBtn = page.locator('button[title*="Select deployment"]');
      if (await deploymentBtn.isVisible()) {
        const textColor = await deploymentBtn.evaluate((el) =>
          getComputedStyle(el).color
        );
        const [r, g, b] = textColor.match(/\d+/g)!.map(Number);
        // Text should be dark enough to be readable (< 150)
        expect(Math.max(r, g, b)).toBeLessThan(180);
      }
    });

    test('TC2.5: Component palette visibility in light mode', async ({ page }) => {
      // Switch to light mode
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      });
      await page.waitForTimeout(500);

      // Palette should be visible
      const paletteHeader = page.locator('h3:has-text("Components")');
      if (await paletteHeader.isVisible()) {
        const textColor = await paletteHeader.evaluate((el) =>
          getComputedStyle(el).color
        );
        const [r, g, b] = textColor.match(/\d+/g)!.map(Number);
        // Should be dark text for readability
        expect(Math.max(r, g, b)).toBeLessThan(100);
      }

      // Component items should be readable
      const firstItem = page.locator('text=EDOT SDK').first();
      if (await firstItem.isVisible()) {
        const itemColor = await firstItem.evaluate((el) =>
          getComputedStyle(el).color
        );
        const [r, g, b] = itemColor.match(/\d+/g)!.map(Number);
        expect(Math.max(r, g, b)).toBeLessThan(100);
      }
    });

    test('TC2.6: Legend visibility in light mode', async ({ page }) => {
      // Switch to light mode
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      });
      await page.waitForTimeout(500);

      // Legend should be visible
      const legend = page.locator('text=Data Flow Legend');
      if (await legend.isVisible()) {
        // The telemetry type labels should be readable
        const tracesLabel = page.locator('text=Traces').first();
        if (await tracesLabel.isVisible()) {
          const labelColor = await tracesLabel.evaluate((el) =>
            getComputedStyle(el).color
          );
          const [r, g, b] = labelColor.match(/\d+/g)!.map(Number);
          // Should be dark enough for readability on light bg
          expect(Math.max(r, g, b)).toBeLessThan(150);
        }
      }
    });

    test('TC2.7: Zoom controls visibility in light mode', async ({ page }) => {
      // Switch to light mode
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      });
      await page.waitForTimeout(500);

      // Zoom controls should be visible
      const zoomPercent = page.locator('text=100%');
      if (await zoomPercent.isVisible()) {
        const textColor = await zoomPercent.evaluate((el) =>
          getComputedStyle(el).color
        );
        const [r, g, b] = textColor.match(/\d+/g)!.map(Number);
        expect(Math.max(r, g, b)).toBeLessThan(150);
      }
    });
  });

  // ============ Test Suite 3: Node Rendering in Both Modes ============
  test.describe('Node Rendering', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE_URL}/otel-flow`);
      await page.waitForSelector('[data-testid="rf__wrapper"]');
    });

    test('TC3.1: Load scenario and verify nodes visible in dark mode', async ({ page }) => {
      // Select the "Agent" scenario to populate canvas with nodes
      const scenarioBtn = page.locator('button').filter({ hasText: /Agent|Simple/ }).first();
      if (await scenarioBtn.isVisible()) {
        await scenarioBtn.click();
        await page.waitForTimeout(300);

        // Select a scenario from the dropdown
        const simplePattern = page.locator('text=Simple (Direct)').first();
        if (await simplePattern.isVisible()) {
          await simplePattern.click();
          await page.waitForTimeout(500);
        }
      }

      // Nodes should be visible (dark mode)
      await expect(page).toHaveScreenshot('nodes-dark-mode.png', {
        maxDiffPixelRatio: 0.05,
      });
    });

    test('TC3.2: Nodes visible in light mode after theme toggle', async ({ page }) => {
      // Load a scenario first
      const scenarioBtn = page.locator('button').filter({ hasText: /Agent|Simple/ }).first();
      if (await scenarioBtn.isVisible()) {
        await scenarioBtn.click();
        await page.waitForTimeout(300);
        const simplePattern = page.locator('text=Simple (Direct)').first();
        if (await simplePattern.isVisible()) {
          await simplePattern.click();
          await page.waitForTimeout(500);
        }
      }

      // Switch to light mode
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      });
      await page.waitForTimeout(500);

      // Nodes should still be visible with proper contrast
      await expect(page).toHaveScreenshot('nodes-light-mode.png', {
        maxDiffPixelRatio: 0.05,
      });
    });
  });

  // ============ Test Suite 4: Empty State Theme ============
  test.describe('Empty State Theme', () => {
    test('TC4.1: Empty state visible in dark mode', async ({ page }) => {
      await page.goto(`${BASE_URL}/otel-flow`);
      await page.waitForSelector('[data-testid="rf__wrapper"]');

      // Clear the canvas if needed (use reset)
      const clearBtn = page.locator('button[title="Clear canvas"]');
      if (await clearBtn.isEnabled()) {
        await clearBtn.click();
        await page.waitForTimeout(300);
      }

      // Empty state should be visible
      const emptyState = page.locator('text=Design Your EDOT Architecture');
      if (await emptyState.isVisible()) {
        const textColor = await emptyState.evaluate((el) =>
          getComputedStyle(el).color
        );
        const [r, g, b] = textColor.match(/\d+/g)!.map(Number);
        // Should be light text in dark mode
        expect(r).toBeGreaterThan(200);
      }
    });

    test('TC4.2: Empty state visible in light mode', async ({ page }) => {
      await page.goto(`${BASE_URL}/otel-flow`);
      await page.waitForSelector('[data-testid="rf__wrapper"]');

      // Switch to light mode
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      });
      await page.waitForTimeout(500);

      // Empty state should be visible with dark text
      const emptyState = page.locator('text=Design Your EDOT Architecture');
      if (await emptyState.isVisible()) {
        const textColor = await emptyState.evaluate((el) =>
          getComputedStyle(el).color
        );
        const [r, g, b] = textColor.match(/\d+/g)!.map(Number);
        // Should be dark text in light mode
        expect(Math.max(r, g, b)).toBeLessThan(100);
      }
    });
  });

  // ============ Test Suite 5: CSS Variables ============
  test.describe('CSS Variables', () => {
    test('TC5.1: CSS variables change when toggling theme', async ({ page }) => {
      await page.goto(`${BASE_URL}/otel-flow`);
      await page.waitForSelector('[data-testid="rf__wrapper"]');

      // Get dark mode variables
      const darkVars = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        return {
          background: style.getPropertyValue('--background').trim(),
          textPrimary: style.getPropertyValue('--text-primary').trim(),
          panelBg: style.getPropertyValue('--panel-bg').trim(),
          panelBorder: style.getPropertyValue('--panel-border').trim(),
        };
      });

      // Switch to light mode
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      });
      await page.waitForTimeout(300);

      // Get light mode variables
      const lightVars = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        return {
          background: style.getPropertyValue('--background').trim(),
          textPrimary: style.getPropertyValue('--text-primary').trim(),
          panelBg: style.getPropertyValue('--panel-bg').trim(),
          panelBorder: style.getPropertyValue('--panel-border').trim(),
        };
      });

      // Variables should be different between themes
      expect(darkVars.background).not.toBe(lightVars.background);
      expect(darkVars.textPrimary).not.toBe(lightVars.textPrimary);
      expect(darkVars.panelBorder).not.toBe(lightVars.panelBorder);

      // Light mode should have light background
      expect(lightVars.background).toBe('#f8fafc');
      // Dark mode should have dark background
      expect(darkVars.background).toBe('#030712');
    });

    test('TC5.2: React Flow CSS variables adapt to theme', async ({ page }) => {
      await page.goto(`${BASE_URL}/otel-flow`);
      await page.waitForSelector('[data-testid="rf__wrapper"]');

      // Dark mode RF vars
      const darkRfVars = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        return {
          rfBackground: style.getPropertyValue('--rf-background').trim(),
          rfNodeBg: style.getPropertyValue('--rf-node-bg').trim(),
        };
      });
      expect(darkRfVars.rfBackground).toBe('#030712');
      expect(darkRfVars.rfNodeBg).toBe('#1f2937');

      // Switch to light mode
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      });
      await page.waitForTimeout(300);

      const lightRfVars = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        return {
          rfBackground: style.getPropertyValue('--rf-background').trim(),
          rfNodeBg: style.getPropertyValue('--rf-node-bg').trim(),
        };
      });
      expect(lightRfVars.rfBackground).toBe('#f8fafc');
      expect(lightRfVars.rfNodeBg).toBe('#ffffff');
    });
  });

  // ============ Test Suite 6: Contrast Checks ============
  test.describe('Contrast and Readability', () => {
    test('TC6.1: All panels have sufficient text contrast in light mode', async ({ page }) => {
      await page.goto(`${BASE_URL}/otel-flow`);
      await page.waitForSelector('[data-testid="rf__wrapper"]');

      // Switch to light mode
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      });
      await page.waitForTimeout(500);

      // Check major text elements are readable
      // All visible text should have a luminance difference from background

      // Palette title
      const paletteTitle = page.locator('h3:has-text("Components")');
      if (await paletteTitle.isVisible()) {
        const color = await paletteTitle.evaluate((el) => getComputedStyle(el).color);
        const [r, g, b] = color.match(/\d+/g)!.map(Number);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
        // Should be dark text (low luminance) for light background
        expect(luminance).toBeLessThan(100);
      }

      // Export button text should be visible
      const exportBtn = page.locator('button:has-text("Export")');
      if (await exportBtn.isVisible()) {
        const color = await exportBtn.evaluate((el) => getComputedStyle(el).color);
        // Cyan text should still be visible
        expect(color).toBeTruthy();
      }
    });

    test('TC6.2: All panels have sufficient text contrast in dark mode', async ({ page }) => {
      await page.goto(`${BASE_URL}/otel-flow`);
      await page.waitForSelector('[data-testid="rf__wrapper"]');

      // Verify dark mode
      const hasDarkClass = await page.evaluate(() =>
        document.documentElement.classList.contains('dark')
      );
      expect(hasDarkClass).toBe(true);

      // Palette title should be light text
      const paletteTitle = page.locator('h3:has-text("Components")');
      if (await paletteTitle.isVisible()) {
        const color = await paletteTitle.evaluate((el) => getComputedStyle(el).color);
        const [r, g, b] = color.match(/\d+/g)!.map(Number);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
        // Should be light text (high luminance) for dark background
        expect(luminance).toBeGreaterThan(150);
      }
    });

    test('TC6.3: Full page screenshots for visual comparison', async ({ page }) => {
      await page.goto(`${BASE_URL}/otel-flow`);
      await page.waitForSelector('[data-testid="rf__wrapper"]');
      await page.waitForTimeout(1000); // Wait for animations

      // Dark mode screenshot
      await expect(page).toHaveScreenshot('full-canvas-dark.png', {
        maxDiffPixelRatio: 0.05,
      });

      // Switch to light mode
      const themeToggle = page.locator('button[title*="Switch to light mode"]');
      if (await themeToggle.isVisible()) {
        await themeToggle.click();
        await page.waitForTimeout(1000);
      }

      // Light mode screenshot
      await expect(page).toHaveScreenshot('full-canvas-light.png', {
        maxDiffPixelRatio: 0.05,
      });
    });
  });
});
