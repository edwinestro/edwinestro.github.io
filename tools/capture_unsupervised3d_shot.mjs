import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:8765/Projects/games/unsupervised-3d/';
const OUT_PATH = 'Projects/hubs/science-lab/assets/unsupervised-3d-1600x900.png';

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(URL, { waitUntil: 'load', timeout: 20000 });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__unsupervised3dCapture?.photoMode();
    const style = document.createElement('style');
    style.textContent = '.home-link-wrap,.controls-legend,.mission,.pickup-radar{display:none !important;}';
    document.head.append(style);
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT_PATH, fullPage: false });
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});