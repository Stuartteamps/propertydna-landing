/**
 * ops-log — Shared activity logger every PropertyDNA agent uses.
 *
 * Usage:
 *   const log = require('./lib/ops-log');
 *   await log.write({
 *     agent: 'reddit', event_type: 'post_sent', status: 'ok',
 *     summary: 'Posted to r/fatFIRE', metadata: { subreddit, url },
 *     affected_rows: 1, duration_ms: 1234,
 *   });
 *
 * Fails silently if Supabase is unreachable — never blocks the calling agent.
 */
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;

function write(entry) {
  if (!KEY) return Promise.resolve({ skipped: true });
  return new Promise(resolve => {
    const body = JSON.stringify({
      agent: entry.agent,
      event_type: entry.event_type,
      status: entry.status || 'ok',
      summary: entry.summary || null,
      metadata: entry.metadata || {},
      affected_rows: entry.affected_rows ?? null,
      duration_ms: entry.duration_ms ?? null,
      error_message: entry.error_message || null,
    });
    const u = new URL(SUPABASE_URL + '/rest/v1/ops_activity_log');
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: {
        apikey: KEY, Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Prefer: 'return=minimal',
      },
    }, res => { res.resume(); resolve({ status: res.statusCode }); });
    req.on('error', () => resolve({ error: true }));
    req.write(body); req.end();
  });
}

module.exports = { write };
