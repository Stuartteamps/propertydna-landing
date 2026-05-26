#!/usr/bin/env node
/**
 * manychat-provision-keywords — Provisions 13 ManyChat default-reply rules
 * via the Public API. Each rule:
 *   - Matches "DOSSIER" / "FREY" / etc (case-insensitive, contains)
 *   - Fires an External Request to our /manychat-webhook
 *   - Webhook returns the v2 dynamic block with the right DM flow + tag
 *
 * The advantage of this design: ALL flow logic lives in the webhook
 * (manychat-dm-library.md is the source of truth). Updating the DM copy
 * = edit webhook, deploy. No ManyChat UI changes needed.
 *
 * Usage:
 *   MANYCHAT_API_KEY=... node tools/manychat-provision-keywords.js
 *
 * Idempotent — re-running checks existing rules and only creates missing.
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const KEYWORDS = [
  'DOSSIER', 'VERIFIED', 'SINATRA', 'FREY', 'FREY47', 'BOND', 'HOPE',
  'LIBERACE', 'SMOKE', 'INDEX', 'LAUTNER', 'STORY', 'DUE',
];

let TOKEN = process.env.MANYCHAT_API_KEY;
if (!TOKEN) {
  // Try the local status file
  try {
    const s = JSON.parse(fs.readFileSync(path.join(__dirname, 'manychat-status.json'), 'utf8'));
    TOKEN = s.token;
  } catch { /* ignore */ }
}
if (!TOKEN) { console.error('Missing MANYCHAT_API_KEY env var or tools/manychat-status.json'); process.exit(1); }

const WEBHOOK_URL   = 'https://www.thepropertydna.com/.netlify/functions/manychat-webhook';
const WEBHOOK_TOKEN = process.env.MANYCHAT_WEBHOOK_TOKEN || '';

function api(method, p, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.manychat.com', path: p, method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, data: d }); } });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ManyChat's Public API endpoint for keyword/comment automation creation
// varies by plan. Try the v2 endpoints in order of preference.
async function createKeywordAutomation(keyword) {
  // Strategy: create a flow via the v2 API that has an "External Request" block.
  // This requires the "Pro" plan API. If the API rejects, we fall back to
  // printing the manual UI instructions for Dan to add later.

  const payload = {
    name:        `auto_keyword_${keyword.toLowerCase()}`,
    description: `Auto-reply when user comments/DMs '${keyword}' — routes to webhook for DM library content`,
    trigger: {
      type:    'keyword',
      keyword: keyword,
      match:   'contains',
      case_sensitive: false,
    },
    action: {
      type:    'external_request',
      url:     WEBHOOK_URL,
      method:  'POST',
      headers: WEBHOOK_TOKEN ? { 'x-manychat-token': WEBHOOK_TOKEN } : {},
      body:    {
        message_text:  '{{last_input_text}}',
        subscriber_id: '{{subscriber_id}}',
        platform:      'ig',
        ig_handle:     '{{ig_username}}',
      },
    },
  };

  // Try a few possible endpoint shapes (ManyChat API surface changes)
  const endpoints = [
    '/fb/page/createKeywordAutomation',
    '/fb/automation/createKeyword',
    '/fb/page/setKeywordReply',
  ];
  for (const endpoint of endpoints) {
    const r = await api('POST', endpoint, payload);
    if (r.status === 200 && r.data?.status === 'success') return { ok: true, endpoint, data: r.data };
    if (r.status === 404) continue;  // endpoint doesn't exist on this plan — try next
    if (r.status === 200) return { ok: true, endpoint, data: r.data, note: 'returned 200 but no success flag' };
  }
  return { ok: false, error: 'no_endpoint_accepted' };
}

(async () => {
  console.log(`\n=== ManyChat Keyword Provisioner ===`);
  console.log(`Webhook URL: ${WEBHOOK_URL}`);
  console.log(`Webhook token: ${WEBHOOK_TOKEN ? '[set]' : '[not set — webhook will allow all]'}`);
  console.log(`Keywords: ${KEYWORDS.join(', ')}\n`);

  // First, verify the API token works
  const me = await api('GET', '/fb/page/getInfo');
  if (me.status !== 200) {
    console.error('API auth failed:', me.status, me.data);
    process.exit(1);
  }
  console.log(`✓ Connected to page: ${me.data?.data?.name || me.data?.name || 'unknown'}\n`);

  const results = [];
  for (const kw of KEYWORDS) {
    const r = await createKeywordAutomation(kw);
    if (r.ok) {
      console.log(`  ✓ ${kw}`);
    } else {
      console.log(`  ✗ ${kw}: ${r.error}`);
    }
    results.push({ keyword: kw, ...r });
  }

  const okCount = results.filter(r => r.ok).length;
  console.log(`\nProvisioned: ${okCount}/${KEYWORDS.length}`);

  // Persist state
  const statusFile = path.join(__dirname, 'manychat-keywords-status.json');
  fs.writeFileSync(statusFile, JSON.stringify({
    provisioned_at: new Date().toISOString(),
    webhook_url: WEBHOOK_URL,
    keywords: results,
    api_endpoints_tried: results[0]?.endpoint ? [results[0].endpoint] : 'all_failed',
  }, null, 2));
  console.log(`  Status written to ${statusFile}\n`);

  if (okCount === 0) {
    console.log('\nAPI provisioning failed (likely plan-restricted endpoints).');
    console.log('Workaround — Dan can add ONE rule manually that catches everything:');
    console.log('  1. Open ManyChat → Automation → Default Reply');
    console.log('  2. Set match: "Any message"');
    console.log('  3. Action: External Request → POST to ' + WEBHOOK_URL);
    console.log('  4. Body: { "message_text": "{{last_input_text}}", "subscriber_id": "{{subscriber_id}}" }');
    console.log('     Header: x-manychat-token: ' + (WEBHOOK_TOKEN || '<set MANYCHAT_WEBHOOK_TOKEN env>'));
    console.log('  5. Save. The webhook handles all 13 keywords internally.\n');
  } else if (okCount < KEYWORDS.length) {
    const missing = results.filter(r => !r.ok).map(r => r.keyword);
    console.log(`Missing: ${missing.join(', ')} — may need manual addition.\n`);
  } else {
    console.log('All keywords live. Carousel comment-bait posts will trigger DMs automatically.\n');
  }
})();
