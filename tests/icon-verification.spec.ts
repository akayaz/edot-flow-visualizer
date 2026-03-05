/**
 * Verifies EUI icon rendering on home and otel-flow pages.
 * Run: npx playwright test tests/icon-verification.spec.ts
 */
import { test } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('EUI icon verification', () => {
  test('home page - capture and report icons', async ({ page }) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000); // Allow hydration

    await page.screenshot({
      path: 'test-results/icon-check-home.png',
      fullPage: true,
    });

    const iconReport = await page.evaluate(() => {
      const svgs = document.querySelectorAll('svg');
      const imgs = document.querySelectorAll('img');
      const brokenImgs = Array.from(imgs).filter((img) => img.naturalWidth === 0);
      // EUI icons render as SVG with aria-label or in icon containers
      const iconContainers = document.querySelectorAll('[class*="icon"], [data-icon-type]');
      return {
        svgCount: svgs.length,
        imgCount: imgs.length,
        brokenImgCount: brokenImgs.length,
        iconContainerCount: iconContainers.length,
        bodyText: document.body?.innerText?.slice(0, 500) || '',
      };
    });
    console.log('HOME:', JSON.stringify(iconReport, null, 2));
  });

  test('otel-flow page - capture and report icons', async ({ page }) => {
    await page.goto(`${BASE_URL}/otel-flow`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(3000); // Allow React hydration and lazy components

    await page.screenshot({
      path: 'test-results/icon-check-otel-flow.png',
      fullPage: true,
    });

    const iconReport = await page.evaluate(() => {
      const svgs = document.querySelectorAll('svg');
      const hasHeader = !!document.querySelector('header, [class*="euiHeader"]');
      const hasPalette = !!document.querySelector('[class*="ComponentPalette"], [class*="palette"]');
      const hasEmptyState = !!document.querySelector('[class*="EmptyState"], [class*="empty"]');
      const bodyText = document.body?.innerText?.slice(0, 800) || '';
      return {
        svgCount: svgs.length,
        hasHeader,
        hasPalette,
        hasEmptyState,
        bodyText,
      };
    });
    console.log('OTEL-FLOW:', JSON.stringify(iconReport, null, 2));
  });
});
