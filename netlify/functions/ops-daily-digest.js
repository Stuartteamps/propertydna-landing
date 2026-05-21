/**
 * ops-daily-digest — Sends Dan a daily summary at 01:00 UTC (6 PM PDT prev day)
 * via Resend. Reads from ops_activity_log + dossier_requests + property_master.
 *
 * Scheduled via netlify.toml: "0 1 * * *"
 */
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const FROM = 'PropertyDNA Ops <ops@mail.thepropertydna.com>';
const TO   = 'stuartteamps@gmail.com';

function sbGet(path) {
  return new Promise(resolve => {
    const u = new URL(SUPABASE_URL + path);
    const r = https.request({ hostname: u.hostname, path: u.pathname + u.search,
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'count=exact' } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        let count = null;
        const cr = res.headers['content-range'];
        if (cr) count = parseInt(cr.split('/')[1]);
        try { resolve({ data: JSON.parse(d), count }); } catch { resolve({ data: [], count }); }
      });
    });
    r.on('error', () => resolve({ data: [], count: null }));
    r.end();
  });
}

function sbPost(path, body) {
  return new Promise(resolve => {
    const payload = JSON.stringify(body);
    const u = new URL(SUPABASE_URL + path);
    const r = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), Prefer: 'return=minimal' } }, res => { res.resume(); resolve({ status: res.statusCode }); });
    r.on('error', () => resolve({ error: true }));
    r.write(payload); r.end();
  });
}

function resendSend(payload) {
  return new Promise(resolve => {
    const body = JSON.stringify(payload);
    const r = https.request({ hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ s: res.statusCode, d: JSON.parse(d) }); } catch { resolve({ s: res.statusCode, d }); } });
    });
    r.on('error', () => resolve({ error: true })); r.write(body); r.end();
  });
}

exports.handler = async () => {
  const todayDate = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  // Idempotency: don't double-send same day
  const existing = await sbGet(`/rest/v1/daily_digest_runs?digest_date=eq.${todayDate}&select=id`);
  if (existing.data?.length > 0) {
    return { statusCode: 200, body: JSON.stringify({ skipped: 'already_sent_today' }) };
  }

  // Pull metrics
  const [activity, leadsAll, leadsNew, aTier, classified] = await Promise.all([
    sbGet(`/rest/v1/ops_activity_log?created_at=gte.${since}&select=*&order=created_at.desc&limit=100`),
    sbGet(`/rest/v1/dossier_requests?select=id&limit=1`),
    sbGet(`/rest/v1/dossier_requests?status=eq.new&select=*`),
    sbGet(`/rest/v1/property_master?pedigree_tier=eq.A&select=apn&limit=1`),
    sbGet(`/rest/v1/property_master?pedigree_tier=not.is.null&select=apn&limit=1`),
  ]);

  const activities = activity.data || [];
  const byAgent = {};
  activities.forEach(a => {
    if (!byAgent[a.agent]) byAgent[a.agent] = { ok: 0, warning: 0, error: 0, skipped: 0 };
    byAgent[a.agent][a.status] = (byAgent[a.agent][a.status] || 0) + 1;
  });

  const errors = activities.filter(a => a.status === 'error');
  const newLeads = leadsNew.data || [];

  const subject = `PropertyDNA · ${todayDate} · ${activities.length} events · ${newLeads.length} new lead${newLeads.length === 1 ? '' : 's'}`;

  const html = `
    <div style="font-family:Georgia,serif;max-width:620px;margin:0 auto;color:#0a0a0a;">
      <div style="background:#0a0a0a;color:#fbbf24;padding:24px 28px;">
        <div style="font-size:11px;letter-spacing:4px;text-transform:uppercase;font-weight:600;font-family:-apple-system,sans-serif;">PropertyDNA Daily Digest</div>
        <div style="font-size:22px;margin-top:6px;color:#fafafa;font-family:Georgia,serif;">${todayDate}</div>
      </div>

      <div style="padding:24px 28px;background:#fff;">
        <table cellpadding="0" cellspacing="0" style="width:100%;font-family:-apple-system,sans-serif;font-size:14px;border-collapse:collapse;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><strong style="font-family:Georgia,serif;font-size:22px;color:#0a0a0a;">${classified.count?.toLocaleString() || '—'}</strong> properties pedigree-classified</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><strong style="font-family:Georgia,serif;font-size:22px;color:#0a0a0a;">${aTier.count || '—'}</strong> verified A-tier dossiers</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><strong style="font-family:Georgia,serif;font-size:22px;color:#${newLeads.length > 0 ? 'b45309' : '0a0a0a'};">${newLeads.length}</strong> new dossier requests in last 24h${newLeads.length > 0 ? ' — <a href="https://www.thepropertydna.com/admin/dossier-requests" style="color:#b45309;">review →</a>' : ''}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><strong style="font-family:Georgia,serif;font-size:22px;color:#0a0a0a;">${activities.length}</strong> agent events in last 24h</td>
          </tr>
        </table>

        ${newLeads.length > 0 ? `
        <h3 style="color:#0a0a0a;font-family:Georgia,serif;margin-top:28px;">New leads</h3>
        ${newLeads.slice(0, 5).map(l => `
          <div style="padding:14px;background:#f9fafb;border-left:3px solid #fbbf24;margin-bottom:8px;font-family:-apple-system,sans-serif;font-size:13px;">
            <strong>${l.full_name || l.email}</strong> — ${l.role || 'role unspecified'}<br>
            ${l.property_address ? `<span style="color:#475569;">${l.property_address}</span><br>` : ''}
            <a href="mailto:${l.email}" style="color:#b45309;">${l.email}</a>
            ${l.message ? `<div style="font-style:italic;color:#475569;margin-top:6px;">"${l.message.slice(0, 200)}"</div>` : ''}
          </div>
        `).join('')}
        ` : ''}

        <h3 style="color:#0a0a0a;font-family:Georgia,serif;margin-top:28px;">Agent activity</h3>
        <table cellpadding="0" cellspacing="0" style="width:100%;font-family:-apple-system,sans-serif;font-size:13px;">
          ${Object.entries(byAgent).map(([agent, s]) => `
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="padding:8px 0;color:#0a0a0a;text-transform:uppercase;letter-spacing:1px;font-size:11px;font-weight:600;">${agent}</td>
              <td style="padding:8px 0;text-align:right;color:#15803d;">${s.ok || 0} ok</td>
              ${s.warning ? `<td style="padding:8px 8px;color:#b45309;">${s.warning} warn</td>` : '<td></td>'}
              ${s.error   ? `<td style="padding:8px 8px;color:#dc2626;">${s.error} err</td>`  : '<td></td>'}
            </tr>
          `).join('')}
        </table>

        ${errors.length > 0 ? `
        <h3 style="color:#dc2626;font-family:Georgia,serif;margin-top:28px;">Errors</h3>
        ${errors.slice(0, 5).map(e => `<div style="padding:10px 14px;background:#fef2f2;border-left:3px solid #dc2626;margin-bottom:6px;font-size:12px;color:#7f1d1d;font-family:-apple-system,sans-serif;"><strong>${e.agent}:</strong> ${e.error_message || e.summary}</div>`).join('')}
        ` : ''}

        <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;">
          <a href="https://www.thepropertydna.com/admin/ops" style="display:inline-block;padding:12px 24px;background:#fbbf24;color:#0a0a0a;text-decoration:none;border-radius:4px;font-family:-apple-system,sans-serif;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Open Ops Dashboard</a>
        </div>
      </div>
    </div>`;

  const r = await resendSend({ from: FROM, to: TO, subject, html });

  await sbPost('/rest/v1/daily_digest_runs', {
    digest_date: todayDate,
    delivery_id: r.d?.id || null,
    metrics: { activities: activities.length, new_leads: newLeads.length, a_tier: aTier.count, classified: classified.count, errors: errors.length },
  });

  return { statusCode: 200, body: JSON.stringify({ sent: r.s < 300, subject, activities: activities.length, new_leads: newLeads.length }) };
};
