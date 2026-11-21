// One place that starts headless Chrome for every script (render, review sheet, tests).
// Order: CHROME_PATH (explicit binary) -> installed Google Chrome (Windows/macOS dev machines)
// -> Playwright's bundled Chromium (Linux / Claude Code cloud: `npx playwright@1.49.1 install --with-deps chromium`).
import { chromium } from 'playwright-core';

export async function launchBrowser(opts = {}) {
  const base = { headless: true, ...opts };
  if (process.env.CHROME_PATH) return chromium.launch({ ...base, executablePath: process.env.CHROME_PATH });
  try {
    return await chromium.launch({ ...base, channel: 'chrome' });
  } catch (e) {
    try {
      return await chromium.launch(base);
    } catch (e2) {
      throw new Error(`No browser found. Install Google Chrome, or run "npx playwright@1.49.1 install --with-deps chromium", or set CHROME_PATH.\n${e2.message}`);
    }
  }
}
