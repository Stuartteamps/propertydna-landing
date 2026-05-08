#!/usr/bin/env node
/**
 * PropertyDNA — Medium Cross-Posting Agent
 *
 * Cross-posts blog articles to Medium as canonical links (no duplicate content penalty).
 *
 * Setup (one-time):
 *   1. medium.com → Settings → Security → Integration Tokens → Generate
 *   2. Run: curl -H "Authorization: Bearer YOUR_TOKEN" https://api.medium.com/v1/me
 *      Copy the "id" field — that's your userId
 *   3. Add to .daily-creds.json:
 *      { "medium": { "token": "...", "userId": "..." } }
 *
 * Posts one article per run (canonical URL = propertydna.com/blog/slug).
 */

const https    = require('https');
const fs       = require('fs');
const path     = require('path');

const QUEUE_FILE = path.join(__dirname, '../data/post-queue.json');
const CREDS_FILE = path.join(__dirname, '../.daily-creds.json');

function log(msg) { console.log(`[Medium] ${msg}`); }

function loadCreds() {
  if (!fs.existsSync(CREDS_FILE)) return null;
  const c = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
  return c.medium || null;
}

function httpsReq(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
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

function buildMediumContent(post) {
  // Creates a short teaser with a canonical link back to the full article
  return `<h1>${post.title}</h1>
<p><em>Originally published on <a href="${post.canonicalUrl}">PropertyDNA Journal</a>.</em></p>
<p>This article is published in full on the PropertyDNA Journal. <a href="${post.canonicalUrl}">Read the full article here →</a></p>
<p>PropertyDNA is an AI-powered property intelligence platform that generates instant property reports, market heat maps, and deal analysis for real estate professionals. <a href="https://propertydna.com">Learn more at propertydna.com</a>.</p>`;
}

async function run() {
  const creds = loadCreds();
  if (!creds || !creds.token || !creds.userId) {
    log('SKIP — no Medium credentials. Add token and userId to .daily-creds.json');
    return { status: 'skipped', reason: 'no_credentials' };
  }

  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  const pending = queue.medium.find(p => !p.posted);

  if (!pending) {
    log('No pending Medium posts in queue.');
    return { status: 'nothing_to_post' };
  }

  log(`Cross-posting to Medium: "${pending.title.slice(0, 60)}..."`);

  try {
    const res = await httpsReq('POST', `https://api.medium.com/v1/users/${creds.userId}/posts`, {
      title:         pending.title,
      contentFormat: 'html',
      content:       buildMediumContent(pending),
      canonicalUrl:  pending.canonicalUrl,
      tags:          pending.tags,
      publishStatus: 'public',
    }, {
      'Authorization': `Bearer ${creds.token}`,
    });

    if (res.status !== 201) throw new Error(`Medium API error: ${res.status} ${JSON.stringify(res.data)}`);

    const url = res.data?.data?.url;
    pending.posted   = true;
    pending.postedAt = new Date().toISOString();
    pending.url      = url;
    queue.lastMediumPost = pending.postedAt;
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));

    log(`Posted: ${url}`);
    return { status: 'posted', title: pending.title, url };
  } catch (e) {
    log(`ERROR: ${e.message}`);
    return { status: 'error', error: e.message };
  }
}

module.exports = { run };
if (require.main === module) run().then(r => console.log('\nResult:', JSON.stringify(r, null, 2)));
