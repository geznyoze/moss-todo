import { chromium, devices } from 'playwright';

const browser = await chromium.launch();
// Non-destructive: uses whatever is already in the account.
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:4200/', { waitUntil: 'networkidle' });
if (page.url().includes('8080')) {
  await page.fill('#username', 'demo');
  await page.fill('#password', 'demo');
  await page.click('#kc-login');
}
await page.waitForSelector('.wordmark');
await page.waitForTimeout(800);

const size = page.viewportSize();
console.log(`viewport ${size.width}x${size.height}`);
console.log('sidebar visible on load:', await page.locator('.sidebar').isVisible());
await page.screenshot({ path: 'mobile-list.png' });

await page.click('.topbar .ghost:has-text("Lists")');
await page.waitForTimeout(300);
console.log('sidebar after tapping Lists:', await page.locator('.sidebar').isVisible());
await page.screenshot({ path: 'mobile-sidebar.png' });
await page.click('.topbar .ghost:has-text("Lists")');
await page.waitForTimeout(300);

if (await page.locator('.row').count()) {
  await page.locator('.row').first().locator('.row-body').click();
  await page.waitForSelector('.drawer');
  await page.waitForTimeout(400);
  const box = await page.locator('.drawer').boundingBox();
  console.log('drawer width vs viewport:', Math.round(box.width), '/', size.width);
  await page.screenshot({ path: 'mobile-drawer.png' });
}

// Does anything overflow horizontally?
const overflow = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
}));
console.log('horizontal overflow:', overflow.scrollWidth > overflow.clientWidth
  ? `YES (${overflow.scrollWidth} > ${overflow.clientWidth})` : 'none');
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
if (overflow.scrollWidth > overflow.clientWidth || errors.length) process.exit(1);
