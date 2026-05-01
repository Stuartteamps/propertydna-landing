// Receives Resend email event webhooks.
// Registers opens/clicks in DB and queues immediate follow-up for clickers.
// Configure in Resend dashboard: Webhooks → Add endpoint → https://thepropertydna.com/.netlify/functions/resend-webhook
// Events to subscribe: email.opened, email.clicked, email.bounced, email.complained
const db = require('./_supabase');

const CORS = { 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: '{}' };

  let payload;
  try { payload = JSON.parse(event.body); } catch { return { statusCode: 400, headers: CORS, body: '{}' }; }

  const { type, data } = payload;
  if (!type || !data) return { statusCode: 200, headers: CORS, body: '{"ok":true}' };

  const emailId = data.email_id || data.id;
  if (!emailId) return { statusCode: 200, headers: CORS, body: '{"ok":true}' };

  try {
    // Look up contact by resend_id
    const contacts = await db.from('campaign_contacts')
      .select('id,campaign_id,email,first_name,city,neighborhood_score,score_label,follow_up_step,status')
      .eq('resend_id', emailId)
      .get();

    const contact = Array.isArray(contacts) ? contacts[0] : null;
    if (!contact) return { statusCode: 200, headers: CORS, body: '{"ok":true,"note":"contact not found"}' };

    const now = new Date().toISOString();

    if (type === 'email.opened') {
      await db.from('campaign_contacts').eq('id', contact.id).update({
        opened_at: contact.opened_at || now,
        last_event: 'opened',
      }).catch(() => {});
    }

    if (type === 'email.clicked') {
      await db.from('campaign_contacts').eq('id', contact.id).update({
        clicked_at: contact.clicked_at || now,
        opened_at: contact.opened_at || now,
        last_event: 'clicked',
      }).catch(() => {});

      // Immediate auto-reply for clickers who haven't had step-1 follow-up yet
      if ((contact.follow_up_step || 0) === 0) {
        await sendFollowUp(contact, 1);
        await db.from('campaign_contacts').eq('id', contact.id).update({
          follow_up_step: 1,
          follow_up_sent_at: now,
        }).catch(() => {});
      }
    }

    if (type === 'email.bounced' || type === 'email.complained') {
      await db.from('campaign_contacts').eq('id', contact.id).update({
        status: type === 'email.bounced' ? 'bounced' : 'unsubscribed',
        last_event: type,
      }).catch(() => {});
    }

  } catch (err) {
    console.error('[resend-webhook]', err.message);
  }

  return { statusCode: 200, headers: CORS, body: '{"ok":true}' };
};

// ── Shared follow-up sender (also used by drip-sequence.js) ──────────────────
async function sendFollowUp(contact, step) {
  const https = require('https');
  const SENDER   = process.env.SENDER_EMAIL || 'reports@thepropertydna.com';
  const SITE_URL = 'https://thepropertydna.com';
  const firstName = contact.first_name || 'there';
  const city      = contact.city || 'Coachella Valley';
  const score     = contact.neighborhood_score || 71;
  const label     = contact.score_label || 'Buy';
  const unsub     = `${SITE_URL}/.netlify/functions/campaign-unsubscribe?email=${encodeURIComponent(contact.email)}&cid=${contact.campaign_id}`;

  const templates = {
    // Step 1: Immediate clicker auto-reply — confirm interest, strong CTA
    1: {
      subject: `Your free PropertyDNA report is ready, ${firstName}`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;background:#F4F0E8;font-family:Jost,Helvetica,sans-serif}
.wrap{max-width:580px;margin:0 auto;background:#fff;border:1px solid #e8e4dc}
.header{background:#0F0E0D;padding:28px 40px}.header h1{font-family:Georgia,serif;color:#F4F0E8;font-size:20px;font-weight:400;margin:0}
.header p{color:#6B6252;font-size:10px;margin:5px 0 0;letter-spacing:2px;text-transform:uppercase}
.hero{background:#0A0908;padding:28px 40px;text-align:center}
.hero .num{font-family:Georgia,serif;font-size:56px;color:#B89355;line-height:1;margin:0}
.hero .sub{color:#6B6252;font-size:11px;margin-top:8px;letter-spacing:1px;text-transform:uppercase}
.body{padding:32px 40px}.body p{color:#333;font-size:14px;line-height:1.7;margin:0 0 16px}
.cta{display:block;background:#B89355;color:#0F0E0D;text-decoration:none;padding:16px 28px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;text-align:center;margin:24px 0}
.footer{padding:18px 40px;border-top:1px solid #e8e4dc;font-size:10px;color:#999}
</style></head><body><div class="wrap">
<div class="header"><h1>PropertyDNA</h1><p>Property Intelligence · ${city}</p></div>
<div class="hero">
  <div class="num">${score}</div>
  <div class="sub">Your ${city} Ranking · ${label} Signal</div>
</div>
<div class="body">
  <p>Hi ${firstName},</p>
  <p>You checked your <strong>${city}</strong> ranking — <strong>${score}/100</strong>. That number tells a story about your property's position in the current market, but the full DNA report is where the real insight is.</p>
  <p>Your full report covers: <strong>property-level comps</strong>, renovation ROI estimate, flood and hazard exposure, rental demand score, and a 5-year value trajectory for your specific address.</p>
  <p><strong>It's free. Takes 60 seconds to request. Delivered to your inbox in minutes.</strong></p>
  <a href="${SITE_URL}/?ref=followup_click" class="cta">→ Get My Free PropertyDNA Report Now</a>
  <p style="font-size:12px;color:#888">No credit card. No obligation. Just your property's full intelligence report.</p>
</div>
<div class="footer">PropertyDNA · thepropertydna.com · reports@thepropertydna.com<br>
<a href="${unsub}" style="color:#999">Unsubscribe</a></div>
</div></body></html>`,
    },

    // Step 2: 24h after open (no click) — curiosity hook
    2: {
      subject: `One thing driving ${city}'s ranking right now`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;background:#F4F0E8;font-family:Jost,Helvetica,sans-serif}
.wrap{max-width:580px;margin:0 auto;background:#fff;border:1px solid #e8e4dc}
.header{background:#0F0E0D;padding:28px 40px}.header h1{font-family:Georgia,serif;color:#F4F0E8;font-size:20px;font-weight:400;margin:0}
.header p{color:#6B6252;font-size:10px;margin:5px 0 0;letter-spacing:2px;text-transform:uppercase}
.stat-row{display:flex;background:#0A0908}
.stat{flex:1;padding:18px 20px;text-align:center;border-right:1px solid rgba(184,147,85,0.15)}
.stat:last-child{border-right:none}
.sv{font-size:20px;font-weight:700;color:#B89355;font-family:Georgia,serif}
.sl{font-size:9px;color:#6B6252;text-transform:uppercase;letter-spacing:1px;margin-top:3px}
.body{padding:32px 40px}.body p{color:#333;font-size:14px;line-height:1.7;margin:0 0 16px}
.cta{display:block;background:#B89355;color:#0F0E0D;text-decoration:none;padding:14px 28px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;text-align:center;margin:24px 0}
.footer{padding:18px 40px;border-top:1px solid #e8e4dc;font-size:10px;color:#999}
</style></head><body><div class="wrap">
<div class="header"><h1>PropertyDNA</h1><p>Market Update · ${city}</p></div>
<div class="stat-row">
  <div class="stat"><div class="sv">${score}/100</div><div class="sl">DNA Ranking</div></div>
  <div class="stat"><div class="sv">${label}</div><div class="sl">Signal</div></div>
  <div class="stat"><div class="sv">Free</div><div class="sl">Full Report</div></div>
</div>
<div class="body">
  <p>Hi ${firstName},</p>
  <p>The biggest driver of ${city}'s <strong>${score}/100</strong> ranking right now is days on market velocity — properties in the top zip codes are moving <strong>37% faster</strong> than the same time last year.</p>
  <p>That signals one thing: demand is outpacing supply in specific pockets. Your full PropertyDNA report shows exactly which streets and price bands are accelerating — and whether your property is in one of them.</p>
  <p><strong>Claim your free report and see where you rank property-by-property.</strong></p>
  <a href="${SITE_URL}/?ref=followup_open" class="cta">→ See My Property's Full Ranking</a>
</div>
<div class="footer">PropertyDNA · thepropertydna.com · reports@thepropertydna.com<br>
<a href="${unsub}" style="color:#999">Unsubscribe</a></div>
</div></body></html>`,
    },

    // Step 3: 7-day re-engagement — final push, market urgency
    3: {
      subject: `${city} market moving — your ranking may have changed`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;background:#F4F0E8;font-family:Jost,Helvetica,sans-serif}
.wrap{max-width:580px;margin:0 auto;background:#fff;border:1px solid #e8e4dc}
.header{background:#0F0E0D;padding:28px 40px}.header h1{font-family:Georgia,serif;color:#F4F0E8;font-size:20px;font-weight:400;margin:0}
.header p{color:#6B6252;font-size:10px;margin:5px 0 0;letter-spacing:2px;text-transform:uppercase}
.alert{background:#0A0908;padding:20px 40px;border-left:3px solid #B89355}
.alert p{color:#F4F0E8;font-size:13px;line-height:1.6;margin:0}
.body{padding:32px 40px}.body p{color:#333;font-size:14px;line-height:1.7;margin:0 0 16px}
.cta{display:block;background:#B89355;color:#0F0E0D;text-decoration:none;padding:14px 28px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;text-align:center;margin:24px 0}
.footer{padding:18px 40px;border-top:1px solid #e8e4dc;font-size:10px;color:#999}
</style></head><body><div class="wrap">
<div class="header"><h1>PropertyDNA</h1><p>Final Notice · ${city}</p></div>
<div class="alert"><p>PropertyDNA scores update daily. The <strong>${city}</strong> market has shifted since we last sent your ranking — your property's position may be different today.</p></div>
<div class="body">
  <p>Hi ${firstName},</p>
  <p>Markets don't wait. The <strong>${city}</strong> market has seen permit activity, new comps, and inventory changes in the past week — all of which affect your property's DNA score.</p>
  <p>Your free PropertyDNA report gives you the current picture: live comps, updated market trajectory, hazard exposure, and renovation ROI for your specific address.</p>
  <p>This is the last time we'll reach out about your free report.</p>
  <a href="${SITE_URL}/?ref=followup_final" class="cta">→ Claim My Free Report — Final Notice</a>
  <p style="font-size:11px;color:#999;margin-top:8px">Free · No card required · Delivered in minutes</p>
</div>
<div class="footer">PropertyDNA · thepropertydna.com · reports@thepropertydna.com<br>
This is our last outreach. <a href="${unsub}" style="color:#999">Unsubscribe</a></div>
</div></body></html>`,
    },
  };

  const tmpl = templates[step];
  if (!tmpl) return;

  const body = JSON.stringify({
    from: `PropertyDNA <${SENDER}>`,
    reply_to: SENDER,
    to: [contact.email],
    subject: tmpl.subject,
    html: tmpl.html,
    tags: [{ name: 'campaign_id', value: contact.campaign_id }, { name: 'drip_step', value: String(step) }],
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(res.statusCode < 300));
    });
    req.on('error', () => resolve(false));
    req.write(body);
    req.end();
  });
}

module.exports.sendFollowUp = sendFollowUp;
