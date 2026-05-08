#!/usr/bin/env node
/**
 * CC Token Refresh — run every Wednesday before Thursday newsletter
 * Usage: node tools/refresh-cc-token.js
 *
 * Steps:
 *   1. Opens CC auth page in your browser
 *   2. You approve + get redirected to localhost (will fail to load — that's fine)
 *   3. Paste the full redirect URL here
 *   4. Script exchanges code for token + sets CC_ACCESS_TOKEN in Netlify automatically
 */

const https    = require('https');
const { exec } = require('child_process');
const readline = require('readline');

const CLIENT_ID     = 'f626272f-4940-42e3-b0d6-d4ffc0366337';
const CLIENT_SECRET = 'UCMY_HNPbhCRENfCi_uK8g';
const REDIRECT_URI  = 'https://localhost';
const NETLIFY_SITE  = 'thepropertydna';

const AUTH_URL =
  `https://authz.constantcontact.com/oauth2/default/v1/authorize` +
  `?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=contact_data+campaign_data` +
  `&state=pdna2026`;

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

function exchangeCode(code) {
  return new Promise((resolve, reject) => {
    const creds  = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const body   = `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    const req = https.request({
      hostname: 'authz.constantcontact.com',
      path: '/oauth2/default/v1/token',
      method: 'POST',
      headers: {
        'Authorization':  `Basic ${creds}`,
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { reject(new Error(raw)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function setNetlifyToken(token) {
  return new Promise((resolve, reject) => {
    exec(
      `netlify env:set CC_ACCESS_TOKEN "${token}" --site ${NETLIFY_SITE} --force`,
      (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(stdout.trim());
      }
    );
  });
}

async function main() {
  console.log('\n=== CC Token Refresh ===\n');
  console.log('Opening Constant Contact authorization page...\n');
  console.log('AUTH URL (if browser does not open, paste this manually):\n');
  console.log(AUTH_URL + '\n');

  exec(`open "${AUTH_URL}"`);

  console.log('After approving, your browser will redirect to localhost (page will fail — that is expected).');
  console.log('Copy the FULL URL from the browser address bar and paste it below.\n');

  const redirectUrl = await ask('Paste redirect URL here: ');

  let code;
  try {
    const u = new URL(redirectUrl);
    code = u.searchParams.get('code');
  } catch {
    code = redirectUrl.match(/[?&]code=([^&]+)/)?.[1];
  }

  if (!code) {
    console.error('\nERROR: Could not find "code" in the URL you pasted.');
    console.error('Make sure you copied the full redirect URL from the address bar.\n');
    process.exit(1);
  }

  console.log('\nExchanging code for access token...');
  const tokens = await exchangeCode(code);

  if (!tokens.access_token) {
    console.error('\nERROR: Token exchange failed:', JSON.stringify(tokens));
    process.exit(1);
  }

  console.log('Token received. Setting in Netlify...');

  try {
    await setNetlifyToken(tokens.access_token);
    console.log('\nCC_ACCESS_TOKEN updated in Netlify successfully.');
  } catch (err) {
    console.warn('\nNetlify CLI set failed (is netlify CLI installed?):', err.message);
    console.log('\nSet it manually:\n');
    console.log(`netlify env:set CC_ACCESS_TOKEN "${tokens.access_token}" --site ${NETLIFY_SITE} --force\n`);
  }

  console.log('\nDone. Newsletter will use the new token on Thursday.\n');
  if (tokens.expires_in) {
    const exp = new Date(Date.now() + tokens.expires_in * 1000);
    console.log(`Token expires: ${exp.toLocaleString()} (${Math.round(tokens.expires_in / 3600)}h)\n`);
  }
}

main().catch(err => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
