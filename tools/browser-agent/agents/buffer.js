#!/usr/bin/env node
/**
 * PropertyDNA — Buffer Social Posting Agent
 *
 * Schedules posts to LinkedIn, Facebook, Twitter, Instagram via Buffer API.
 * Buffer distributes to all connected profiles in one API call.
 *
 * Setup (one-time):
 *   1. buffer.com → Sign in → Click your avatar → API Access
 *   2. Copy your Access Token
 *   3. Add to .daily-creds.json:
 *      { "buffer": { "token": "..." } }
 *
 * Content rotates through a set of property intelligence insights + blog links.
 */

const https    = require('https');
const fs       = require('fs');
const path     = require('path');

const CREDS_FILE   = path.join(__dirname, '../.daily-creds.json');
const QUEUE_FILE   = path.join(__dirname, '../data/post-queue.json');
const TRACKER_FILE = path.join(__dirname, '../data/buffer-tracker.json');

function log(msg) { console.log(`[Buffer] ${msg}`); }

function loadCreds() {
  if (!fs.existsSync(CREDS_FILE)) return null;
  const c = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
  return c.buffer || null;
}

// Daily social content rotation — mix of insights and blog links
const SOCIAL_CONTENT = [
  "168,000 parcels indexed across the Coachella Valley. Every permit, every owner change, every valuation update — in one place. www.thepropertydna.com",
  "The listing appointment is won before you walk in the door. Sellers who receive a property report 24 hours early arrive curious, not skeptical. www.thepropertydna.com/blog/win-listing-appointment-ai-property-data",
  "Permit history is the most under-used data point in real estate due diligence. We check it automatically on every PropertyDNA report. www.thepropertydna.com",
  "AI property reports vs. traditional CMA — we ran both for a year. The AI report takes 4 minutes. The CMA takes 4 hours. The accuracy is comparable. www.thepropertydna.com/blog/ai-property-report-vs-cma",
  "Off-market leads: filter for absentee owners with 10+ years of ownership and no recent permits. That's your motivated seller list. www.thepropertydna.com",
  "Zillow's Zestimate error rate on off-market homes is 6.9%. Our model incorporates permit data and micro-neighborhood variation. www.thepropertydna.com/blog/zillow-zestimate-accuracy",
  "The PropertyDNA heat map shows price-per-sqft movement across the Coachella Valley in real time. See which neighborhoods are actually moving. www.thepropertydna.com/market-heatmaps",
  "Real estate teams using AI property reports win listing appointments at higher rates. The research is done before the conversation starts. www.thepropertydna.com",
  "Neighborhood data signals most buyers miss: permit pull rate, owner-occupancy ratio changes, ppsf velocity. All in one report. www.thepropertydna.com/blog/neighborhood-data-signals",
  "STR performance in the Coachella Valley: Palm Springs central avg 71% occupancy, $285 ADR. Old Las Palmas: 64% occupancy, $420 ADR. www.thepropertydna.com",
];

function loadTracker() {
  if (fs.existsSync(TRACKER_FILE)) {
    return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8'));
  }
  return { lastIndex: -1, posts: [] };
}

function saveTracker(tracker) {
  fs.writeFileSync(TRACKER_FILE, JSON.stringify(tracker, null, 2));
}

function httpsReq(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: { 'Content-Type': 'application/json', ...headers,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function getProfiles(token) {
  const res = await httpsReq('GET', 'https://api.bufferapp.com/1/profiles.json', null, {
    'Authorization': `Bearer ${token}`,
  });
  if (!Array.isArray(res.data)) throw new Error(`Buffer profiles error: ${JSON.stringify(res.data)}`);
  return res.data.map(p => p.id);
}

async function schedulePost(token, profileIds, text) {
  const params = new URLSearchParams({
    text,
    'profile_ids[]': profileIds,
    shorten: 'false',
    now: 'true',
  });
  // Buffer API v1 uses form encoding for this endpoint
  const res = await httpsReq('POST', 'https://api.bufferapp.com/1/updates/create.json', params.toString(), {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  });
  if (!res.data?.success) throw new Error(`Buffer post error: ${JSON.stringify(res.data)}`);
  return res.data;
}

async function run() {
  const creds = loadCreds();
  if (!creds || !creds.token) {
    log('SKIP — no Buffer token. Add token to .daily-creds.json');
    log('  1. buffer.com → avatar → API Access → copy Access Token');
    log('  2. Add: { "buffer": { "token": "YOUR_TOKEN" } } to .daily-creds.json');
    return { status: 'skipped', reason: 'no_credentials' };
  }

  const tracker = loadTracker();
  const nextIndex = (tracker.lastIndex + 1) % SOCIAL_CONTENT.length;
  const text = SOCIAL_CONTENT[nextIndex];

  log(`Scheduling post ${nextIndex + 1}/${SOCIAL_CONTENT.length}: "${text.slice(0, 60)}..."`);

  try {
    const profileIds = await getProfiles(creds.token);
    if (profileIds.length === 0) throw new Error('No Buffer profiles connected');
    log(`Found ${profileIds.length} profile(s)`);

    await schedulePost(creds.token, profileIds, text);

    tracker.lastIndex = nextIndex;
    tracker.posts.push({ text: text.slice(0, 80), postedAt: new Date().toISOString(), profiles: profileIds.length });
    saveTracker(tracker);

    log(`Posted to ${profileIds.length} profiles`);
    return { status: 'posted', profiles: profileIds.length, text: text.slice(0, 80) };
  } catch (e) {
    log(`ERROR: ${e.message}`);
    return { status: 'error', error: e.message };
  }
}

module.exports = { run };
if (require.main === module) run().then(r => console.log('\nResult:', JSON.stringify(r, null, 2)));
