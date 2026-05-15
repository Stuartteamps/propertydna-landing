#!/usr/bin/env node
/**
 * PropertyDNA — Luxury Outreach Sender
 *
 * Sends personalized dossier-anchored cold emails via Resend.
 *
 * Modes:
 *   --test           Send ALL drafts to stuartteamps@gmail.com (no real recipients)
 *   --target <email> Send the next pending draft to a specific email
 *   --batch <file>   Send to a list of {email, first_name, draft_id?} from a JSON file
 *   --dry-run        Print what would be sent, don't actually send
 *
 * Rate limit: 1 email every 12 seconds (5/min, 300/hour cap).
 *
 * Tracks sends in tools/data/luxury-outreach-sent.json so we never double-send.
 */

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const DRAFTS_FILE = path.join(__dirname, 'data/luxury-outreach-drafts.json');
const NEIGHBORHOOD_DRAFTS = path.join(__dirname, 'data/neighborhood-outreach-drafts.json');
const SENT_LOG = path.join(__dirname, 'data/luxury-outreach-sent.json');

const RESEND_KEY = process.env.RESEND_API_KEY || '';
const FROM = 'Dan Stuart <dan@mail.thepropertydna.com>';
const REPLY_TO = 'stuartteamps@gmail.com';

const args = process.argv.slice(2);
const TEST_MODE = args.includes('--test');
const DRY_RUN   = args.includes('--dry-run');
const targetArg = args.indexOf('--target');
const TARGET    = targetArg >= 0 ? args[targetArg + 1] : null;
const batchArg  = args.indexOf('--batch');
const BATCH     = batchArg >= 0 ? args[batchArg + 1] : null;

if (!RESEND_KEY && !DRY_RUN) {
  console.error('Missing RESEND_API_KEY. Get with: netlify env:get RESEND_API_KEY');
  process.exit(1);
}

function loadSent() {
  if (fs.existsSync(SENT_LOG)) return JSON.parse(fs.readFileSync(SENT_LOG, 'utf8'));
  return { sends: [] };
}
function saveSent(state) { fs.writeFileSync(SENT_LOG, JSON.stringify(state, null, 2)); }

function bodyToHtml(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/(https?:\/\/[^\s)<]+)/g, '<a href="$1" style="color:#b88a00;">$1</a>')
    .replace(/\n\n/g, '</p><p style="margin:0 0 14px;">')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p style="margin:0 0 14px;">')
    .replace(/$/, '</p>');
}

function htmlEmail(textBody) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f7f7f4;font-family:Georgia,serif;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background:#f7f7f4;padding:32px 16px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.04);overflow:hidden;">
        <tr><td style="background:#0a0a0a;padding:24px 32px;">
          <div style="color:#fbbf24;font-family:-apple-system,sans-serif;font-size:11px;letter-spacing:4px;text-transform:uppercase;font-weight:600;">PropertyDNA</div>
          <div style="color:#fafafa;font-family:Georgia,serif;font-size:18px;margin-top:6px;">Luxury Home Provenance Intelligence</div>
        </td></tr>
        <tr><td style="padding:32px;font-family:-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;">
          ${bodyToHtml(textBody)}
        </td></tr>
        <tr><td style="background:#f9fafb;padding:18px 32px;font-family:-apple-system,sans-serif;font-size:12px;color:#64748b;border-top:1px solid #e5e7eb;">
          Dan Stuart · Stuart Team Real Estate · Palm Springs, CA<br>
          <a href="https://www.thepropertydna.com" style="color:#64748b;">thepropertydna.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function resendSend(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const r = https.request({
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ s: res.statusCode, d: JSON.parse(d) }); } catch { resolve({ s: res.statusCode, d }); } });
    });
    r.on('error', reject);
    r.write(body); r.end();
  });
}

async function sendOne(toEmail, firstName, draft) {
  const body = draft.body.replace(/\{\{first_name\}\}/g, firstName || 'there');
  const subject = draft.subject;

  if (DRY_RUN) {
    console.log(`\n— DRY RUN —`);
    console.log(`To: ${toEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(`---\n${body.slice(0, 400)}...`);
    return { dry: true };
  }

  const res = await resendSend({
    from: FROM,
    to: toEmail,
    reply_to: REPLY_TO,
    subject,
    text: body,
    html: htmlEmail(body),
    tags: [
      { name: 'campaign', value: 'luxury_outreach' },
      { name: 'draft_id', value: String(draft.apn || draft.neighborhood || 'unknown').slice(0, 40) },
    ],
  });
  return res;
}

(async () => {
  const luxuryDrafts = JSON.parse(fs.readFileSync(DRAFTS_FILE, 'utf8'));
  const hoodDrafts = fs.existsSync(NEIGHBORHOOD_DRAFTS) ? JSON.parse(fs.readFileSync(NEIGHBORHOOD_DRAFTS, 'utf8')) : [];
  const allDrafts = [...luxuryDrafts, ...hoodDrafts];
  const sent = loadSent();

  console.log(`\n${TEST_MODE ? '🧪 TEST MODE — sending to stuartteamps@gmail.com\n' : ''}` +
              `${DRY_RUN ? '— DRY RUN (no actual sends)\n' : ''}` +
              `${allDrafts.length} drafts available (${luxuryDrafts.length} property + ${hoodDrafts.length} neighborhood)`);

  let toSend = [];
  if (TEST_MODE) {
    // Send the top 3 luxury drafts (highest provenance score) to Dan
    toSend = luxuryDrafts.slice(0, 3).map(d => ({ email: 'stuartteamps@gmail.com', first_name: 'Dan', draft: d }));
  } else if (TARGET) {
    const pending = allDrafts.find(d => !sent.sends.some(s => s.email === TARGET && (s.draft_id === d.apn || s.draft_id === d.neighborhood)));
    if (!pending) { console.log('No pending drafts for that target'); return; }
    toSend = [{ email: TARGET, first_name: TARGET.split('@')[0], draft: pending }];
  } else if (BATCH) {
    const targets = JSON.parse(fs.readFileSync(BATCH, 'utf8'));
    toSend = targets.slice(0, 10).map(t => {
      const draft = allDrafts.find(d => (d.apn && d.apn === t.draft_id) || (d.neighborhood && d.neighborhood === t.draft_id)) || luxuryDrafts[0];
      return { email: t.email, first_name: t.first_name || t.email.split('@')[0], draft };
    });
  } else {
    console.log('No mode specified. Use --test, --target <email>, or --batch <file>.');
    return;
  }

  console.log(`\nSending ${toSend.length} email(s)…\n`);

  let okCount = 0, failCount = 0;
  for (let i = 0; i < toSend.length; i++) {
    const { email, first_name, draft } = toSend[i];
    process.stdout.write(`  [${i + 1}/${toSend.length}] ${email}: ${draft.subject?.slice(0, 60)}… `);
    const r = await sendOne(email, first_name, draft);
    if (r.dry) { console.log('(dry run)'); }
    else if (r.s < 300) {
      okCount++;
      sent.sends.push({ email, draft_id: draft.apn || draft.neighborhood, subject: draft.subject, sent_at: new Date().toISOString(), resend_id: r.d?.id });
      console.log('✓');
    } else {
      failCount++;
      console.log(`✗ HTTP ${r.s} ${JSON.stringify(r.d).slice(0, 100)}`);
    }
    if (i < toSend.length - 1 && !DRY_RUN) await new Promise(r => setTimeout(r, 12000));
  }

  if (!DRY_RUN) saveSent(sent);
  console.log(`\nDone. Sent ${okCount}, failed ${failCount}.`);
  console.log(`Total sends logged: ${sent.sends.length}`);
})();
