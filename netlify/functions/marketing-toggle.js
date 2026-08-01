/**
 * marketing-toggle — Admin on/off switch for per-contact marketing consent.
 *
 * Separate from campaign_unsubscribes (permanent CAN-SPAM list).
 * Use this to suppress or re-enable marketing for any contact without
 * permanently unsubscribing them.
 *
 * GET  /?email=EMAIL              — return current consent status
 * POST {email, opted_in, reason}  — set opted_in true|false
 *
 * Requires ADMIN_SECRET header: Authorization: Bearer $ADMIN_SECRET
 */
const db = require('./_supabase');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

function auth(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || '';
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return true; // no secret configured — allow (dev mode)
  return header === `Bearer ${secret}`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (!auth(event)) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'unauthorized' }) };
  }

  const email = (
    event.queryStringParameters?.email ||
    (event.body && JSON.parse(event.body).email) ||
    ''
  ).toLowerCase().trim();

  if (!email || !email.includes('@')) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'email required' }) };
  }

  // ── GET — return current status ───────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const [consentRows, unsubRows] = await Promise.all([
      db.from('marketing_consent').select('*').eq('email', email).get().catch(() => []),
      db.from('campaign_unsubscribes').select('email').eq('email', email).get().catch(() => []),
    ]);
    const consent = consentRows?.[0] || null;
    const permanentlySuppressed = (unsubRows || []).length > 0;
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        email,
        opted_in:              consent ? consent.opted_in : true,
        permanently_suppressed: permanentlySuppressed,
        reason:                consent?.reason || null,
        updated_at:            consent?.updated_at || null,
        opted_out_at:          consent?.opted_out_at || null,
        opted_in_at:           consent?.opted_in_at || null,
      }),
    };
  }

  // ── POST — set consent ────────────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }

    const { opted_in, reason = 'admin' } = body;
    if (typeof opted_in !== 'boolean') {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'opted_in (boolean) required' }) };
    }

    const now = new Date().toISOString();
    const row = {
      email,
      opted_in,
      reason,
      updated_at:   now,
      opted_out_at: opted_in ? null : now,
      opted_in_at:  opted_in ? now  : null,
    };

    await db.upsert('marketing_consent', row, 'email');

    // When toggling back ON, also update campaign_contacts status
    // pending→pending (leave alone), but unsubscribed stays unsubscribed unless permanently cleared
    if (opted_in) {
      // Restore any contacts that were only suppressed via this toggle (not permanent unsubscribes)
      const permRows = await db.from('campaign_unsubscribes').select('email').eq('email', email).get().catch(() => []);
      if (!permRows?.length) {
        await db.from('campaign_contacts').eq('email', email).eq('status', 'unsubscribed')
          .update({ status: 'pending' }).catch(() => {});
      }
    } else {
      // Toggling OFF: mark active campaign rows suppressed
      await db.from('campaign_contacts').eq('email', email)
        .update({ status: 'unsubscribed' }).catch(() => {});

      // Suppress engagement emails too
      await db.upsert('notification_preferences', {
        email, agent: 'all', channel: 'all', enabled: false, updated_at: now,
      }, 'email,agent,channel').catch(() => {});
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, email, opted_in, reason }),
    };
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'method not allowed' }) };
};
