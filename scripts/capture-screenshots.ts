/**
 * One-off script to capture screenshots of home and otel-flow pages.
 * Run: npx playwright test scripts/capture-screenshots.ts --config=playwright.config.ts
 * Or: npx ts-node --project tsconfig.json -r tsconfig-paths/register scripts/capture-screenshots.ts
 *
 * Simpler: npx playwright install chromium && node -e "
 * const { chromium } = require('playwright');
 * (async () => {
 *   const browser = await chromium.launch();
 *   const page = await browser.newPage();
 *   await page.goto('http://localhost:3000/');
 *   await page.screenshot({ path: 'screenshot-home.png', fullPage: true });
 *   await page.goto('http://localhost:3000/otel-flow');
 *   await page.screenshot({ path: 'screenshot-otel-flow.png', fullPage: true });
 *   await browser.close();
 * })();
 * "
 */

import { chromium } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  try {
    console.log(`Navigating to ${BASE_URL}/...`);
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.screenshot({ path: 'screenshot-home.png', fullPage: true });
    console.log('Saved screenshot-home.png');

    console.log(`Navigating to ${BASE_URL}/otel-flow...`);
    await page.goto(`${BASE_URL}/otel-flow`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.screenshot({ path: 'screenshot-otel-flow.png', fullPage: true });
    console.log('Saved screenshot-otel-flow.png');

    // Check for broken images (common EUI icon issue)
    const brokenImages = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.filter((img) => img.naturalWidth === 0 || img.naturalHeight === 0).length;
    });
    const svgIcons = await page.evaluate(() => document.querySelectorAll('svg').length);
    console.log(`\nIcon/Image check: ${brokenImages} broken img elements, ${svgIcons} SVG elements`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
