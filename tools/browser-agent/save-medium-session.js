#!/usr/bin/env node
/**
 * PropertyDNA — Medium Session Saver (run once)
 *
 * Opens a real browser. Log into Medium normally (Google sign-in works).
 * Script auto-saves your session after 90 seconds.
 *
 * Run: node tools/browser-agent/save-medium-session.js
 */

const { chromium } = require('playwright');
const fs           = require('fs');
const path         = require('path');

const SESSION_FILE = path.join(__dirname, '.medium-session.json');

(async () => {
  console.log('\nOpening Medium — log in, then wait for auto-save.\n');

  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: null,
  });

  const page = await context.newPage();
  await page.goto('https://medium.com/m/signin', { waitUntil: 'domcontentloaded' });

  console.log('Log into Medium now. Session saves automatically in 90 seconds.');
  console.log('Make sure you can see your profile avatar before time runs out.\n');

  for (let i = 90; i > 0; i -= 10) {
    await new Promise(r => setTimeout(r, 10000));
    console.log(`  ${i - 10}s remaining...`);
  }

  await context.storageState({ path: SESSION_FILE });
  console.log(`\nSession saved to ${SESSION_FILE}`);
  await browser.close();
  process.exit(0);
})();
