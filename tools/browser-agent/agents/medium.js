#!/usr/bin/env node
/**
 * PropertyDNA — Medium Cross-Posting Agent (Playwright)
 *
 * Uses Medium's import feature to cross-post blog articles.
 * Imports the canonical URL — no duplicate content penalty.
 *
 * Setup (one-time):
 *   node tools/browser-agent/save-medium-session.js
 *
 * Manual run: node tools/browser-agent/agents/medium.js
 */

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const fs   = require('fs');
const path = require('path');

const QUEUE_FILE   = path.join(__dirname, '../data/post-queue.json');
const SESSION_FILE = path.join(__dirname, '../.medium-session.json');
const SCREENSHOT_DIR = path.join(__dirname, '../debug-screenshots');

function log(msg) { console.log(`[Medium] ${msg}`); }

async function run() {
  if (!fs.existsSync(SESSION_FILE)) {
    log('No session found. Run: node tools/browser-agent/save-medium-session.js');
    return { status: 'error', error: 'no_session' };
  }

  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  const pending = queue.medium.find(p => !p.posted);
  if (!pending) {
    log('No pending Medium posts.');
    return { status: 'nothing_to_post' };
  }

  log(`Importing: "${pending.title.slice(0, 60)}..."`);
  log(`URL: ${pending.canonicalUrl}`);

  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });

  const context = await browser.newContext({
    storageState: SESSION_FILE,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  try {
    // Verify session
    log('Checking session...');
    await page.goto('https://medium.com/me/stories/public', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    if (page.url().includes('/signin') || page.url().includes('/m/signin')) {
      log('Session expired. Re-run: node tools/browser-agent/save-medium-session.js');
      await browser.close();
      return { status: 'error', error: 'session_expired' };
    }
    log('Session valid');

    // Navigate to import page
    log('Navigating to import page...');
    await page.goto('https://medium.com/p/import', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'medium-import.png') });

    // Find URL input and enter the blog post URL
    const urlInput = page.locator('input[type="url"], input[placeholder*="url" i], input[placeholder*="URL" i], input[name="url"]').first();
    await urlInput.waitFor({ timeout: 10000 });
    await urlInput.click();
    await page.keyboard.type(pending.canonicalUrl, { delay: 50 });
    await page.waitForTimeout(500);

    // Click import button
    const importBtn = page.locator('button:has-text("Import"), button:has-text("Submit")').first();
    await importBtn.waitFor({ timeout: 5000 });
    await importBtn.click();
    log('Import submitted, waiting for processing...');

    // Wait for import to complete — Medium redirects to editor
    await page.waitForURL(/medium\.com\/p\/.*\/edit|medium\.com\/@.*\//, { timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'medium-imported.png') });

    const editorUrl = page.url();
    log(`Imported to editor: ${editorUrl}`);

    // Publish the story
    log('Publishing...');
    const publishBtn = page.locator('button:has-text("Publish"), button:has-text("Continue to publish")').first();
    if (await publishBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await publishBtn.click();
      await page.waitForTimeout(2000);

      // Confirm publish if there's a second step
      const confirmBtn = page.locator('button:has-text("Publish now"), button:has-text("Publish story")').first();
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'medium-published.png') });
    const finalUrl = page.url();

    // Mark as posted
    pending.posted   = true;
    pending.postedAt = new Date().toISOString();
    pending.url      = finalUrl;
    queue.lastMediumPost = pending.postedAt;
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));

    log(`Published: ${finalUrl}`);
    await browser.close();
    return { status: 'posted', title: pending.title, url: finalUrl };

  } catch (e) {
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'medium-error.png') }).catch(() => {});
    await browser.close();
    log(`ERROR: ${e.message}`);
    return { status: 'error', error: e.message };
  }
}

module.exports = { run };
if (require.main === module) run().then(r => console.log('\nResult:', JSON.stringify(r, null, 2)));
