#!/usr/bin/env node
/**
 * Creates a GA4 property for thepropertydna.com via browser automation.
 * Logs into Google Analytics, creates property + web stream, prints Measurement ID.
 *
 * Run: node tools/browser-agent/create-ga4-property.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_FILE   = path.join(__dirname, '.google-session.json');
const SCREENSHOT_DIR = path.join(__dirname, 'debug-screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR);

function log(msg) { console.log(`[GA4] ${msg}`); }

async function saveSession(context) {
  await context.storageState({ path: SESSION_FILE });
}

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({
    storageState: fs.existsSync(SESSION_FILE) ? SESSION_FILE : undefined,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: null,
  });
  const page = await context.newPage();

  // Navigate to GA4
  log('Opening Google Analytics...');
  await page.goto('https://analytics.google.com/analytics/web/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Check if we need to log in
  if (page.url().includes('accounts.google.com') || page.url().includes('signin')) {
    log('Need to sign in — logging in with stuartteamps@gmail.com...');
    const emailField = page.locator('input[type="email"]').first();
    await emailField.waitFor({ timeout: 10000 });
    await emailField.fill('stuartteamps@gmail.com');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    const passField = page.locator('input[type="password"]').first();
    await passField.waitFor({ timeout: 10000 });
    await passField.fill('#1Slugger#1');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4000);
    await saveSession(context);
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'ga4-home.png') });
  log('On Analytics. Navigating to Admin...');

  // Click Admin (gear icon)
  const adminBtn = page.locator('a[href*="admin"], button[aria-label*="Admin"], [data-view="admin"]').first();
  if (await adminBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await adminBtn.click();
  } else {
    await page.goto('https://analytics.google.com/analytics/web/#/a/p/admin', { waitUntil: 'domcontentloaded' });
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'ga4-admin.png') });

  // Click Create Property
  log('Creating new property...');
  const createPropBtn = page.locator('button:has-text("Create property"), a:has-text("Create property")').first();
  await createPropBtn.waitFor({ timeout: 10000 });
  await createPropBtn.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'ga4-create.png') });

  // Fill property name
  const nameField = page.locator('input[placeholder*="property name" i], input[aria-label*="property name" i]').first();
  await nameField.waitFor({ timeout: 10000 });
  await nameField.fill('PropertyDNA');
  await page.waitForTimeout(500);

  // Set timezone to Los Angeles
  const tzDropdown = page.locator('[aria-label*="timezone" i], select[name*="timezone" i]').first();
  if (await tzDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
    await tzDropdown.click();
    const laOption = page.locator('[role="option"]:has-text("Los Angeles"), option:has-text("Los Angeles")').first();
    if (await laOption.isVisible({ timeout: 2000 }).catch(() => false)) await laOption.click();
  }

  // Set currency to USD
  const currencyDropdown = page.locator('[aria-label*="currency" i], select[name*="currency" i]').first();
  if (await currencyDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
    await currencyDropdown.click();
    const usdOption = page.locator('[role="option"]:has-text("US Dollar"), option:has-text("US Dollar")').first();
    if (await usdOption.isVisible({ timeout: 2000 }).catch(() => false)) await usdOption.click();
  }

  // Click Next
  const nextBtn = page.locator('button:has-text("Next")').first();
  await nextBtn.waitFor({ timeout: 5000 });
  await nextBtn.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'ga4-business.png') });

  // Business details — select Real Estate industry
  const industryDropdown = page.locator('[aria-label*="industry" i]').first();
  if (await industryDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
    await industryDropdown.click();
    const realEstateOption = page.locator('[role="option"]:has-text("Real estate")').first();
    if (await realEstateOption.isVisible({ timeout: 2000 }).catch(() => false)) await realEstateOption.click();
  }

  // Business size — Small
  const sizeOption = page.locator('[aria-label*="Small" i], label:has-text("Small")').first();
  if (await sizeOption.isVisible({ timeout: 2000 }).catch(() => false)) await sizeOption.click();

  // Next
  const nextBtn2 = page.locator('button:has-text("Next")').first();
  if (await nextBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
    await nextBtn2.click();
    await page.waitForTimeout(2000);
  }

  // Business objectives — select "Generate leads"
  const leadsOption = page.locator('label:has-text("Generate leads"), button:has-text("Generate leads")').first();
  if (await leadsOption.isVisible({ timeout: 2000 }).catch(() => false)) await leadsOption.click();

  // Create
  const createBtn = page.locator('button:has-text("Create")').first();
  await createBtn.waitFor({ timeout: 5000 });
  await createBtn.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'ga4-created.png') });

  // Accept terms if shown
  const acceptBtn = page.locator('button:has-text("Accept"), button:has-text("I Accept")').first();
  if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await acceptBtn.click();
    await page.waitForTimeout(2000);
  }

  // Choose Web platform
  log('Selecting Web platform...');
  const webOption = page.locator('button:has-text("Web"), div:has-text("Web"):not(:has(div))').first();
  await webOption.waitFor({ timeout: 10000 });
  await webOption.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'ga4-web.png') });

  // Fill stream URL
  const urlField = page.locator('input[placeholder*"url" i], input[aria-label*="URL" i], input[placeholder*="example.com" i]').first();
  await urlField.waitFor({ timeout: 10000 });
  await urlField.fill('thepropertydna.com');
  await page.waitForTimeout(300);

  const streamNameField = page.locator('input[placeholder*="stream name" i], input[aria-label*="stream name" i]').first();
  if (await streamNameField.isVisible({ timeout: 2000 }).catch(() => false)) {
    await streamNameField.fill('thepropertydna.com');
  }

  // Create stream
  const createStreamBtn = page.locator('button:has-text("Create stream"), button:has-text("Create and continue")').first();
  await createStreamBtn.waitFor({ timeout: 5000 });
  await createStreamBtn.click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'ga4-stream.png') });

  // Extract Measurement ID
  log('Extracting Measurement ID...');
  const measurementIdEl = page.locator('text=/G-[A-Z0-9]{8,10}/').first();
  const measurementId = await measurementIdEl.textContent({ timeout: 10000 }).catch(() => null);

  if (measurementId) {
    const id = measurementId.match(/G-[A-Z0-9]+/)?.[0];
    log(`\n✓ Measurement ID: ${id}`);
    fs.writeFileSync(path.join(__dirname, 'ga4-result.json'), JSON.stringify({ measurementId: id }, null, 2));
    console.log(`\nMeasurement ID: ${id}`);
    console.log('Saved to tools/browser-agent/ga4-result.json');
  } else {
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'ga4-final.png') });
    log('Could not extract ID automatically — check debug-screenshots/ga4-stream.png');
    log('Look for G-XXXXXXXXXX on that page and paste it here.');
  }

  await saveSession(context);
  await page.waitForTimeout(3000);
  await browser.close();
})();
