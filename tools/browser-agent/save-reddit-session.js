#!/usr/bin/env node
/**
 * PropertyDNA — Reddit Session Saver (run once manually)
 *
 * Opens a real visible browser. You log in to Reddit normally.
 * When you're done logging in, press Enter in the terminal.
 * Script saves your session cookies for future automated runs.
 *
 * Run: node tools/browser-agent/save-reddit-session.js
 */

const { chromium } = require('playwright');
const fs           = require('fs');
const path         = require('path');

const SESSION_FILE = path.join(__dirname, '.reddit-session.json');

(async () => {
  console.log('\nOpening browser — log in to Reddit, then come back here and press Enter.\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: null,
  });

  const page = await context.newPage();
  await page.goto('https://www.reddit.com/login/', { waitUntil: 'domcontentloaded' });

  console.log('Browser is open. Log in to Reddit now.');
  console.log('When you see your Reddit homepage (logged in), press Enter here to save the session.\n');

  // Wait 90 seconds — make sure you can see your username/avatar before time's up
  console.log('Waiting 90 seconds — log in and confirm you can see your username in the top-right before time runs out.');
  for (let i = 90; i > 0; i -= 10) {
    await new Promise(r => setTimeout(r, 10000));
    console.log(`  ${i - 10}s remaining...`);
  }

  await context.storageState({ path: SESSION_FILE });
  console.log(`\nSession saved to ${SESSION_FILE}`);
  console.log('Future runs will use this session — no login needed.\n');

  await browser.close();
  process.exit(0);
})();
