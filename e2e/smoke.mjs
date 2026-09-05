import { chromium } from 'playwright';

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
page.on('response', async (r) => {
  if (r.url().includes('/api/') && r.status() >= 400) {
    errors.push(`${r.request().method()} ${r.url()} → ${r.status()} ${(await r.text()).slice(0, 200)}`);
  }
});

// Start from an empty account so the run is repeatable.
const token = await fetch('http://localhost:8080/realms/moss/protocol/openid-connect/token', {
  method: 'POST',
  body: new URLSearchParams({
    grant_type: 'password', client_id: 'moss-frontend', username: 'demo', password: 'demo',
  }),
}).then((r) => r.json()).then((r) => r.access_token);
const auth = { headers: { Authorization: `Bearer ${token}` } };
for (const kind of ['tasks', 'lists']) {
  for (const row of await fetch(`http://localhost:8000/api/${kind}`, auth).then((r) => r.json())) {
    await fetch(`http://localhost:8000/api/${kind}/${row.id}`, { method: 'DELETE', ...auth });
  }
}

await page.goto('http://localhost:4200/', { waitUntil: 'networkidle' });
console.log('unauthenticated →', new URL(page.url()).origin + new URL(page.url()).pathname);

await page.fill('#username', 'demo');
await page.fill('#password', 'demo');
await page.click('#kc-login');
await page.waitForSelector('.wordmark', { timeout: 20000 });
console.log('after login →', page.url());

const rows = page.locator('.row');
const block = (label) => page.locator('.drawer .block').filter({ hasText: label });

await page.fill('.new-list input', 'Personal');
await page.press('.new-list input', 'Enter');
await page.waitForSelector('.nav-row');
await page.click('.nav-row .nav');

await page.fill('.new-group input', 'Errands');
await page.press('.new-group input', 'Enter');
await page.waitForFunction(() => document.querySelectorAll('.section').length >= 2);

for (const t of ['Pick up seed order', 'Return library books', 'Water the ferns']) {
  await page.fill('.quick input', t);
  await page.press('.quick input', 'Enter');
  await page.locator('.row .title', { hasText: t }).first().waitFor();
}

await rows.nth(1).locator('.check').click();          // complete "Return library books"
await rows.first().locator('.row-body').click();      // open "Pick up seed order"
await page.waitForSelector('.drawer');

await block('Priority').locator('.chip', { hasText: 'High' }).click();
await block('Color').locator('.preset').nth(2).click();
await page.fill('.drawer .notes', 'Compare tinted rows against the sidebar green.');
await page.dispatchEvent('.drawer .notes', 'change');
await page.fill('.drawer .sub-add', 'Export swatches');
await page.press('.drawer .sub-add', 'Enter');
await page.waitForSelector('.subtask');
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
await page.fill('.drawer input[type=date]', tomorrow);
await page.waitForTimeout(300);
await page.click('.drawer .head .x');

// Give a later-created task an earlier due date, so ordering cannot be mistaken
// for creation order, and put a clock time on it.
const today = new Date().toISOString().slice(0, 10);
await page.locator('.row', { hasText: 'Water the ferns' }).locator('.row-body').click();
await page.waitForSelector('.drawer');
await page.fill('.drawer input[type=date]', today);
await page.waitForTimeout(300);
await page.fill('.drawer input[type=time]', '09:30');
await page.waitForTimeout(400);
await page.screenshot({ path: 'shot-list.png' });

// Reload — everything must come back from Postgres, not from memory.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.row');
const order = await page.$$eval('.row .title', (e) => e.map((x) => x.textContent.trim()));
console.log('after reload — rows:', order);
const expected = ['Water the ferns', 'Pick up seed order', 'Return library books'];
if (JSON.stringify(order) !== JSON.stringify(expected)) {
  errors.push(`order was ${JSON.stringify(order)}, expected ${JSON.stringify(expected)}`);
}
console.log('  done rows:', await page.locator('.title.done').count(),
            '| high badges:', await page.locator('.prio.high').count(),
            '| subtask counts:', await page.$$eval('.row .num', (e) => e.map((x) => x.textContent.trim())),
            '| due labels:', await page.$$eval('.due', (e) => e.map((x) => x.textContent.trim())));

// A task due at a set time still belongs to the day bucket, not a later one.
await page.click('.tabs button:nth-child(3)');
await page.waitForSelector('.section');
const todayBucket = await page.locator('.section').filter({ hasText: 'Today' }).locator('.row .title').allTextContents();
console.log('Today bucket:', todayBucket.map((x) => x.trim()));
await page.click('.tabs button:nth-child(1)');

// The drawer's selects must reflect the task, not fall back to their first option.
await page.locator('.row').first().locator('.row-body').click();
await page.waitForSelector('.drawer');
console.log('drawer selects — list:', await page.locator('.drawer select').nth(0).inputValue() ? 'set' : 'EMPTY',
            '| group:', JSON.stringify(await page.locator('.drawer select').nth(1).inputValue()),
            '| status:', await page.locator('.drawer select').nth(2).inputValue(),
            '| shown list name:', await page.locator('.drawer select').first().locator('option:checked').textContent());
await page.click('.drawer .head .x');

await page.click('.tabs button:nth-child(2)');
await page.waitForSelector('.column');
console.log('board columns:', await page.$$eval('.column-head', (e) => e.map((x) => x.textContent.trim().replace(/\s+/g, ' '))));
await page.screenshot({ path: 'shot-board.png' });

await page.click('.tabs button:nth-child(3)');
await page.waitForSelector('.section');
console.log('date buckets:', await page.$$eval('.section-head', (e) => e.map((x) => x.textContent.trim().replace(/\s+/g, ' '))));
await page.screenshot({ path: 'shot-dates.png' });

await page.click('.tabs button:nth-child(1)');
await page.locator('.row').first().locator('.row-body').click();
await page.waitForSelector('.drawer');
await page.locator('.drawer .scroll').evaluate((el) => (el.scrollTop = 0));
await page.waitForTimeout(600);
await page.screenshot({ path: 'shot-drawer.png' });

console.log('errors:', errors.length ? errors : 'none');
await browser.close();
if (errors.length) process.exit(1);
