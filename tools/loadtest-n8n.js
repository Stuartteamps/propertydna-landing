#!/usr/bin/env node
/**
 * loadtest-n8n.js — concurrent load test for queue-report → n8n
 *
 * Fires N concurrent POST requests at /.netlify/functions/queue-report
 * and measures throughput, success rate, and latency percentiles.
 *
 * IMPORTANT: this hits PRODUCTION by default. Every successful submission
 *   1. inserts a pending row into Supabase `reports`
 *   2. sends a "report queued" email via Resend
 *   3. fires the n8n enrichment webhook
 *
 * To keep blast radius small:
 *   - emails default to loadtest+<runId>-<i>@thepropertydna.com (catch-all)
 *   - the runId is printed at the end so you can clean up the test rows:
 *       delete from reports where email like 'loadtest+<runId>-%';
 *   - default N is 10; bump with --n=100 once you've sanity-checked the safe path
 *
 * Usage:
 *   node tools/loadtest-n8n.js                       # 10 concurrent, prod
 *   node tools/loadtest-n8n.js --n=100               # 100 concurrent
 *   node tools/loadtest-n8n.js --n=50 --concurrency=10  # 50 requests, 10 at a time
 *   node tools/loadtest-n8n.js --base=http://localhost:8888  # local netlify dev
 *   node tools/loadtest-n8n.js --dry                 # parse + plan only, no requests
 */

const https = require('https');
const http  = require('http');
const { URL } = require('url');

// ── Args ─────────────────────────────────────────────────────────────────────
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v === undefined ? true : v];
}));

const N             = parseInt(args.n || '10', 10);
const CONCURRENCY   = parseInt(args.concurrency || String(N), 10);
const BASE          = (args.base || 'https://thepropertydna.com').replace(/\/$/, '');
const ENDPOINT      = '/.netlify/functions/queue-report';
const DRY_RUN       = !!args.dry;
const PER_REQ_TIMEOUT_MS = parseInt(args.timeout || '15000', 10);
const runId         = Math.random().toString(36).slice(2, 8);

// Sample addresses (cycled through). Real-looking but all in our coverage area.
const ADDRESSES = [
  { address: '420 S Camino Norte',     city: 'Palm Springs', state: 'CA', zip: '92262' },
  { address: '1 Eisenhower Drive',     city: 'Rancho Mirage', state: 'CA', zip: '92270' },
  { address: '78-095 Avenida La Fonda', city: 'La Quinta',   state: 'CA', zip: '92253' },
  { address: '74-855 Country Club Dr', city: 'Palm Desert',  state: 'CA', zip: '92260' },
  { address: '47-225 Washington St',   city: 'Indio',        state: 'CA', zip: '92201' },
];

// ── Stats helpers ────────────────────────────────────────────────────────────
function pct(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}
function mean(arr) { return arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0; }

// ── HTTP ──────────────────────────────────────────────────────────────────────
function postJson(urlStr, body) {
  return new Promise((resolve) => {
    const u    = new URL(urlStr);
    const lib  = u.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);
    const t0   = Date.now();
    const req  = lib.request({
      hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'User-Agent': `PropertyDNA-LoadTest/${runId}` },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        const ms = Date.now() - t0;
        let parsed; try { parsed = JSON.parse(raw); } catch { parsed = { _raw: raw.slice(0, 200) }; }
        resolve({ status: res.statusCode, ms, body: parsed });
      });
    });
    req.on('error', (err) => resolve({ status: 0, ms: Date.now() - t0, body: { error: err.message } }));
    req.setTimeout(PER_REQ_TIMEOUT_MS, () => { req.destroy(); resolve({ status: 0, ms: Date.now() - t0, body: { error: 'timeout' } }); });
    req.write(data); req.end();
  });
}

function buildPayload(i) {
  const addr = ADDRESSES[i % ADDRESSES.length];
  return {
    email:     `loadtest+${runId}-${i}@thepropertydna.com`,
    fullName:  `LoadTest Bot ${i}`,
    phone:     '',
    role:      'Buyer',
    address:   addr.address,
    city:      addr.city,
    state:     addr.state,
    zip:       addr.zip,
    notes:     `Synthetic load test run ${runId} request #${i}`,
  };
}

// ── Pool runner ──────────────────────────────────────────────────────────────
async function runPool(total, concurrency, jobFn) {
  const results = new Array(total);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= total) return;
      results[i] = await jobFn(i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n── n8n queue-report load test ───────────────────────────────`);
  console.log(`base:        ${BASE}`);
  console.log(`endpoint:    ${ENDPOINT}`);
  console.log(`total:       ${N}`);
  console.log(`concurrency: ${CONCURRENCY}`);
  console.log(`runId:       ${runId}`);
  console.log(`dry:         ${DRY_RUN}`);
  console.log(``);

  if (DRY_RUN) {
    console.log('Dry run — sample payload:');
    console.log(JSON.stringify(buildPayload(0), null, 2));
    console.log(`\nCleanup query (run after a real test):`);
    console.log(`  delete from reports where email like 'loadtest+${runId}-%';`);
    return;
  }

  const t0 = Date.now();
  const results = await runPool(N, CONCURRENCY, (i) =>
    postJson(BASE + ENDPOINT, buildPayload(i))
  );
  const elapsed = (Date.now() - t0) / 1000;

  const ok       = results.filter(r => r.status >= 200 && r.status < 300);
  const fail     = results.filter(r => r.status < 200 || r.status >= 300);
  const okTimes  = ok.map(r => r.ms);
  const errKinds = {};
  for (const r of fail) {
    const k = `${r.status || 'err'}:${(r.body?.error || '').slice(0, 60) || 'no-body'}`;
    errKinds[k] = (errKinds[k] || 0) + 1;
  }

  console.log(`── Results ──────────────────────────────────────────────────`);
  console.log(`elapsed:   ${elapsed.toFixed(2)}s`);
  console.log(`success:   ${ok.length}/${N} (${((ok.length / N) * 100).toFixed(1)}%)`);
  console.log(`fail:      ${fail.length}/${N}`);
  console.log(`rps:       ${(N / elapsed).toFixed(2)}`);
  console.log(``);
  console.log(`latency (ok only):`);
  console.log(`  mean:    ${Math.round(mean(okTimes))} ms`);
  console.log(`  p50:     ${pct(okTimes, 50)} ms`);
  console.log(`  p95:     ${pct(okTimes, 95)} ms`);
  console.log(`  p99:     ${pct(okTimes, 99)} ms`);
  console.log(`  max:     ${okTimes.length ? Math.max(...okTimes) : 0} ms`);
  console.log(``);
  if (Object.keys(errKinds).length) {
    console.log(`errors:`);
    for (const [k, v] of Object.entries(errKinds)) console.log(`  ${v}× ${k}`);
    console.log(``);
  }

  console.log(`── Cleanup ──────────────────────────────────────────────────`);
  console.log(`These submissions wrote rows tagged with email loadtest+${runId}-N@…`);
  console.log(`Remove them from Supabase with:`);
  console.log(`  delete from reports where email like 'loadtest+${runId}-%';`);
  console.log(`  delete from report_searches where email like 'loadtest+${runId}-%';`);
  console.log(``);

  // Exit non-zero on bad health so this can be wrapped in CI
  const successRate = ok.length / N;
  process.exit(successRate >= 0.95 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(2); });
