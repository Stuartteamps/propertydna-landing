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
const SENDER_NAME = 'Dan Stuart | PropertyDNA';
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
  const city      = c.city || 'your market';
  const score     = c.neighborhood_score || 68;
  const label     = c.score_label || 'Buy';
  const unsub     = `${SITE_URL}/.netlify/functions/unsubscribe?e=${Buffer.from(c.email).toString('base64')}&c=${c.campaign_id}`;

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
  <div class="header"><h1>PropertyDNA</h1><p>Market Intelligence · California</p></div>
  <div class="score-band">
    <div class="score-ring"><div class="score-inner">${score}</div></div>
    <div>
      <div class="score-label">${city} DNA Score: ${score}/100 — ${label}</div>
      <div class="score-sub">Real-time composite · comps · DOM · permits · livability · rental demand</div>
    </div>
  </div>
  <div class="body">
    <p>Hi ${firstName},</p>
    <p>The <strong>${city}</strong> market just scored <strong>${score}/100</strong> on PropertyDNA's intelligence index — ranking it <strong>${label}</strong> based on current comparable sales, days on market velocity, permit activity, and rental demand signals.</p>
    <p>We built PropertyDNA to give agents like you a data edge your clients can't get anywhere else. Every buyer and seller you work with gets a personalized DNA report — covering their specific property's comps, hazard exposure, renovation ROI, and 5-year trajectory.</p>
    <p><strong>The first report for every one of your clients is free.</strong></p>
    <a href="${SITE_URL}/?ref=agent_campaign&city=${encodeURIComponent(city)}" class="cta">→ See the ${city} Live Heat Map</a>
    <a href="${SITE_URL}/?ref=agent_partner" class="cta2">Partner with PropertyDNA — offer free reports to your clients</a>
  </div>
  <div class="footer">PropertyDNA · thepropertydna.com · reports@thepropertydna.com<br>
  You're receiving this because you're a licensed real estate professional in California.<br>
  <a href="${unsub}" style="color:#999">Unsubscribe</a></div>
</div></body></html>`;
}

function buyerHtml(c, campaign) {
  const firstName = c.first_name || 'there';
  const address   = c.address || `your property in ${c.city || 'California'}`;
  const city      = c.city || 'your area';
  const score     = c.neighborhood_score || 68;
  const label     = c.score_label || 'Buy';
  const unsub     = `${SITE_URL}/.netlify/functions/unsubscribe?e=${Buffer.from(c.email).toString('base64')}&c=${c.campaign_id}`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;background:#F4F0E8;font-family:Jost,Helvetica,sans-serif}
.wrap{max-width:580px;margin:0 auto;background:#fff;border:1px solid #e8e4dc}
.header{background:#0F0E0D;padding:32px 40px}.header h1{font-family:Georgia,serif;color:#F4F0E8;font-size:22px;font-weight:400;margin:0}
.header p{color:#6B6252;font-size:11px;margin:6px 0 0;letter-spacing:2px;text-transform:uppercase}
.address-band{background:#0A0908;padding:20px 40px}
.address-band p{color:#6B6252;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px}
.address-band h2{color:#F4F0E8;font-family:Georgia,serif;font-size:18px;font-weight:400;margin:0}
.score-band{display:flex;gap:0;border-top:1px solid rgba(184,147,85,0.2)}
.score-cell{flex:1;background:#0A0908;padding:16px 20px;border-right:1px solid rgba(184,147,85,0.15);text-align:center}
.score-cell:last-child{border-right:none}.sc-val{font-size:22px;font-weight:700;color:#B89355;font-family:Georgia,serif}
.sc-label{font-size:9px;color:#6B6252;text-transform:uppercase;letter-spacing:1px;margin-top:3px}
.body{padding:32px 40px}.body p{color:#333;font-size:14px;line-height:1.7;margin:0 0 16px}
.cta{display:block;background:#B89355;color:#0F0E0D;text-decoration:none;padding:14px 28px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;text-align:center;margin:24px 0}
.footer{padding:20px 40px;border-top:1px solid #e8e4dc;font-size:10px;color:#999;line-height:1.6}
</style></head><body><div class="wrap">
  <div class="header"><h1>PropertyDNA</h1><p>Property Intelligence · California</p></div>
  <div class="address-band"><p>Analysis for</p><h2>${address}</h2></div>
  <div class="score-band">
    <div class="score-cell"><div class="sc-val">${score}</div><div class="sc-label">Neighborhood Score</div></div>
    <div class="score-cell"><div class="sc-val" style="color:#22c55e">${label}</div><div class="sc-label">DNA Rating</div></div>
    <div class="score-cell"><div class="sc-val">Free</div><div class="sc-label">Full Report</div></div>
  </div>
  <div class="body">
    <p>Hi ${firstName},</p>
    <p>We analyzed <strong>${city}</strong> and your neighborhood scores <strong>${score}/100</strong> — ranked <strong>${label}</strong> based on live comparable sales, days on market trends, permit activity, and rental demand.</p>
    <p>Your full PropertyDNA report goes deeper: specific comps for your property, flood and hazard exposure, renovation ROI estimate, and a 5-year value trajectory.</p>
    <p><strong>Your first full report is completely free.</strong></p>
    <a href="${SITE_URL}/?address=${encodeURIComponent(address)}&ref=homeowner_campaign" class="cta">→ Claim Your Free DNA Report</a>
  </div>
  <div class="footer">PropertyDNA · thepropertydna.com<br>
  You're receiving this because you own property in California.<br>
  <a href="${unsub}" style="color:#999">Unsubscribe</a></div>
</div></body></html>`;
}

function getHtml(c, campaign) {
  const tmpl = campaign?.template || campaign?.type || 'agent';
  return (tmpl === 'buyer' || tmpl === 'homeowner') ? buyerHtml(c, campaign) : agentHtml(c, campaign);
}

function getSubject(c, campaign) {
  const city      = c.city || 'your market';
  const score     = c.neighborhood_score || 68;
  const firstName = c.first_name ? `, ${c.first_name}` : '';
  const tmpl      = campaign?.template || campaign?.type || 'agent';
  if (tmpl === 'buyer' || tmpl === 'homeowner') {
    return `Your ${c.address ? c.address.split(',')[0] : city} neighborhood scored ${score}/100`;
  }
  return campaign?.subject || `${city} DNA Score: ${score}/100${firstName} — see what it means`;
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
