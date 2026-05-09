#!/usr/bin/env node
/**
 * PropertyDNA — Consolidated Marketing Stats Dashboard
 *
 * Pulls live metrics from every platform we post to and prints one unified view:
 *   - Buffer: post counts + engagement per channel
 *   - Reddit: upvotes + comments per posted item
 *   - GA4: site sessions + traffic by source (UTM)
 *   - Email: campaign delivery stats
 *
 * Run: node tools/browser-agent/marketing-stats.js
 * Run with --json for machine-readable output (for piping to a dashboard)
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const CREDS_FILE     = path.join(__dirname, '.daily-creds.json');
const SESSION_FILE   = path.join(__dirname, '.reddit-session.json');
const QUEUE_FILE     = path.join(__dirname, 'data/post-queue.json');
const BUFFER_TRACKER = path.join(__dirname, 'data/buffer-tracker.json');
const GA4_TOKENS     = path.join(__dirname, '../gbp-setup/ga4-tokens.json');
const GA4_CREDS      = path.join(__dirname, '../gbp-setup/credentials.json');

const JSON_OUT = process.argv.includes('--json');

function log(...args) { if (!JSON_OUT) console.log(...args); }
function header(title) { log('\n' + '─'.repeat(60)); log(title); log('─'.repeat(60)); }

function httpsReq(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: { ...headers, ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, data: d }); } });
    });
    req.on('error', () => resolve({ status: 0, data: null }));
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Buffer Stats ──────────────────────────────────────────────────────────
async function bufferStats() {
  const creds = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8')).buffer;
  if (!creds?.token) return { error: 'no_token' };

  const accountRes = await httpsReq('POST', 'https://api.buffer.com/', {
    query: 'query { account { organizations { id name } } }'
  }, { 'Authorization': `Bearer ${creds.token}`, 'Content-Type': 'application/json' });
  const orgId = accountRes.data?.data?.account?.organizations?.[0]?.id;
  if (!orgId) return { error: 'no_org' };

  // Fetch recent posts (last 50)
  const postsRes = await httpsReq('POST', 'https://api.buffer.com/', {
    query: `query GetPosts($input: PostsInput!, $first: Int) {
      posts(input: $input, first: $first) {
        edges { node { id status sentAt channel { service name } externalLink text } }
      }
    }`,
    variables: { input: { organizationId: orgId, filter: { status: ['sent'] } }, first: 50 },
  }, { 'Authorization': `Bearer ${creds.token}`, 'Content-Type': 'application/json' });

  const posts = postsRes.data?.data?.posts?.edges?.map(e => e.node) || [];

  // Group by channel
  const byChannel = {};
  posts.forEach(p => {
    const key = `${p.channel?.service}/${p.channel?.name}`;
    if (!byChannel[key]) byChannel[key] = { count: 0, lastPost: null, links: [] };
    byChannel[key].count++;
    if (!byChannel[key].lastPost || p.sentAt > byChannel[key].lastPost) byChannel[key].lastPost = p.sentAt;
    if (p.externalLink) byChannel[key].links.push(p.externalLink);
  });

  return { totalPosts: posts.length, byChannel };
}

// ─── Reddit Stats ──────────────────────────────────────────────────────────
async function redditStats() {
  if (!fs.existsSync(SESSION_FILE)) return { error: 'no_session' };
  const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
  const cookieStr = session.cookies.filter(c => c.domain?.includes('reddit')).map(c => `${c.name}=${c.value}`).join('; ');
  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  const posted = queue.reddit.filter(p => p.posted && p.url);

  const stats = [];
  for (const p of posted) {
    const slug = p.url.split('/comments/')[1]?.replace(/\/$/, '');
    if (!slug) continue;
    const id = slug.split('/')[0];
    const res = await httpsReq('GET', `https://www.reddit.com/comments/${id}.json`, null, {
      'Cookie': cookieStr,
      'User-Agent': 'Mozilla/5.0 PropertyDNA/1.0',
    });
    const data = res.data?.[0]?.data?.children?.[0]?.data;
    if (data) {
      stats.push({
        title: p.title.slice(0, 50),
        subreddit: p.subreddit,
        upvotes: data.ups,
        comments: data.num_comments,
        upvoteRatio: data.upvote_ratio,
        url: p.url,
      });
    }
  }
  return { posts: stats };
}

// ─── GA4 Stats ─────────────────────────────────────────────────────────────
async function ga4Stats() {
  if (!fs.existsSync(GA4_TOKENS) || !fs.existsSync(GA4_CREDS)) return { error: 'no_tokens' };

  const creds = JSON.parse(fs.readFileSync(GA4_CREDS)).installed;
  const tokens = JSON.parse(fs.readFileSync(GA4_TOKENS));

  // Refresh access token
  const tokenRes = await httpsReq('POST', 'https://oauth2.googleapis.com/token',
    new URLSearchParams({
      client_id: creds.client_id, client_secret: creds.client_secret,
      refresh_token: tokens.refresh_token, grant_type: 'refresh_token'
    }).toString(),
    { 'Content-Type': 'application/x-www-form-urlencoded' }
  );
  if (!tokenRes.data?.access_token) return { error: 'token_refresh_failed' };

  const auth = { 'Authorization': `Bearer ${tokenRes.data.access_token}`, 'Content-Type': 'application/json' };

  // Find the property
  const summRes = await httpsReq('GET', 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries', null, auth);
  const propSummary = summRes.data?.accountSummaries?.[0]?.propertySummaries?.find(p => p.displayName === 'PropertyDNA');
  if (!propSummary) return { error: 'no_propertydna_property' };
  const propertyId = propSummary.property;

  // Run report: sessions by source/medium last 7 days
  const reportRes = await httpsReq('POST',
    `https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`,
    {
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }],
    }, auth);

  const rows = reportRes.data?.rows || [];
  const bySource = rows.map(r => ({
    source: r.dimensionValues[0]?.value,
    medium: r.dimensionValues[1]?.value,
    sessions: parseInt(r.metricValues[0]?.value || 0),
    users: parseInt(r.metricValues[1]?.value || 0),
    pageViews: parseInt(r.metricValues[2]?.value || 0),
  })).sort((a, b) => b.sessions - a.sessions);

  const totals = {
    sessions: bySource.reduce((a, b) => a + b.sessions, 0),
    users: bySource.reduce((a, b) => a + b.users, 0),
    pageViews: bySource.reduce((a, b) => a + b.pageViews, 0),
  };

  return { totals, bySource };
}

// ─── Main ──────────────────────────────────────────────────────────────────
(async () => {
  const [buffer, reddit, ga4] = await Promise.all([
    bufferStats().catch(e => ({ error: e.message })),
    redditStats().catch(e => ({ error: e.message })),
    ga4Stats().catch(e => ({ error: e.message })),
  ]);

  if (JSON_OUT) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), buffer, reddit, ga4 }, null, 2));
    return;
  }

  header(`PropertyDNA Marketing Dashboard — ${new Date().toLocaleString('en-US')}`);

  log('\n📊 GA4 — Last 7 Days');
  if (ga4.error) {
    log(`  ⚠ ${ga4.error}`);
  } else {
    log(`  Total: ${ga4.totals.sessions} sessions · ${ga4.totals.users} users · ${ga4.totals.pageViews} page views`);
    log('  Top sources:');
    ga4.bySource.slice(0, 8).forEach(s => log(`    ${(s.source + '/' + s.medium).padEnd(30)} ${String(s.sessions).padStart(5)} sessions`));
  }

  log('\n📤 Buffer — Sent posts');
  if (buffer.error) {
    log(`  ⚠ ${buffer.error}`);
  } else {
    log(`  Total: ${buffer.totalPosts} posts across ${Object.keys(buffer.byChannel).length} channels`);
    Object.entries(buffer.byChannel).forEach(([k, v]) => {
      const last = v.lastPost ? new Date(v.lastPost).toLocaleDateString() : 'never';
      log(`    ${k.padEnd(40)} ${String(v.count).padStart(3)} posts · last ${last}`);
    });
  }

  log('\n👍 Reddit — Per-post engagement');
  if (reddit.error) {
    log(`  ⚠ ${reddit.error}`);
  } else if (!reddit.posts.length) {
    log('  No posts tracked yet');
  } else {
    reddit.posts.forEach(p => {
      log(`    r/${p.subreddit.padEnd(22)} ↑${String(p.upvotes).padStart(4)} 💬${String(p.comments).padStart(3)} (${Math.round(p.upvoteRatio * 100)}%) — ${p.title}`);
    });
  }

  log('\n' + '─'.repeat(60));
  log('Run with --json for machine-readable output');
  log('');
})();
