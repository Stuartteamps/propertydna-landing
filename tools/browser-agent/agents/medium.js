#!/usr/bin/env node
/**
 * PropertyDNA — Medium Cross-Posting Agent
 *
 * Strategy 1 (preferred): Medium v1 API with integration token — no browser, bypasses Cloudflare.
 * Strategy 2 (fallback):  Playwright with full stealth + Cloudflare wait.
 *
 * One-time setup:
 *   API token:  medium.com/me/settings → Security and apps → Integration tokens → Generate
 *               Paste into .daily-creds.json: { "medium": { "token": "...", "userId": "..." } }
 *               Get userId: curl -H "Authorization: Bearer TOKEN" https://api.medium.com/v1/me
 *
 *   Browser fallback: node tools/browser-agent/save-medium-session.js
 *
 * Manual run: node tools/browser-agent/agents/medium.js
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const QUEUE_FILE     = path.join(__dirname, '../data/post-queue.json');
const CREDS_FILE     = path.join(__dirname, '../.daily-creds.json');
const SESSION_FILE   = path.join(__dirname, '../.medium-session.json');
const CALENDAR_FILE  = path.join(__dirname, '../data/content-calendar.json');
const SCREENSHOT_DIR = path.join(__dirname, '../debug-screenshots');

function log(msg) { console.log(`[Medium] ${msg}`); }

function apiPost(path_, headers, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: 'api.medium.com',
      path: path_,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Accept': 'application/json',
        'User-Agent': 'PropertyDNA Content Bot 1.0 (+https://thepropertydna.com/bot)',
        ...headers,
      },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: { _raw: d } }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function apiGet(path_, token) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.medium.com',
      path: path_,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'User-Agent': 'PropertyDNA Content Bot 1.0 (+https://thepropertydna.com/bot)',
      },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: {} }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function postViaAPI(token, userId, pending) {
  log(`API: publishing "${pending.title.slice(0, 60)}..."`);

  // Fetch article content from the canonical URL
  const articleUrl = pending.canonicalUrl;
  const content = `<p>This article was originally published at <a href="${articleUrl}">${articleUrl}</a></p>
<p>Read the full article: <strong><a href="${articleUrl}">${pending.title}</a></strong></p>`;

  const result = await apiPost(`/v1/users/${userId}/posts`,
    { 'Authorization': `Bearer ${token}` },
    {
      title: pending.title,
      contentFormat: 'html',
      content,
      canonicalUrl: articleUrl,
      tags: pending.tags || ['real estate', 'proptech', 'AI', 'property data'],
      publishStatus: 'public',
    }
  );

  if (result.status === 201 && result.data?.data?.url) {
    log(`✓ Published: ${result.data.data.url}`);
    return { ok: true, url: result.data.data.url };
  }
  log(`API error ${result.status}: ${JSON.stringify(result.data).slice(0, 200)}`);
  return { ok: false, error: result.data };
}

async function postViaBrowser(pending) {
  log('Browser fallback: launching stealth Chromium...');

  let chromium;
  try {
    const { chromium: cx } = require('playwright-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    cx.use(StealthPlugin());
    chromium = cx;
  } catch {
    log('playwright-extra not available');
    return { ok: false, error: 'no_playwright' };
  }

  if (!fs.existsSync(SESSION_FILE)) {
    log('No session. Run: node tools/browser-agent/save-medium-session.js');
    return { ok: false, error: 'no_session' };
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-dev-shm-usage',
    ],
  });

  const context = await browser.newContext({
    storageState: SESSION_FILE,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: {
      'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
    },
  });

  // Mask automation flags
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    window.chrome = { runtime: {} };
  });

  const page = await context.newPage();
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  try {
    log('Navigating to Medium import...');
    await page.goto('https://medium.com/p/import', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Handle Cloudflare challenge if present
    if (page.url().includes('challenges.cloudflare.com') || await page.$('div.cf-browser-verification')) {
      log('Cloudflare challenge detected — waiting up to 20s for it to resolve...');
      await page.waitForNavigation({ timeout: 20000, waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    if (page.url().includes('/signin') || page.url().includes('/m/signin')) {
      log('Session expired. Re-run: node tools/browser-agent/save-medium-session.js');
      await browser.close();
      return { ok: false, error: 'session_expired' };
    }

    // Import via URL field
    const urlInput = await page.waitForSelector('input[placeholder*="URL"], input[type="url"], input[name*="url"]', { timeout: 10000 }).catch(() => null);
    if (!urlInput) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'medium-import-fail.png') });
      await browser.close();
      return { ok: false, error: 'import_input_not_found' };
    }

    await page.mouse.move(Math.random() * 400 + 100, Math.random() * 300 + 100);
    await page.waitForTimeout(500 + Math.random() * 500);
    await urlInput.click();
    await page.keyboard.type(pending.canonicalUrl, { delay: 30 + Math.random() * 40 });
    await page.waitForTimeout(800);

    const importBtn = await page.$('button[type="submit"], button:has-text("Import"), button:has-text("Continue")');
    if (importBtn) {
      await importBtn.click();
      await page.waitForTimeout(5000);
    }

    const url = page.url();
    log(`✓ Imported. Current URL: ${url}`);
    await browser.close();
    return { ok: true, url };

  } catch (e) {
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `medium-error-${Date.now()}.png`) }).catch(() => {});
    await browser.close();
    return { ok: false, error: e.message };
  }
}

async function run() {
  const calendar = JSON.parse(fs.readFileSync(CALENDAR_FILE, 'utf8'));
  const queue    = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  const today    = new Date().toISOString().slice(0, 10);

  const mediumDates = new Set(calendar.posts.filter(p => p.medium).map(p => p.date));
  const isPublishDay = mediumDates.has(today);

  if (!isPublishDay) {
    const nextDate = [...mediumDates].sort().find(d => d > today);
    log(`Not a Medium publish day. Next: ${nextDate || 'none scheduled'}`);
    return { status: 'nothing_to_post' };
  }

  const pending = queue.medium.find(p => !p.posted);
  if (!pending) {
    log('All Medium articles already published.');
    return { status: 'nothing_to_post' };
  }

  // Strategy 1: Official API
  const creds = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8')).medium || {};
  let result;

  if (creds.token && creds.userId) {
    result = await postViaAPI(creds.token, creds.userId, pending);
  } else {
    log('No Medium API token/userId in .daily-creds.json — trying browser fallback.');
    log('To set up API (recommended): medium.com/me/settings → Security → Integration tokens');
    result = await postViaBrowser(pending);
  }

  if (result.ok) {
    pending.posted = true;
    pending.postedAt = new Date().toISOString();
    pending.url = result.url;
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
    log(`Queue updated. ${queue.medium.filter(p => !p.posted).length} articles remaining.`);
    return { status: 'posted', url: result.url };
  }

  log(`Failed: ${JSON.stringify(result.error).slice(0, 200)}`);
  return { status: 'error', error: result.error };
}

module.exports = { run };
if (require.main === module) run().then(r => console.log('\nResult:', JSON.stringify(r, null, 2)));
