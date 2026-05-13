// Extract Medium integration token using saved session
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const SESSION = '/Users/danstuart/propertydna-landing/tools/browser-agent/.medium-session.json';
const CREDS   = '/Users/danstuart/propertydna-landing/tools/browser-agent/.daily-creds.json';

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    storageState: SESSION,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 900 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  const page = await context.newPage();

  console.log('Navigating to Medium settings...');
  await page.goto('https://medium.com/me/settings/security', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Take screenshot for debugging
  await page.screenshot({ path: '/tmp/medium-settings.png', fullPage: true });
  console.log('Current URL:', page.url());

  // Look for integration tokens section
  const html = await page.content();
  const tokenMatches = html.match(/[a-f0-9]{40,72}/g) || [];
  console.log('Possible tokens found in page:', tokenMatches.length);

  // Try to find the "Integration tokens" section and extract or create one
  // Medium's UI varies; try several selectors
  const allText = await page.locator('body').innerText().catch(() => '');
  const hasTokenSection = allText.toLowerCase().includes('integration token');
  console.log('Has integration token section:', hasTokenSection);

  if (tokenMatches.length > 0) {
    // Filter out obvious non-tokens (CSS hashes, etc.)
    const candidates = tokenMatches.filter(t => /^[a-f0-9]{40,72}$/.test(t) && t.length >= 40 && t.length <= 72);
    console.log('Token candidates:', candidates.slice(0, 5));
  }

  // Try to also fetch user info via the embedded session — call Medium's API directly with cookies
  const cookies = await context.cookies();
  const cookieStr = cookies.filter(c => c.domain.includes('medium')).map(c => `${c.name}=${c.value}`).join('; ');

  console.log('Saved screenshot to /tmp/medium-settings.png');
  console.log('Page text preview:', allText.slice(0, 500));

  await browser.close();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
