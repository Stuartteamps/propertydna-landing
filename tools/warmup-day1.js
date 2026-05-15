#!/usr/bin/env node
/**
 * Sender reputation warm-up runner — Day 1
 *
 * Recovers from the 2026-05-12 reputation disaster (1 open / 6720 sent).
 * Sends 20–25 plain-text emails to the WARMEST possible contacts using the
 * clean sending domain `daniel@thepropertydna.com` instead of the burned
 * `mail.thepropertydna.com` subdomain.
 *
 * Strategy:
 *   - 1-on-1 tone, no marketing copy, no HTML, no images
 *   - Short subject (no "FREE", "$$$", caps)
 *   - Asks a simple yes/no reply (reply-back rate is the strongest positive
 *     signal for ISP reputation)
 *   - Reply-To = Dan's Gmail (replies go to real human, build trust)
 *
 * Usage:
 *   node tools/warmup-day1.js dry        → preview only (no sends)
 *   node tools/warmup-day1.js send       → actually send
 */

const https = require('https');

const INTERNAL_KEY = process.env.INTERNAL_API_KEY || '271d07f203bc34ba8574988ac272ab15ac60c5dbf25dd9391403d54c6a7fd977';
const SITE = 'https://thepropertydna.com';

// 20 warmest contacts pulled from Sphere of Influence CC list (2026-05-14).
// First-name personalization, no fake address — uses generic "your Coachella
// Valley property" so the message reads natural even for contacts whose
// address we don't have stored.
const RECIPIENTS = [
  { email: 'lemerson@dc.rr.com',           firstName: 'Adam' },
  { email: 'travegram66@icloud.com',       firstName: 'Jude' },
  { email: 'btomb@shaw.ca',                firstName: 'Tom' },
  { email: 'tburt61@gmail.com',            firstName: 'Tamara' },
  { email: 'annamoreno7203@gmail.com',     firstName: 'Annamarie' },
  { email: 'michellecortes11@icloud.com',  firstName: 'Michelle' },
  { email: 'aluna92037@gmail.com',         firstName: 'Tony' },
  { email: 'theocsonja@gmail.com',         firstName: 'Sonja' },
  { email: 'trmasonusa@gmail.com',         firstName: 'Mark' },
  { email: 'jim.helke@gmail.com',          firstName: 'James' },
  { email: 'kgbear56@gmail.com',           firstName: 'Lisa' },
  { email: 'ajtickell@hotmail.com',        firstName: 'Robert' },
  { email: 'youdavp@msn.com',              firstName: 'David' },
  { email: 'jeanbrayford@gmail.com',       firstName: 'Jean' },
  { email: 'msachs@dc.rr.com',             firstName: 'Mike' },
  { email: 'smithtomj13@gmail.com',        firstName: 'Tom' },
  { email: 'emily@brooke.com',             firstName: 'Emily' },
  { email: 'mj-river@hotmail.com',         firstName: 'Marlin' },
  { email: 'freddysanchez21@hotmail.com',  firstName: 'Freddy' },
  { email: 'wrestler1961@yahoo.com',       firstName: 'Romney' },
];

const SUBJECT = 'quick question, {{firstName}}';

const BODY_TEXT = `Hey {{firstName}} -

Hope all is well. Quick yes/no question for you.

Would it help if I pulled a free intelligence report on your Coachella Valley property? It includes permit history, true valuation (last sale + improvements + market shift), risk profile (flood, fault zone, fire), and the comparable sales I'd use as a listing agent.

Takes me about 60 seconds to run. No signup or hassle on your end.

Just reply "yes" and I'll send the report back, or "not now" and I'll leave you alone.

Daniel
Stuart Team | Coldwell Banker Palm Springs
${SITE}`;

function post(host, p, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const req = https.request({
      hostname: host, path: p, method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers, 'Content-Length': Buffer.byteLength(payload) },
    }, res => {
      let r = ''; res.on('data', c => r += c);
      res.on('end', () => { try { resolve({ s: res.statusCode, d: JSON.parse(r) }); } catch { resolve({ s: res.statusCode, d: r }); } });
    });
    req.on('error', reject);
    req.write(payload); req.end();
  });
}

async function main() {
  const mode = (process.argv[2] || 'dry').toLowerCase();

  if (mode !== 'send' && mode !== 'dry') {
    console.error('Usage: node warmup-day1.js [dry|send]');
    process.exit(1);
  }

  console.log(`=== Sender Reputation Warm-Up · Day 1 (${mode.toUpperCase()}) ===\n`);
  console.log(`Recipients: ${RECIPIENTS.length}`);
  console.log(`From:       daniel@thepropertydna.com  (clean domain)`);
  console.log(`Reply-To:   stuartteamps@gmail.com`);
  console.log(`Subject:    ${SUBJECT.replace('{{firstName}}', 'there')}`);
  console.log(`\n--- Body preview ---\n${BODY_TEXT.replace(/{{firstName}}/g, 'there').replace(/{{address}}/g, 'your property')}\n`);

  if (mode === 'dry') {
    console.log('Dry run only. Recipients:');
    RECIPIENTS.forEach((r, i) => console.log(`  ${i+1}. ${r.email} (${r.firstName} · ${r.address})`));
    console.log('\nRun again with `node warmup-day1.js send` to actually send.');
    return;
  }

  console.log(`Sending ${RECIPIENTS.length} emails through warm-up endpoint...\n`);
  const res = await post('thepropertydna.com', '/.netlify/functions/send-warm-batch', {
    recipients: RECIPIENTS,
    subject:    SUBJECT,
    bodyText:   BODY_TEXT,
    campaignId: 'warmup-day1-' + new Date().toISOString().slice(0,10),
  }, { 'x-internal-key': INTERNAL_KEY });

  console.log('Result:', JSON.stringify(res.d, null, 2));
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
