/**
 * update-newsletter-links — one-shot helper for Dan to set this week's
 * Flexmls share URLs in Supabase. Called manually (no cron).
 *
 * Usage:
 *   POST /.netlify/functions/update-newsletter-links?key=INTERNAL_API_KEY
 *   Body: { "west_valley_new": "...", "east_valley_new": "...", "recently_sold": "..." }
 *
 * Or GET with the same query params:
 *   GET /.netlify/functions/update-newsletter-links?key=...
 *       &west_valley_new=...&east_valley_new=...&recently_sold=...
 *
 * Reads/writes the newsletter_links table (single row, id=1) that
 * send-cc-newsletter.js consumes on Thursday 4:20 PM PT.
 */
const db = require('./_supabase');

exports.handler = async (event) => {
  const qs   = event.queryStringParameters || {};
  const key  = qs.key || event.headers['x-internal-key'];
  if (key !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  let body = {};
  if (event.body) {
    try { body = JSON.parse(event.body); }
    catch { /* allow query-string path */ }
  }

  const west = body.west_valley_new || qs.west_valley_new || null;
  const east = body.east_valley_new || qs.east_valley_new || null;
  const sold = body.recently_sold   || qs.recently_sold   || null;

  if (!west && !east && !sold) {
    // Just return current state for sanity-check
    try {
      const rows = await db.from('newsletter_links').select('*').eq('id', 1).limit(1).get();
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current: rows?.[0] || null }) };
    } catch (e) {
      return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
    }
  }

  const update = { id: 1, updated_at: new Date().toISOString() };
  if (west) update.west_valley_new = west;
  if (east) update.east_valley_new = east;
  if (sold) update.recently_sold   = sold;

  try {
    const result = await db.upsert('newsletter_links', update, 'id');
    db.kpi('newsletter_links_updated', null, update);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, row: result }) };
  } catch (e) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
