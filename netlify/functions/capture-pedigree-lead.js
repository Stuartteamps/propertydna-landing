/**
 * Pedigree-index email gate capture.
 * POST {email} → insert into campaign_contacts (idempotent), flag suppression
 * state so the client knows whether the visitor previously unsubscribed.
 * Returns 200 with { ok: true } on success regardless of duplicate.
 */
const SUPA_URL = process.env.SUPABASE_URL || 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function reply(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

async function supaReq(path, init = {}) {
  return fetch(`${SUPA_URL}${path}`, {
    ...init,
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')    return reply(405, { error: 'POST only' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { error: 'invalid json' }); }

  const email = String(body.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return reply(400, { error: 'invalid email' });
  }

  // Honor prior unsubscribes — we still let them unlock the page (good UX),
  // but flag it so we never re-add to the active campaign list silently.
  let suppressed = false;
  try {
    const r = await supaReq(`/rest/v1/campaign_unsubscribes?select=email&email=eq.${encodeURIComponent(email)}&limit=1`);
    const rows = await r.json();
    suppressed = Array.isArray(rows) && rows.length > 0;
  } catch { /* ignore */ }

  if (!suppressed) {
    // Idempotent insert; conflict on email PK/unique is ignored.
    try {
      await supaReq('/rest/v1/campaign_contacts', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({
          email,
          metadata: { source: 'pedigree_gate', captured_at: new Date().toISOString() },
        }),
      });
    } catch { /* ignore */ }
  }

  return reply(200, { ok: true, suppressed });
};
