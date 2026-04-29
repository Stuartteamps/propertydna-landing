#!/usr/bin/env node
/**
 * Regenerate the Apple Sign In client secret JWT.
 * Run this before October 29, 2026 (current expiry).
 *
 * Usage:
 *   node scripts/renew-apple-jwt.js
 *
 * Then paste the output JWT into:
 *   Supabase → Auth → Providers → Apple → Secret Key
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TEAM_ID   = '8NR9GCA6GQ';
const KEY_ID    = 'FZPBZNQ668';
const CLIENT_ID = 'com.thepropertydna.auth';

// Looks for the .p8 file in Downloads or the same directory as this script
const KEY_PATHS = [
  path.join(process.env.HOME, 'Downloads', `AuthKey_${KEY_ID}.p8`),
  path.join(__dirname, `AuthKey_${KEY_ID}.p8`),
];

const keyPath = KEY_PATHS.find(p => fs.existsSync(p));
if (!keyPath) {
  console.error(`❌ Could not find AuthKey_${KEY_ID}.p8 in Downloads or scripts/`);
  process.exit(1);
}

const privateKey = fs.readFileSync(keyPath, 'utf8');
const b64url = d => Buffer.from(typeof d === 'string' ? d : JSON.stringify(d)).toString('base64url');
const now = Math.floor(Date.now() / 1000);

const header  = b64url({ alg: 'ES256', kid: KEY_ID });
const payload = b64url({ iss: TEAM_ID, iat: now, exp: now + 15777000, aud: 'https://appleid.apple.com', sub: CLIENT_ID });
const signingInput = `${header}.${payload}`;

const sign = crypto.createSign('SHA256');
sign.update(signingInput);
const sig = sign.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });

const jwt = `${signingInput}.${sig.toString('base64url')}`;
const expiry = new Date((now + 15777000) * 1000).toDateString();

console.log(`\n✅ Apple client secret JWT — expires ${expiry}\n`);
console.log(jwt);
console.log('\nPaste into: Supabase → Auth → Providers → Apple → Secret Key\n');
