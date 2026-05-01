// Sends a batch of 50 campaign emails via Resend.
// Called repeatedly by CampaignManager until done=true.
const https = require('https');
const db    = require('./_supabase');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,x-internal-key',
  'Content-Type': 'application/json',
};

const BATCH_SIZE  = 50;
const SENDER      = process.env.SENDER_EMAIL || 'reports@thepropertydna.com';
const SENDER_NAME = 'PropertyDNA';
const SITE_URL    = 'https://thepropertydna.com';

function resendPost(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, data: {} }); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function agentHtml(c, campaign) {
  const firstName = c.first_name || 'there';
  const city      = c.city || 'Coachella Valley';
  const score     = c.neighborhood_score || 71;
  const label     = c.score_label || 'Buy';
  const unsub     = `${SITE_URL}/.netlify/functions/campaign-unsubscribe?email=${encodeURIComponent(c.email)}&cid=${c.campaign_id}`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;background:#F4F0E8;font-family:Jost,Helvetica,sans-serif}
.wrap{max-width:580px;margin:0 auto;background:#fff;border:1px solid #e8e4dc}
.header{background:#0F0E0D;padding:32px 40px}.header h1{font-family:Georgia,serif;color:#F4F0E8;font-size:22px;font-weight:400;margin:0;letter-spacing:0.5px}
.header p{color:#6B6252;font-size:11px;margin:6px 0 0;letter-spacing:2px;text-transform:uppercase}
.score-band{background:#0A0908;padding:24px 40px;display:flex;align-items:center;gap:24px}
.score-ring{width:64px;height:64px;border-radius:50%;background:conic-gradient(#B89355 ${score * 3.6}deg,rgba(107,98,82,0.3) 0);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.score-inner{width:50px;height:50px;border-radius:50%;background:#0A0908;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#B89355}
.score-label{color:#F4F0E8;font-size:14px;font-weight:600}.score-sub{color:#6B6252;font-size:11px;margin-top:3px}
.body{padding:32px 40px}.body p{color:#333;font-size:14px;line-height:1.7;margin:0 0 16px}
.cta{display:block;background:#B89355;color:#0F0E0D;text-decoration:none;padding:14px 28px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;text-align:center;margin:24px 0}
.cta2{display:block;border:1px solid #B89355;color:#B89355;text-decoration:none;padding:12px 28px;font-size:12px;font-weight:500;text-align:center;margin:12px 0}
.footer{padding:20px 40px;border-top:1px solid #e8e4dc;font-size:10px;color:#999;line-height:1.6}
</style></head><body><div class="wrap">
  <div class="header"><h1>PropertyDNA</h1><p>Market Intelligence · ${city}</p></div>
  <div class="score-band">
    <div class="score-ring"><div class="score-inner">${score}</div></div>
    <div>
      <div class="score-label">${city} Ranked ${score}/100 — ${label}</div>
      <div class="score-sub">Live composite · comps · DOM · permits · livability · rental demand</div>
    </div>
  </div>
  <div class="body">
    <p>Hi ${firstName},</p>
    <p>PropertyDNA just ranked the <strong>${city}</strong> market <strong>${score} out of 100</strong> — a <strong>${label}</strong> signal based on live comparable sales, days on market velocity, permit activity, and rental demand.</p>
    <p>Every property in this market has a unique DNA score. PropertyDNA shows you exactly where the value is, what's driving price movement, and which properties are outperforming their neighbors.</p>
    <p><strong>Your first full property report is free.</strong></p>
    <a href="${SITE_URL}/?ref=agent_campaign&city=${encodeURIComponent(city)}" class="cta">→ See the ${city} Live Ranking</a>
    <a href="${SITE_URL}/market-heatmaps?ref=agent_campaign" class="cta2">View the Live Heat Map</a>
  </div>
  <div class="footer">PropertyDNA · thepropertydna.com · reports@thepropertydna.com<br>
  <a href="${unsub}" style="color:#999">Unsubscribe</a></div>
</div></body></html>`;
}

function buyerHtml(c, campaign) {
  const firstName = c.first_name || 'there';
  const city      = c.city || 'Coachella Valley';
  const score     = c.neighborhood_score || 71;
  const label     = c.score_label || 'Buy';
  const unsub     = `${SITE_URL}/.netlify/functions/campaign-unsubscribe?email=${encodeURIComponent(c.email)}&cid=${c.campaign_id}`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;background:#F4F0E8;font-family:Jost,Helvetica,sans-serif}
.wrap{max-width:580px;margin:0 auto;background:#fff;border:1px solid #e8e4dc}
.header{background:#0F0E0D;padding:32px 40px}.header h1{font-family:Georgia,serif;color:#F4F0E8;font-size:22px;font-weight:400;margin:0;letter-spacing:0.5px}
.header p{color:#6B6252;font-size:11px;margin:6px 0 0;letter-spacing:2px;text-transform:uppercase}
.rank-band{background:#0A0908;padding:24px 40px}
.rank-label{color:#6B6252;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin:0 0 6px}
.rank-value{font-family:Georgia,serif;color:#B89355;font-size:32px;font-weight:400;margin:0;letter-spacing:-0.5px}
.rank-sub{color:#6B6252;font-size:11px;margin-top:6px}
.score-band{display:flex;border-top:1px solid rgba(184,147,85,0.2)}
.score-cell{flex:1;background:#0A0908;padding:16px 20px;border-right:1px solid rgba(184,147,85,0.15);text-align:center}
.score-cell:last-child{border-right:none}.sc-val{font-size:22px;font-weight:700;color:#B89355;font-family:Georgia,serif}
.sc-label{font-size:9px;color:#6B6252;text-transform:uppercase;letter-spacing:1px;margin-top:3px}
.body{padding:32px 40px}.body p{color:#333;font-size:14px;line-height:1.7;margin:0 0 16px}
.cta{display:block;background:#B89355;color:#0F0E0D;text-decoration:none;padding:14px 28px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;text-align:center;margin:24px 0}
.cta2{display:block;border:1px solid rgba(184,147,85,0.5);color:#B89355;text-decoration:none;padding:12px 28px;font-size:12px;font-weight:500;text-align:center;margin:12px 0}
.footer{padding:20px 40px;border-top:1px solid #e8e4dc;font-size:10px;color:#999;line-height:1.6}
</style></head><body><div class="wrap">
  <div class="header"><h1>PropertyDNA</h1><p>Property Intelligence · ${city}</p></div>
  <div class="rank-band">
    <div class="rank-label">Your ${city} Property Ranked</div>
    <div class="rank-value">${score} / 100</div>
    <div class="rank-sub">${label} · Live market composite · Updated daily</div>
  </div>
  <div class="score-band">
    <div class="score-cell"><div class="sc-val">${score}</div><div class="sc-label">DNA Score</div></div>
    <div class="score-cell"><div class="sc-val" style="color:#22c55e">${label}</div><div class="sc-label">Market Signal</div></div>
    <div class="score-cell"><div class="sc-val">Free</div><div class="sc-label">Full Report</div></div>
  </div>
  <div class="body">
    <p>Hi ${firstName},</p>
    <p>PropertyDNA ranked your area in <strong>${city}</strong> at <strong>${score}/100</strong> — a <strong>${label}</strong> signal based on live comparable sales, days on market trends, permit activity, and rental demand.</p>
    <p>Your full PropertyDNA report goes further: property-level comps, flood and hazard exposure, renovation ROI estimate, and a 5-year value trajectory specific to your address.</p>
    <p><strong>Your first full report is free — no card required.</strong></p>
    <a href="${SITE_URL}/?ref=sphere_campaign" class="cta">→ Get Your Free PropertyDNA Report</a>
    <a href="${SITE_URL}/market-heatmaps?ref=sphere_campaign" class="cta2">View the ${city} Live Heat Map</a>
    <p style="font-size:12px;color:#888;margin-top:8px">Takes 60 seconds · AI-generated · Delivered to your inbox</p>
  </div>
  <div class="footer">PropertyDNA · thepropertydna.com · reports@thepropertydna.com<br>
  <a href="${unsub}" style="color:#999">Unsubscribe</a></div>
</div></body></html>`;
}

function getHtml(c, campaign) {
  const tmpl = campaign?.template || campaign?.type || 'agent';
  return (tmpl === 'buyer' || tmpl === 'homeowner') ? buyerHtml(c, campaign) : agentHtml(c, campaign);
}

function getSubject(c, campaign) {
  const city  = c.city || 'Coachella Valley';
  const score = c.neighborhood_score || 71;
  const tmpl  = campaign?.template || campaign?.type || 'agent';
  if (tmpl === 'buyer' || tmpl === 'homeowner') {
    return `Your ${city} Property Ranked ${score}/100 by PropertyDNA`;
  }
  return campaign?.subject || `Your ${city} Property Ranked ${score}/100 by PropertyDNA`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: '{}' };

  const key = event.headers['x-internal-key'] || event.headers['x-admin-key'];
  if (key !== process.env.INTERNAL_API_KEY) return { statusCode: 401, headers: CORS, body: '{"error":"unauthorized"}' };

  const { campaignId } = JSON.parse(event.body || '{}');
  if (!campaignId) return { statusCode: 400, headers: CORS, body: '{"error":"campaignId required"}' };

  // Load campaign
  const campaigns = await db.from('campaigns').select('*').eq('id', campaignId).get();
  const campaign  = campaigns?.[0];
  if (!campaign) return { statusCode: 404, headers: CORS, body: '{"error":"campaign not found"}' };

  if (campaign.status === 'draft') {
    await db.update('campaigns', { id: campaignId }, { status: 'sending', launched_at: new Date().toISOString() }).catch(() => {});
  }

  // Global unsubscribes
  let unsubSet = new Set();
  try {
    const unsubs = await db.from('campaign_unsubscribes').select('email').get();
    if (Array.isArray(unsubs)) unsubs.forEach(u => unsubSet.add(u.email.toLowerCase()));
  } catch { /* non-critical */ }

  // Next pending batch
  const contacts = await db.from('campaign_contacts')
    .select('*').eq('campaign_id', campaignId).eq('status', 'pending')
    .order('created_at', { ascending: true }).limit(BATCH_SIZE).get();

  if (!Array.isArray(contacts) || contacts.length === 0) {
    await db.update('campaigns', { id: campaignId }, { status: 'complete', completed_at: new Date().toISOString() }).catch(() => {});
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ done: true, sent: 0 }) };
  }

  let sent = 0, skipped = 0;
  for (const contact of contacts) {
    if (unsubSet.has((contact.email || '').toLowerCase())) {
      await db.from('campaign_contacts').eq('id', contact.id).update({ status: 'unsubscribed' }).catch(() => {});
      skipped++;
      continue;
    }
    try {
      const result = await resendPost({
        from: `${SENDER_NAME} <${SENDER}>`,
        to: [contact.email],
        subject: getSubject(contact, campaign),
        html: getHtml(contact, campaign),
        tags: [{ name: 'campaign_id', value: campaignId }],
      });
      const ok = result.status < 300;
      await db.from('campaign_contacts').eq('id', contact.id).update({
        status: ok ? 'sent' : 'bounced',
        sent_at: new Date().toISOString(),
        resend_id: ok ? (result.data?.id || null) : null,
      }).catch(() => {});
      if (ok) { sent++; } else { skipped++; }
    } catch {
      await db.from('campaign_contacts').eq('id', contact.id).update({ status: 'skipped' }).catch(() => {});
      skipped++;
    }
    // Pace to avoid Resend rate limits
    await new Promise(r => setTimeout(r, 100));
  }

  // Update sent_count
  const fresh = await db.from('campaigns').select('sent_count').eq('id', campaignId).get();
  const prevSent = fresh?.[0]?.sent_count || 0;
  const newSent  = prevSent + sent;
  const remaining = Math.max(0, (campaign.total_contacts || 0) - newSent);
  await db.update('campaigns', { id: campaignId }, {
    sent_count: newSent,
    ...(remaining <= 0 ? { status: 'complete', completed_at: new Date().toISOString() } : {}),
  }).catch(() => {});

  return {
    statusCode: 200, headers: CORS,
    body: JSON.stringify({ done: remaining <= 0, sent, skipped, remaining }),
  };
};
