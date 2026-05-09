#!/usr/bin/env node
/**
 * PropertyDNA — Reddit Posting Agent
 *
 * Uses saved session cookies to POST directly to Reddit's API.
 * No browser form interaction needed — reliable and fast.
 *
 * Setup:
 *   1. node tools/browser-agent/save-reddit-session.js  (one-time)
 *   2. Add to .daily-creds.json: { "reddit": { "username": "Commercial_Fox9279" } }
 *
 * Manual run: node tools/browser-agent/agents/reddit.js
 */

const https        = require('https');
const fs           = require('fs');
const path         = require('path');

const QUEUE_FILE   = path.join(__dirname, '../data/post-queue.json');
const CREDS_FILE   = path.join(__dirname, '../.daily-creds.json');
const SESSION_FILE = path.join(__dirname, '../.reddit-session.json');

function log(msg) { console.log(`[Reddit] ${msg}`); }

function loadCreds() {
  if (!fs.existsSync(CREDS_FILE)) return null;
  const c = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
  return c.reddit || null;
}

function getCookieString(session) {
  return session.cookies
    .filter(c => c.domain && c.domain.includes('reddit'))
    .map(c => `${c.name}=${c.value}`)
    .join('; ');
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      headers,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function httpsPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = typeof body === 'string' ? body : new URLSearchParams(body).toString();
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, data: d, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Default flair per subreddit (fetched 2026-05-08)
const SUBREDDIT_FLAIR = {
  'realtors':            { id: '9898f1f0-a686-11ea-be7e-0e4ce16dfe07', text: 'Discussion' },
  'RealEstate':          null,  // no required flair
  'FirstTimeHomeBuyer':  null,
  'investing':           null,
};

async function run() {
  const creds = loadCreds();
  if (!creds || !creds.username) {
    log('SKIP — no Reddit username in .daily-creds.json');
    return { status: 'skipped', reason: 'no_credentials' };
  }

  if (!fs.existsSync(SESSION_FILE)) {
    log('ERROR: No saved session. Run: node tools/browser-agent/save-reddit-session.js');
    return { status: 'error', error: 'no_session' };
  }

  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  // Only post if a post is scheduled for today (or earlier and still unposted)
  const pending = queue.reddit.find(p => !p.posted && p.scheduledFor && p.scheduledFor <= today);
  if (!pending) {
    const next = queue.reddit.find(p => !p.posted && p.scheduledFor);
    log(next ? `No post due today. Next scheduled: ${next.scheduledFor} (${next.id})` : 'No pending posts in queue.');
    return { status: 'nothing_to_post' };
  }

  log(`Posting to r/${pending.subreddit}: "${pending.title.slice(0, 60)}..."`);

  const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
  const cookieStr = getCookieString(session);

  const commonHeaders = {
    'Cookie':     cookieStr,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };

  // Get modhash from /api/me.json
  log('Fetching modhash...');
  const me = await httpsGet('https://www.reddit.com/api/me.json', commonHeaders);
  const modhash = me.data?.data?.modhash;
  if (!modhash) {
    log(`Could not get modhash. Status: ${me.status}. Session may be expired.`);
    log('Re-run: node tools/browser-agent/save-reddit-session.js');
    return { status: 'error', error: 'no_modhash — session expired' };
  }
  log(`Modhash: ${modhash.slice(0, 8)}...`);

  const flair = SUBREDDIT_FLAIR[pending.subreddit];
  const submitBody = {
    api_type:  'json',
    kind:      'self',
    sr:        pending.subreddit,
    title:     pending.title,
    text:      pending.body,
    resubmit:  'true',
    nsfw:      'false',
    spoiler:   'false',
  };
  if (flair) {
    submitBody.flair_id   = flair.id;
    submitBody.flair_text = flair.text;
    log(`Using flair: ${flair.text}`);
  }

  const res = await httpsPost(
    'https://www.reddit.com/api/submit',
    submitBody,
    {
      ...commonHeaders,
      'X-Modhash':        modhash,
      'Referer':          `https://www.reddit.com/r/${pending.subreddit}/submit/`,
      'Origin':           'https://www.reddit.com',
      'X-Requested-With': 'XMLHttpRequest',
    }
  );

  log(`API response: ${res.status}`);

  // Check for errors
  const errors = res.data?.json?.errors;
  if (errors && errors.length > 0) {
    log(`API errors: ${JSON.stringify(errors)}`);
    return { status: 'error', error: errors[0].join(' ') };
  }

  const postUrl = res.data?.json?.data?.url;
  if (!postUrl && res.status !== 200) {
    log(`Unexpected response: ${JSON.stringify(res.data).slice(0, 200)}`);
    return { status: 'error', error: `HTTP ${res.status}` };
  }

  // Mark as posted
  pending.posted   = true;
  pending.postedAt = new Date().toISOString();
  pending.url      = postUrl || `https://www.reddit.com/r/${pending.subreddit}/`;
  queue.lastRedditPost = pending.postedAt;
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));

  log(`Posted: ${pending.url}`);
  return { status: 'posted', subreddit: pending.subreddit, title: pending.title, url: pending.url };
}

module.exports = { run };
if (require.main === module) run().then(r => console.log('\nResult:', JSON.stringify(r, null, 2)));
