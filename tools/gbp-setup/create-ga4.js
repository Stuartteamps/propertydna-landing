#!/usr/bin/env node
/**
 * PropertyDNA — GA4 Property Creator
 *
 * Creates a GA4 property for thepropertydna.com and returns the Measurement ID.
 * Uses the existing Google Cloud OAuth credentials.
 *
 * Run: node tools/gbp-setup/create-ga4.js
 */

const https  = require('https');
const fs     = require('fs');
const path   = require('path');

const TOKENS_FILE = path.join(__dirname, 'ga4-tokens.json');
const CREDS_FILE  = path.join(__dirname, 'credentials.json');

function httpsReq(method, hostname, p, body, headers) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname, path: p, method,
      headers: { 'Content-Type': 'application/json', ...headers,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, data: d }); } });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function refreshToken(creds, refreshToken) {
  const res = await httpsReq('POST', 'oauth2.googleapis.com', '/token', null, {
    'Content-Type': 'application/x-www-form-urlencoded',
  });
  // Use form encoding
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      client_id: creds.installed.client_id,
      client_secret: creds.installed.client_secret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString();
    const req = https.request({
      hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getAuthUrl(creds) {
  const params = new URLSearchParams({
    client_id: creds.installed.client_id,
    redirect_uri: 'http://localhost:3000',
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/analytics.edit',
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeCode(creds, code) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      client_id: creds.installed.client_id,
      client_secret: creds.installed.client_secret,
      code,
      redirect_uri: 'http://localhost:3000',
      grant_type: 'authorization_code',
    }).toString();
    const req = https.request({
      hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function waitForCode() {
  return new Promise(resolve => {
    const http = require('http');
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost:3000');
      const code = url.searchParams.get('code');
      res.end('<h2>Authorization complete — you can close this tab.</h2>');
      server.close();
      resolve(code);
    });
    server.listen(3000);
  });
}

(async () => {
  if (!fs.existsSync(CREDS_FILE)) {
    console.error('credentials.json not found in tools/gbp-setup/');
    process.exit(1);
  }
  const creds = JSON.parse(fs.readFileSync(CREDS_FILE));

  let accessToken;

  // Try existing GA4 tokens first
  if (fs.existsSync(TOKENS_FILE)) {
    const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE));
    if (tokens.refresh_token) {
      console.log('Refreshing GA4 access token...');
      const refreshed = await refreshToken(creds, tokens.refresh_token);
      accessToken = refreshed.access_token;
      if (refreshed.refresh_token) {
        tokens.refresh_token = refreshed.refresh_token;
        fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
      }
    }
  }

  if (!accessToken) {
    // Need new auth
    const authUrl = await getAuthUrl(creds);
    console.log('\nOpening Google auth for Analytics...');
    require('child_process').exec(`open "${authUrl}"`);
    console.log('Waiting for authorization...');
    const code = await waitForCode();
    const tokens = await exchangeCode(creds, code);
    accessToken = tokens.access_token;
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
    console.log('Authorized.');
  }

  const authHeader = { 'Authorization': `Bearer ${accessToken}` };

  // Step 1: Get Google account (need account name for creating property)
  console.log('\nFetching Analytics accounts...');
  const acctRes = await httpsReq('GET', 'analyticsadmin.googleapis.com', '/v1beta/accounts', null, authHeader);
  const accounts = acctRes.data?.accounts;
  if (!accounts?.length) {
    console.log('No Analytics accounts found. Creating account...');
    // GA4 auto-creates an account when you create a property via the UI, but via API we need one
    console.log('Please create a Google Analytics account first at analytics.google.com, then re-run this script.');
    process.exit(1);
  }
  const account = accounts[0];
  console.log(`Account: ${account.displayName} (${account.name})`);

  // Step 2: Create GA4 property
  console.log('\nCreating GA4 property for thepropertydna.com...');
  const propRes = await httpsReq('POST', 'analyticsadmin.googleapis.com', '/v1beta/properties', {
    displayName: 'PropertyDNA',
    timeZone: 'America/Los_Angeles',
    currencyCode: 'USD',
    industryCategory: 'REAL_ESTATE',
    parent: account.name,
  }, authHeader);

  if (!propRes.data?.name) {
    console.error('Failed to create property:', JSON.stringify(propRes.data));
    process.exit(1);
  }
  const property = propRes.data;
  const propertyId = property.name.replace('properties/', '');
  console.log(`Property created: ${property.displayName} (ID: ${propertyId})`);

  // Step 3: Create web data stream
  console.log('\nCreating web data stream...');
  const streamRes = await httpsReq('POST', 'analyticsadmin.googleapis.com',
    `/v1beta/${property.name}/dataStreams`, {
      type: 'WEB_DATA_STREAM',
      displayName: 'thepropertydna.com',
      webStreamData: { defaultUri: 'https://www.thepropertydna.com' },
    }, authHeader);

  if (!streamRes.data?.name) {
    console.error('Failed to create stream:', JSON.stringify(streamRes.data));
    process.exit(1);
  }

  const measurementId = streamRes.data?.webStreamData?.measurementId;
  console.log(`\n✓ Measurement ID: ${measurementId}`);
  console.log(`✓ Property ID: ${propertyId}`);
  console.log('\nSave these — add measurementId to index.html and propertyId to .daily-creds.json');

  // Save to file for wiring step
  fs.writeFileSync(path.join(__dirname, 'ga4-config.json'), JSON.stringify({
    measurementId, propertyId, propertyName: property.name,
  }, null, 2));
  console.log('Saved to tools/gbp-setup/ga4-config.json');
})();
