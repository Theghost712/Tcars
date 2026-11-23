// End-to-end smoke test: run with the dev servers up (see README).
//   node e2e/smoke.mjs            (uses http://127.0.0.1:5173 and the seeded demo data)
// Exits non-zero on the first failed check.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Playwright is installed globally in this environment; require() honours NODE_PATH.
const { chromium } = createRequire(import.meta.url)('playwright');

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'car.jpg');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';
const API = `${BASE}/api`;
const PASSWORD = 'DemoPass123!';
const stamp = Date.now();
const log = (msg) => console.log(`✓ ${msg}`);
const check = (cond, msg) => {
  if (!cond) throw new Error(`✗ ${msg}`);
  log(msg);
};

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()));

try {
  // 1. Public browsing
  await page.goto(`${BASE}/`);
  await page.getByText('Recently added').waitFor();
  check(true, 'home page shows recently added vehicles');

  await page.goto(`${BASE}/vehicles?region=Arusha`);
  await page.getByText(/vehicles? found/).waitFor();
  check(true, 'browse page filters by region from the URL');

  // 2. Seller signs in and publishes a listing with photos
  await page.goto(`${BASE}/login`);
  await page.fill('#login-email', 'seller@demo.tzcars.test');
  await page.fill('#login-password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.getByText(/Welcome, /).waitFor();
  check(true, 'seller signs in and reaches the dashboard');

  await page.goto(`${BASE}/sell`);
  const title = `E2E Honda Fit ${stamp}`;
  await page.fill('#l-title', title);
  await page.fill('#l-make', 'Honda');
  await page.fill('#l-model', 'Fit');
  await page.fill('#l-price', '12500000');
  await page.fill('#l-desc', 'Automated test listing: clean car, service records available.');
  await page.setInputFiles('input[type="file"]', { name: 'car.jpg', mimeType: 'image/jpeg', buffer: readFileSync(FIXTURE) });
  await page.click('button:has-text("Publish for review")');
  await page.getByText('Thanks! Your listing is with our team').waitFor();
  check(true, 'seller publishes a listing and sees it awaiting review');

  const listingId = Number(new URL(page.url()).pathname.split('/').pop());
  check(Number.isInteger(listingId), `new listing has id ${listingId}`);

  // 3. Admin approves the listing from the queue
  const admin = await api('auth/login/', { method: 'POST', body: { email: 'admin@demo.tzcars.test', password: PASSWORD } });
  check(admin.status === 200, 'administrator can sign in');
  const approve = await api(`admin/vehicles/${listingId}/approve/`, { method: 'POST', token: admin.data.access });
  check(approve.status === 200, 'administrator approves the listing');

  // 4. Buyer finds it, saves it and sends an enquiry
  await page.evaluate(() => localStorage.clear());
  const buyerEmail = `buyer.${stamp}@example.test`;
  await page.goto(`${BASE}/register`);
  await page.fill('#reg-name', 'E2E Buyer');
  await page.fill('#reg-email', buyerEmail);
  await page.fill('#reg-password', 'BuyerPass2026');
  await page.fill('#reg-confirm', 'BuyerPass2026');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/vehicles/);
  check(true, 'new buyer registers and is signed in');

  await page.goto(`${BASE}/vehicles/${listingId}`);
  await page.getByRole('heading', { name: title }).waitFor();
  check(true, 'approved listing is visible to buyers');
  await page.click('button[aria-label="Save to favourites"]');
  await page.waitForFunction(() => document.querySelector('button[aria-pressed="true"]') !== null);
  check(true, 'buyer saves the listing to favourites');

  await page.fill('#inq-message', 'Is the price negotiable? Is it still available?');
  await page.click('button:has-text("Send enquiry")');
  await page.getByText('Your message was sent').waitFor();
  check(true, 'buyer sends an enquiry');

  // 5. A signed-in buyer reports the listing through the API
  const report = await api(`vehicles/${listingId}/report/`, {
    method: 'POST',
    token: (await api('auth/login/', { method: 'POST', body: { email: buyerEmail, password: 'BuyerPass2026' } })).data.access,
    body: { reason: 'other', details: 'E2E check' },
  });
  check(report.status === 201, 'report is accepted once');

  // 6. Seller sees the enquiry in the dashboard
  const seller = await api('auth/login/', { method: 'POST', body: { email: 'seller@demo.tzcars.test', password: PASSWORD } });
  const inbox = await api('inquiries/received/', { token: seller.data.access });
  check(inbox.data.results.some((item) => item.vehicle === listingId), 'seller receives the enquiry');

  check(errors.length === 0, `no page errors (${errors.length} seen)`);
  console.log('\nAll smoke checks passed.');
} catch (error) {
  console.error(error.message);
  console.error('Page errors:', errors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
