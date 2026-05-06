// Receives Resend email event webhooks.
// Registers opens/clicks in DB and queues immediate follow-up for clickers.
const crypto = require('crypto');
const db = require('./_supabase');

const CORS = { 'Content-Type': 'application/json' };

function verifyResendSignature(headers, rawBody, secret) {
  try {
    const msgId   = headers['svix-id'];
    const msgTs   = headers['svix-timestamp'];
    const msgSig  = headers['svix-signature'];
    if (!msgId || !msgTs || !msgSig) return false;

    const toSign  = `${msgId}.${msgTs}.${rawBody}`;
    const key     = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const hmac    = crypto.createHmac('sha256', key).update(toSign).digest('base64');
    const expected = `v1,${hmac}`;

    return msgSig.split(' ').some(sig => sig === expected);
  } catch { return false; }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: '{}' };

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret && !verifyResendSignature(event.headers, event.body, secret)) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid signature' }) };
  }

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
      const firstOpen = !contact.opened_at;
      await db.from('campaign_contacts').eq('id', contact.id).update({
        opened_at: contact.opened_at || now,
        last_event: 'opened',
      }).catch(() => {});
      if (firstOpen) await syncAggregateCounts(contact.campaign_id);
    }

    if (type === 'email.clicked') {
      const firstClick = !contact.clicked_at;
      await db.from('campaign_contacts').eq('id', contact.id).update({
        clicked_at: contact.clicked_at || now,
        opened_at: contact.opened_at || now,
        last_event: 'clicked',
      }).catch(() => {});
      if (firstClick) await syncAggregateCounts(contact.campaign_id);

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
      await syncAggregateCounts(contact.campaign_id);
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

    // Step 3: 7-day cold — final push, market urgency
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

    // Step 4: Day 10 — market insight (blog content, "what's moving values")
    4: {
      subject: `What's actually moving values in ${city} right now`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;background:#F4F0E8;font-family:Jost,Helvetica,sans-serif}
.wrap{max-width:580px;margin:0 auto;background:#fff;border:1px solid #e8e4dc}
.header{background:#0F0E0D;padding:28px 40px}.header h1{font-family:Georgia,serif;color:#F4F0E8;font-size:20px;font-weight:400;margin:0}
.header p{color:#6B6252;font-size:10px;margin:5px 0 0;letter-spacing:2px;text-transform:uppercase}
.divider{height:3px;background:linear-gradient(90deg,#B89355,#8B6A2E)}
.body{padding:32px 40px}.body p{color:#333;font-size:14px;line-height:1.7;margin:0 0 16px}
.insight{background:#F9F7F2;border-left:3px solid #B89355;padding:14px 20px;margin:20px 0}
.insight p{margin:0;font-size:13px;color:#444;line-height:1.6}
.cta{display:block;background:#0F0E0D;color:#F4F0E8;text-decoration:none;padding:14px 28px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;text-align:center;margin:24px 0}
.footer{padding:18px 40px;border-top:1px solid #e8e4dc;font-size:10px;color:#999}
</style></head><body><div class="wrap">
<div class="header"><h1>PropertyDNA</h1><p>Market Intelligence · ${city}</p></div>
<div class="divider"></div>
<div class="body">
  <p>Hi ${firstName},</p>
  <p>Three data points PropertyDNA is tracking in <strong>${city}</strong> this month that most homeowners don't see coming:</p>
  <div class="insight"><p><strong>1. Permit velocity is up 22%.</strong> Properties that received ADU or kitchen permits in the last 90 days are pricing 8–14% above their unimproved neighbors at list.</p></div>
  <div class="insight"><p><strong>2. Insurance-driven repricing.</strong> Climate risk scoring changes in CA are creating value gaps between similar addresses — your exposure matters more than ever.</p></div>
  <div class="insight"><p><strong>3. Days on market compression.</strong> The top third of ${city} properties by DNA score are moving in under 18 days. Bottom third: 60+ days.</p></div>
  <p>Your PropertyDNA report shows exactly where your property falls in each of these signals — free, your address, delivered in minutes.</p>
  <a href="${SITE_URL}/?ref=drip4_insight" class="cta">→ Get My Property Intelligence Report</a>
</div>
<div class="footer">PropertyDNA · thepropertydna.com · <a href="${unsub}" style="color:#999">Unsubscribe</a></div>
</div></body></html>`,
    },

    // Step 5: Day 14 — social proof / homeowner story
    5: {
      subject: `What a ${city} homeowner discovered about their property`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;background:#F4F0E8;font-family:Jost,Helvetica,sans-serif}
.wrap{max-width:580px;margin:0 auto;background:#fff;border:1px solid #e8e4dc}
.header{background:#0F0E0D;padding:28px 40px}.header h1{font-family:Georgia,serif;color:#F4F0E8;font-size:20px;font-weight:400;margin:0}
.header p{color:#6B6252;font-size:10px;margin:5px 0 0;letter-spacing:2px;text-transform:uppercase}
.quote{background:#0A0908;padding:24px 40px}
.quote p{font-family:Georgia,serif;font-size:16px;color:#F4F0E8;line-height:1.6;margin:0;font-style:italic}
.quote .attr{font-family:Jost,sans-serif;font-size:10px;color:#6B6252;margin-top:12px;letter-spacing:1px;text-transform:uppercase}
.body{padding:32px 40px}.body p{color:#333;font-size:14px;line-height:1.7;margin:0 0 16px}
.cta{display:block;background:#B89355;color:#0F0E0D;text-decoration:none;padding:14px 28px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;text-align:center;margin:24px 0}
.footer{padding:18px 40px;border-top:1px solid #e8e4dc;font-size:10px;color:#999}
</style></head><body><div class="wrap">
<div class="header"><h1>PropertyDNA</h1><p>Owner Story · ${city}</p></div>
<div class="quote">
  <p>"I assumed my property was in the middle of the pack. PropertyDNA showed me it was actually in the top 18% for rental demand and had a renovation ROI signal I wasn't aware of. I repositioned my asking price before listing."</p>
  <div class="attr">— ${city} Homeowner, PropertyDNA User</div>
</div>
<div class="body">
  <p>Hi ${firstName},</p>
  <p>Most people don't know their property's real position in the market until they're already in a transaction — by which point leverage is limited.</p>
  <p>PropertyDNA gives you that picture <strong>before</strong> any decision: whether you're thinking about listing, refinancing, renovating, or just want to know what the data says about your home's trajectory.</p>
  <p>Your ranking is <strong>${score}/100</strong>. The full report tells you why — and what moves it.</p>
  <a href="${SITE_URL}/?ref=drip5_proof" class="cta">→ See My Full Property Report (Free)</a>
</div>
<div class="footer">PropertyDNA · thepropertydna.com · <a href="${unsub}" style="color:#999">Unsubscribe</a></div>
</div></body></html>`,
    },

    // Step 6: Day 17 — value unlock (3 things that move the needle)
    6: {
      subject: `3 things that could move your ${city} property value`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;background:#F4F0E8;font-family:Jost,Helvetica,sans-serif}
.wrap{max-width:580px;margin:0 auto;background:#fff;border:1px solid #e8e4dc}
.header{background:#0F0E0D;padding:28px 40px}.header h1{font-family:Georgia,serif;color:#F4F0E8;font-size:20px;font-weight:400;margin:0}
.header p{color:#6B6252;font-size:10px;margin:5px 0 0;letter-spacing:2px;text-transform:uppercase}
.body{padding:32px 40px}.body p{color:#333;font-size:14px;line-height:1.7;margin:0 0 16px}
.item{display:flex;gap:16px;margin:16px 0;align-items:flex-start}
.num{background:#B89355;color:#0F0E0D;font-family:Georgia,serif;font-size:18px;font-weight:700;width:36px;height:36px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.item-body{font-size:13px;color:#333;line-height:1.6}
.item-body strong{color:#0F0E0D}
.cta{display:block;background:#B89355;color:#0F0E0D;text-decoration:none;padding:14px 28px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;text-align:center;margin:28px 0}
.footer{padding:18px 40px;border-top:1px solid #e8e4dc;font-size:10px;color:#999}
</style></head><body><div class="wrap">
<div class="header"><h1>PropertyDNA</h1><p>Value Intelligence · ${city}</p></div>
<div class="body">
  <p>Hi ${firstName},</p>
  <p>PropertyDNA scores thousands of data points per property. Here are the three highest-leverage factors for <strong>${city}</strong> owners right now:</p>
  <div class="item"><div class="num">1</div><div class="item-body"><strong>Permit history.</strong> Properties with permitted work in the last 24 months transact 11% faster and at higher multiples — even minor kitchen and bathroom permits signal maintained-asset status to buyers and appraisers.</div></div>
  <div class="item"><div class="num">2</div><div class="item-body"><strong>Rental demand trajectory.</strong> Short-term rental demand in ${city} is tracking up 19% YoY. If your property sits in a zone with favorable STR regulations, your upside story is stronger than your assessed value suggests.</div></div>
  <div class="item"><div class="num">3</div><div class="item-body"><strong>Flood/climate risk delta.</strong> Insurance repricing is creating divergence between similar properties. Low-risk properties in your zip are commanding premiums that didn't exist 18 months ago.</div></div>
  <p>Your PropertyDNA report shows all three of these signals for your specific address — free, instant, no strings.</p>
  <a href="${SITE_URL}/?ref=drip6_value" class="cta">→ Unlock My Full Property Analysis</a>
</div>
<div class="footer">PropertyDNA · thepropertydna.com · <a href="${unsub}" style="color:#999">Unsubscribe</a></div>
</div></body></html>`,
    },

    // Step 7: Day 21 — personal note from Dan
    7: {
      subject: `A personal note about your ${city} property`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;background:#F4F0E8;font-family:Jost,Helvetica,sans-serif}
.wrap{max-width:580px;margin:0 auto;background:#fff;border:1px solid #e8e4dc}
.header{background:#0F0E0D;padding:28px 40px}.header h1{font-family:Georgia,serif;color:#F4F0E8;font-size:20px;font-weight:400;margin:0}
.body{padding:32px 40px}.body p{color:#333;font-size:14px;line-height:1.8;margin:0 0 18px}
.sig{margin-top:28px;padding-top:18px;border-top:1px solid #e8e4dc;font-size:13px;color:#555;line-height:1.6}
.cta{display:inline-block;background:#0F0E0D;color:#F4F0E8;text-decoration:none;padding:12px 24px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin:8px 0}
.footer{padding:18px 40px;border-top:1px solid #e8e4dc;font-size:10px;color:#999}
</style></head><body><div class="wrap">
<div class="header"><h1>PropertyDNA</h1></div>
<div class="body">
  <p>Hi ${firstName},</p>
  <p>I wanted to reach out directly. PropertyDNA sent you a market ranking for your ${city} property a few weeks back — I'm following up personally because I genuinely think there's insight in your report worth having.</p>
  <p>We built PropertyDNA to give property owners the same data-driven picture that institutional investors use. Not a Zestimate. Not an AVM. A full intelligence stack: permit signals, climate exposure, rental demand, comp velocity — all mapped to your specific address.</p>
  <p>If you've got questions about your property's ranking or what the data means, just reply to this email. I read every response.</p>
  <p>And if you haven't pulled your free report yet — it takes 60 seconds.</p>
  <a href="${SITE_URL}/?ref=drip7_personal" class="cta">Get My Free Report →</a>
  <div class="sig">
    Dan Stuart<br>
    Founder, PropertyDNA<br>
    stuartteamps@gmail.com
  </div>
</div>
<div class="footer">PropertyDNA · thepropertydna.com · <a href="${unsub}" style="color:#999">Unsubscribe</a></div>
</div></body></html>`,
    },

    // Step 8: Day 28 — final offer + referral
    8: {
      subject: `Last message — and a question about your property`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;background:#F4F0E8;font-family:Jost,Helvetica,sans-serif}
.wrap{max-width:580px;margin:0 auto;background:#fff;border:1px solid #e8e4dc}
.header{background:#0F0E0D;padding:28px 40px}.header h1{font-family:Georgia,serif;color:#F4F0E8;font-size:20px;font-weight:400;margin:0}
.body{padding:32px 40px}.body p{color:#333;font-size:14px;line-height:1.8;margin:0 0 18px}
.offer{background:#0A0908;padding:20px 40px;text-align:center}
.offer p{color:#F4F0E8;font-size:13px;margin:0 0 14px;line-height:1.6}
.offer .tag{display:inline-block;background:#B89355;color:#0F0E0D;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:4px 12px;margin-bottom:10px}
.cta{display:block;background:#B89355;color:#0F0E0D;text-decoration:none;padding:14px 28px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;text-align:center;margin:24px 0}
.footer{padding:18px 40px;border-top:1px solid #e8e4dc;font-size:10px;color:#999}
</style></head><body><div class="wrap">
<div class="header"><h1>PropertyDNA</h1></div>
<div class="offer">
  <div class="tag">One-Time Offer</div>
  <p>Get your full PropertyDNA report <strong>free</strong> — plus a 15-minute market positioning call with our team if you're considering any property decision in the next 6 months.</p>
</div>
<div class="body">
  <p>Hi ${firstName},</p>
  <p>This is our last outreach — we don't want to overstay our welcome. But before we go, two things:</p>
  <p><strong>1. Your free report is still waiting.</strong> If you ever want to know exactly where your ${city} property stands in the current market, the link below takes 60 seconds.</p>
  <p><strong>2. Know someone who should know this data?</strong> If a neighbor, family member, or colleague owns property in ${city}, send them to thepropertydna.com. Their free report could be the most valuable thing they read this month.</p>
  <a href="${SITE_URL}/?ref=drip8_final" class="cta">→ Get My Free PropertyDNA Report</a>
  <p style="font-size:11px;color:#999">No card required · Delivered in minutes · Unsubscribe below if you'd prefer no further contact.</p>
</div>
<div class="footer">PropertyDNA · thepropertydna.com · <a href="${unsub}" style="color:#999">Unsubscribe</a></div>
</div></body></html>`,
    },
  };

  const tmpl = templates[step];
  if (!tmpl) return;

  const body = JSON.stringify({
    from: `PropertyDNA <${SENDER}>`,
    reply_to: process.env.OWNER_EMAIL || 'stuartteamps@gmail.com',
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

// Reads real counts from campaign_contacts and syncs them to campaigns table
async function syncAggregateCounts(campaignId) {
  try {
    const contacts = await db.from('campaign_contacts')
      .select('status,opened_at,clicked_at')
      .eq('campaign_id', campaignId)
      .get();
    if (!Array.isArray(contacts)) return;

    const counts = contacts.reduce((acc, c) => {
      if (c.opened_at) acc.opened_count++;
      if (c.clicked_at) acc.clicked_count++;
      if (c.status === 'bounced') acc.bounced_count++;
      if (c.status === 'unsubscribed') acc.unsubscribed_count++;
      return acc;
    }, { opened_count: 0, clicked_count: 0, bounced_count: 0, unsubscribed_count: 0 });

    await db.from('campaigns').eq('id', campaignId).update(counts).catch(() => {});
  } catch {}
}

module.exports.sendFollowUp = sendFollowUp;
