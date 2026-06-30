#!/usr/bin/env node
'use strict';
/**
 * PropertyDNA report generator — CLI driver.
 *
 *   node tools/report-generator/generate.js <config.json> [--pdf] [--token <t>]
 *
 * Steps:
 *   1. Load the property config (see README.md for the data model).
 *   2. Mint a secure public token + 30-day expiry (unless provided in config/flags).
 *   3. Render the self-contained HTML and write it to
 *        app/frontend/public/listings/r-<token>.html
 *   4. (--pdf) Render a print-quality PDF next to it via headless Chrome.
 *   5. Print the shareable URLs (commit + push to publish — the agent does this).
 *
 * Dependency-free. Date is read from the system clock once, here, so render.js
 * stays pure and deterministic.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { renderReport } = require('./render');

const REPO = path.resolve(__dirname, '..', '..');
const LISTINGS = path.join(REPO, 'app', 'frontend', 'public', 'listings');
const SITE = 'https://www.thepropertydna.com';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i > -1 ? (process.argv[i + 1] || true) : null;
}

function main() {
  const cfgPath = process.argv[2];
  if (!cfgPath || cfgPath.startsWith('--')) {
    console.error('Usage: node generate.js <config.json> [--pdf] [--token <t>]');
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(path.resolve(cfgPath), 'utf8'));
  data.meta = data.meta || {};

  // token (lowercase alnum so Netlify's pretty-URL normalization is a no-op)
  const token = arg('--token') || data.meta.token ||
    crypto.randomBytes(12).toString('hex'); // 24 hex chars
  data.meta.token = token;

  // dates: stamp here so render.js stays pure
  const now = new Date();
  const exp = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  data.meta.issuedISO = data.meta.issuedISO || now.toISOString();
  data.meta.expiresISO = data.meta.expiresISO ||
    new Date(exp.toISOString().slice(0, 10) + 'T23:59:59-07:00').toISOString();

  const html = renderReport(data);
  if (!fs.existsSync(LISTINGS)) fs.mkdirSync(LISTINGS, { recursive: true });
  const htmlPath = path.join(LISTINGS, `r-${token}.html`);
  fs.writeFileSync(htmlPath, html);
  console.log('HTML  :', htmlPath);

  let pdfPath = null;
  if (arg('--pdf') != null) {
    pdfPath = path.join(LISTINGS, `r-${token}.pdf`);
    try {
      execFileSync(CHROME, [
        '--headless=new', '--disable-gpu', '--no-sandbox',
        '--no-pdf-header-footer', '--print-to-pdf-no-header',
        `--print-to-pdf=${pdfPath}`, `file://${htmlPath}`,
      ], { stdio: 'ignore' });
      console.log('PDF   :', pdfPath);
    } catch (e) {
      console.error('PDF render failed (is Chrome installed?):', e.message);
      pdfPath = null;
    }
  }

  console.log('\nShareable URLs (live after commit + push of the two files above):');
  console.log('  Report:', `${SITE}/listings/r-${token}.html`);
  if (pdfPath) console.log('  PDF   :', `${SITE}/listings/r-${token}.pdf`);
  console.log('\nEmail subject:', `PropertyDNA Buyer Intelligence Report – ${data.hero && data.hero.title || ''}`);
}

main();
