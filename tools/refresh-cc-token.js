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
  `&scope=contact_data+campaign_data+offline_access` +
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

  // Accept code as argument: node refresh-cc-token.js CODE
  let code = process.argv[2];

  if (code) {
    // Strip full URL if pasted instead of just the code
    try {
      const u = new URL(code);
      code = u.searchParams.get('code') || code;
    } catch { /* it's just the code string */ }
    console.log(`Using code from argument: ${code.slice(0, 10)}...\n`);
  } else {
    console.log('Opening Constant Contact authorization page...\n');
    console.log('AUTH URL (if browser does not open, paste this manually):\n');
    console.log(AUTH_URL + '\n');
    exec(`open "${AUTH_URL}"`);
    console.log('After approving, copy the FULL redirect URL from the browser address bar.\n');
    console.log('Then run:\n');
    console.log('  node tools/refresh-cc-token.js YOUR_CODE_HERE\n');
    console.log('Or paste the full redirect URL as the argument.\n');
    process.exit(0);
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
    console.log('CC_ACCESS_TOKEN updated in Netlify.');
  } catch (err) {
    console.warn('Netlify CLI set failed:', err.message);
    console.log(`\nSet manually: netlify env:set CC_ACCESS_TOKEN "${tokens.access_token}" --site ${NETLIFY_SITE} --force\n`);
  }

  if (tokens.refresh_token) {
    try {
      await new Promise((resolve, reject) => {
        exec(`netlify env:set CC_REFRESH_TOKEN "${tokens.refresh_token}" --site ${NETLIFY_SITE} --force`,
          (err, stdout, stderr) => err ? reject(new Error(stderr || err.message)) : resolve());
      });
      console.log('CC_REFRESH_TOKEN saved to Netlify (auto-refresh now enabled).');
    } catch (err) {
      console.warn('Could not save refresh token:', err.message);
      console.log(`\nSet manually: netlify env:set CC_REFRESH_TOKEN "${tokens.refresh_token}" --site ${NETLIFY_SITE} --force\n`);
    }
  } else {
    console.log('\nNOTE: No refresh_token returned. Re-run to try again with offline_access scope.');
  }

  console.log('\nDone. Newsletter will use the new token on Thursday.\n');
  if (tokens.expires_in) {
    const exp = new Date(Date.now() + tokens.expires_in * 1000);
    console.log(`Access token expires: ${exp.toLocaleString()}`);
  }
}

main().catch(err => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
