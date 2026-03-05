/**
 * Captures screenshots of home and otel-flow pages for visual inspection.
 * Run: npx playwright test tests/capture-screenshots.spec.ts
 *
 * Uses BASE_URL (default http://localhost:3000) - ensure dev server is running first.
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Screenshot capture for icon/UI verification', () => {
  test('home page loads and EUI icons render', async ({ page }) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 15000 });

    // Check for broken images (broken icons often show as 0x0 img)
    const brokenImgCount = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.filter((img) => img.naturalWidth === 0 || img.naturalHeight === 0).length;
    });

    // EUI uses SVG icons, not img tags - so we check SVG presence
    const svgCount = await page.locator('svg').count();
    expect(svgCount).toBeGreaterThan(0);

    // Screenshot for manual inspection
    await page.screenshot({
      path: 'test-results/screenshot-home.png',
      fullPage: true,
    });

    console.log(`Home: ${svgCount} SVGs, ${brokenImgCount} broken images`);
  });

  test('otel-flow page loads and EUI icons render', async ({ page }) => {
    await page.goto(`${BASE_URL}/otel-flow`, { waitUntil: 'networkidle', timeout: 15000 });

    const brokenImgCount = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.filter((img) => img.naturalWidth === 0 || img.naturalHeight === 0).length;
    });

    const svgCount = await page.locator('svg').count();
    expect(svgCount).toBeGreaterThan(0);

    await page.screenshot({
      path: 'test-results/screenshot-otel-flow.png',
      fullPage: true,
    });

    console.log(`Otel-flow: ${svgCount} SVGs, ${brokenImgCount} broken images`);
  });
});
