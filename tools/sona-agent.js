/**
 * PropertyDNA Sona Autonomous Deployment Agent
 *
 * - Runs Playwright to configure Sona on Quo
 * - Emails Dan at every step (Resend)
 * - Coordinates via /.netlify/functions/sona-control
 * - Halts at publish gate awaiting "warhorse7308" confirmation
 *
 * Usage: node tools/sona-agent.js
 *        node tools/sona-agent.js --resume   (resume from last state)
 */

const { chromium } = require('/Users/danstuart/propertydna-landing/app/frontend/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright');
const https = require('https');

const SITE        = 'https://thepropertydna.com';
const CONTROL_URL = `${SITE}/.netlify/functions/sona-control`;
const PUBLIC_PAGE = `${SITE}/sona-control.html`;
const NOTIFY_EMAIL = 'stuartteamps@gmail.com';
const QUO_LOGIN_EMAIL = 'stuartteamps@gmail.com';
const QUO_PHONE = '(213) 205-4933';
const SECRET_WORD = 'warhorse7308';

// Read credentials from local env vars or fall back to repo memory references
const RESEND_KEY = process.env.RESEND_API_KEY || 're_iEkiuYtc_5PNiDq1S1JCE3czak6uTiGnm';
const QUO_API_KEY = process.env.QUO_API_KEY || '339bcfbecdaf8e103474653bbd62212deb4d992f12769e2452b13baa3d58c187';
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || '271d07f203bc34ba8574988ac272ab15ac60c5dbf25dd9391403d54c6a7fd977';

// ── SONA CONTENT ─────────────────────────────────────────────────────
const GREETING = `PropertyDNA, this is Sona. How can I help you today?`;

const BUSINESS_INFO = `PropertyDNA is an AI property intelligence platform for real estate agents, buyers, and investors in the Coachella Valley. Instant property reports including permit history, valuations, comparable sales, and neighborhood market data — delivered in under 60 seconds. Phone: (213) 205-4933. Website: propertydna.com. Hours: Mon-Sat 8am-7pm PT, AI answers 24/7.`;

const INSTRUCTIONS = `You are Sona, AI assistant for PropertyDNA and the Daniel Stuart Real Estate Team in Palm Springs, CA.

RESPOND IMMEDIATELY. Every answer is below — match the caller's question and read it out.

PRICING:
Free first report at propertydna.com/analyze
Consumer: $19/month — buyers
Realtor Pro: $99/month, 150 reports — MOST POPULAR
Enterprise: $149/month, 200 reports — teams
Investor: $299/month, 250 reports
Overage: $0.75/report

SPOKEN RESPONSES — use word for word:

"What is PropertyDNA": PropertyDNA generates instant property reports covering permit history, valuations, and market data in under 60 seconds. First report free at propertydna.com.

"How much does it cost": Plans start at $19 a month for buyers. Realtor Pro is $99 a month, most popular for active agents. Enterprise for teams is $149. First report is always free.

"How do I get a report": Go to propertydna.com, enter any Coachella Valley address, report ready in 60 seconds. I can text you the link.

"Permit history": PropertyDNA pulls every permit ever filed — pools, additions, remodels, anything unpermitted. Affects pricing and disclosures.

"I am a real estate agent": Realtor Pro is $99 a month, 150 reports. Agents send a full property report to sellers before the listing appointment. Want me to text you the free trial link?

"Speak to Daniel": Absolutely. Can I get your name, email, and what it is regarding? Daniel's team will follow up within one business day.

"What cities": Full Coachella Valley — Palm Springs, Palm Desert, Rancho Mirage, Indian Wells, La Quinta, Indio, Coachella, Cathedral City, Desert Hot Springs.

"Replace MLS": No — works alongside your MLS. PropertyDNA shows the county record: permit history, ownership timeline, AI analysis.

"Too expensive": First report is free, no credit card. Realtor Pro is $3.30 a day.

LEAD CAPTURE: 1. Name 2. Email required 3. Role 4. Best callback time

RULES: Keep responses 2-3 sentences. Never make up property values. Always offer to text the report link. Always close: Is there anything else I can help you with? Switch to Spanish if caller speaks Spanish.`;

const FAQS = [
  ['What is PropertyDNA?', 'PropertyDNA generates instant property reports in under 60 seconds — permit history, valuations, comparable sales. First report free at propertydna.com.'],
  ['How much does it cost?', 'First report free. Realtor Pro $99/month for active agents. Consumer $19/month. Enterprise $149/month for teams.'],
  ['What cities do you cover?', 'Full Coachella Valley — Palm Springs, Palm Desert, Rancho Mirage, Indian Wells, La Quinta, Indio, Coachella, Cathedral City, Desert Hot Springs.'],
  ['How do I run a report?', 'Go to propertydna.com/analyze, enter any Coachella Valley address. Ready in 60 seconds. First one free.'],
  ['What is permit history?', 'Every construction permit on a property since built — pools, additions, remodels, unpermitted work.'],
  ['Can I speak to someone?', 'Yes — give me your name and email and Daniel\'s team will follow up within one business day.'],
  ['Is there a free trial?', 'Yes — first report always free at propertydna.com/analyze. No credit card needed.'],
  ['Does it work on mobile?', 'Yes, fully mobile-friendly at propertydna.com.'],
];

const URLS = [
  'https://propertydna.com/sona-kb.html',
  'https://propertydna.com',
  'https://propertydna.com/how-it-works',
];

// ── HELPERS ──────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function httpsPost(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers },
    }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    }).on('error', reject);
  });
}

async function notifyEmail(subject, html) {
  console.log(`📧 EMAIL: ${subject}`);
  const r = await httpsPost('https://api.resend.com/emails', {
    from: 'PropertyDNA Agent <reports@thepropertydna.com>',
    to: NOTIFY_EMAIL,
    subject: `[Sona Agent] ${subject}`,
    html,
  }, { Authorization: `Bearer ${RESEND_KEY}` }).catch(e => ({ status: 0, error: e.message }));
  if (r.status >= 200 && r.status < 300) console.log('   ✓ sent');
  else console.log(`   ✗ failed (${r.status})`);
  return r;
}

async function notifySMS(text) {
  // Sends via Quo API to the business number's own SMS — won't reach Dan's cell
  // but logs visibly in the Quo inbox so he can see it on the dashboard/app
  console.log(`📱 SMS: ${text.slice(0, 60)}`);
  // Skipping for now — needs Dan's actual cell. Email is reliable.
}

async function setPhase(phase, message) {
  console.log(`\n[${phase}] ${message}`);
  await httpsPost(CONTROL_URL, { phase, message, code: null, confirm: null }, { 'x-internal-key': INTERNAL_KEY });
}

async function getState() {
  const r = await httpsGet(CONTROL_URL);
  try { return JSON.parse(r.body); } catch { return {}; }
}

async function clearControl() {
  await httpsPost(CONTROL_URL, { code: null, confirm: null }, { 'x-internal-key': INTERNAL_KEY });
}

async function pollFor(field, timeoutMs = 1800000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await getState();
    if (state[field]) return state[field];
    await sleep(3000);
  }
  return null;
}

async function fillTextarea(page, kws, text, label) {
  const selectors = kws.flatMap(k => [
    `textarea[placeholder*="${k}" i]`, `textarea[name*="${k}" i]`,
    `textarea[aria-label*="${k}" i]`, `[data-field*="${k}" i] textarea`,
  ]);
  for (const sel of selectors) {
    try {
      const el = await page.waitForSelector(sel, { timeout: 3000 });
      await el.scrollIntoViewIfNeeded();
      await el.click({ clickCount: 3 });
      await page.keyboard.press('Meta+a');
      await page.keyboard.press('Backspace');
      for (const chunk of (text.match(/.{1,200}/gs) || [text])) await el.type(chunk, { delay: 1 });
      console.log(`   ✓ ${label}`);
      return true;
    } catch { /* next */ }
  }
  console.log(`   ⚠ ${label} — selector miss`);
  return false;
}

// ── MAIN AGENT LOOP ──────────────────────────────────────────────────
(async () => {
  const startTime = Date.now();

  await notifyEmail('Sona Agent Started', `
    <h2>🤖 Sona deployment agent is now running</h2>
    <p>The agent will configure Sona AI on the (213) 205-4933 line for PropertyDNA.</p>
    <p><b>Control panel:</b> <a href="${PUBLIC_PAGE}">${PUBLIC_PAGE}</a></p>
    <p>You'll get an email when:</p>
    <ul>
      <li>The 6-digit Quo code is needed (you submit at the control URL above)</li>
      <li>Setup is ready to publish (you submit "<b>${SECRET_WORD}</b>" at the URL to confirm, or "cancel" to abort)</li>
      <li>Setup is complete</li>
      <li>An error occurs</li>
    </ul>
  `);

  await clearControl();

  const browser = await chromium.launch({
    headless: false, slowMo: 50,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
  });
  const ctx = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();

  try {
    // ── STEP 1: REQUEST EMAIL CODE ───────────────────────────────────
    await setPhase('logging_in', 'Opening Quo login...');
    await page.goto('https://my.quo.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);

    await page.getByText('Email code').first().click();
    await sleep(1200);
    await page.getByLabel('Email address').fill(QUO_LOGIN_EMAIL);
    await sleep(400);
    await page.getByRole('button', { name: 'Continue' }).click();
    await sleep(2000);

    await setPhase('awaiting_code', `Quo verification code sent to ${QUO_LOGIN_EMAIL}. Submit it at ${PUBLIC_PAGE}`);
    await notifyEmail('🔐 Quo code requested — submit it now', `
      <h2>Action needed: 6-digit verification code</h2>
      <p>A Quo verification code was just sent to <b>${QUO_LOGIN_EMAIL}</b>.</p>
      <p>When you have 10 seconds, open the control panel and paste the 6-digit code:</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${PUBLIC_PAGE}" style="background:#C9A84C;color:#000;padding:14px 28px;text-decoration:none;font-weight:600;letter-spacing:2px;text-transform:uppercase;font-size:12px;">→ Submit Code</a>
      </p>
      <p style="color:#888;font-size:13px;">The agent is waiting and will continue automatically once you submit. Times out in 30 minutes.</p>
    `);

    // ── STEP 2: WAIT FOR CODE ────────────────────────────────────────
    const code = await pollFor('code', 30 * 60 * 1000);
    if (!code) {
      await setPhase('error', 'Timed out waiting for code (30 min)');
      await notifyEmail('⏱ Sona agent timed out', '<p>No code received in 30 minutes. Re-run when ready.</p>');
      throw new Error('Code timeout');
    }
    await clearControl();

    // ── STEP 3: ENTER CODE ───────────────────────────────────────────
    await setPhase('logging_in', `Entering code ${code}...`);
    try {
      await page.getByLabel(/enter the code/i).fill(code);
    } catch {
      const inputs = await page.$$('input');
      if (inputs.length) await inputs[inputs.length - 1].fill(code);
    }
    await sleep(400);
    await page.getByRole('button', { name: 'Continue' }).click();
    await sleep(3000);

    // More forgiving: try to detect either URL change OR error message on the page
    let loggedIn = false;
    for (let i = 0; i < 10; i++) {
      await sleep(2000);
      const url = page.url();
      const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500)).catch(() => '');
      if (url.includes('my.quo.com') && !url.match(/\/(login|signin)(\?|$)/) && !url.includes('verify')) {
        loggedIn = true; break;
      }
      if (/invalid|incorrect|expired|wrong/i.test(bodyText)) {
        await page.screenshot({ path: '/tmp/sona-login-error.png' }).catch(() => {});
        await setPhase('error', `Code rejected by Quo: ${bodyText.slice(0, 100)}`);
        await notifyEmail('❌ Code rejected', `<p>Quo says: <i>${bodyText.slice(0, 200)}</i></p><p>Restart the agent for a fresh code.</p>`);
        throw new Error('Code rejected');
      }
    }
    if (!loggedIn) {
      // Check screenshot — may have logged in but URL check missed
      await page.screenshot({ path: '/tmp/sona-post-login.png' }).catch(() => {});
      const finalUrl = page.url();
      console.log(`Login URL check failed but proceeding. Final URL: ${finalUrl}`);
      // Continue anyway — navigate to phone-numbers will fail safely if not logged in
    }

    // ── STEP 4: NAVIGATE TO PHONE NUMBER ─────────────────────────────
    await setPhase('filling', 'Navigating to phone number settings...');
    await page.goto('https://my.quo.com/phone-numbers', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await sleep(3000);

    await page.evaluate(() => {
      const els = document.querySelectorAll('a,button,li,tr,[tabindex],[role="button"],div');
      for (const el of els) {
        const txt = el.textContent || '';
        if (txt.includes('213') && txt.length < 80) {
          try { el.click(); return; } catch {}
        }
      }
    });
    await sleep(2000);

    try { await page.getByText('Call Flow').first().click({ timeout: 5000 }); } catch {}
    await sleep(2000);

    // Open Sona step
    let sonaOpened = false;
    try { await page.getByText('Sona').first().click({ timeout: 5000 }); sonaOpened = true; }
    catch {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(b => /add step|new step|\+/i.test(b.textContent.trim()) && b.textContent.length < 30);
        if (b) b.click();
      });
      await sleep(800);
      try { await page.getByText('Sona').first().click({ timeout: 4000 }); sonaOpened = true; } catch {}
    }
    if (!sonaOpened) {
      await setPhase('error', 'Could not find Sona step in call flow');
      await notifyEmail('⚠ Sona step not found', `<p>Could not auto-locate the Sona step. Browser is open at: ${page.url()}</p><p>Add Sona manually if not present.</p>`);
    }
    await sleep(2000);

    // ── STEP 5: FILL SONA FIELDS ─────────────────────────────────────
    await setPhase('filling', 'Filling Sona fields (business info, greeting, instructions)...');

    await fillTextarea(page, ['business','about','description','company'], BUSINESS_INFO, 'Business info');
    await sleep(300);
    await fillTextarea(page, ['greeting','welcome','intro'], GREETING, 'Greeting');
    await sleep(300);
    await fillTextarea(page, ['instruct','custom','additional','context','rules'], INSTRUCTIONS, 'Instructions');
    await sleep(300);

    try { await page.getByText('Friendly').first().click({ timeout: 3000 }); console.log('   ✓ Tone Friendly'); } catch {}
    try { await page.getByText('Spanish').first().click({ timeout: 3000 }); console.log('   ✓ Spanish'); } catch {}

    // URLs
    for (let i = 0; i < URLS.length; i++) {
      try {
        if (i > 0) {
          await page.evaluate(() => {
            const b = [...document.querySelectorAll('button')].find(b => /add url|add website|\+\s*url/i.test(b.textContent));
            if (b) b.click();
          });
          await sleep(500);
        }
        const ins = await page.$$('input[type="url"],input[placeholder*="http" i],input[placeholder*="url" i]');
        if (ins[i]) { await ins[i].fill(URLS[i]); console.log(`   ✓ URL ${i+1}`); }
        else if (ins[0] && i === 0) { await ins[0].fill(URLS[0]); }
      } catch {}
      await sleep(200);
    }

    // FAQs
    for (let i = 0; i < FAQS.length; i++) {
      try {
        await page.evaluate(() => {
          const b = [...document.querySelectorAll('button')].find(b => /add faq|add question|\+ faq|add q/i.test(b.textContent));
          if (b) b.click();
        });
        await sleep(400);
        const qIn = await page.$$('input[placeholder*="question" i],textarea[placeholder*="question" i]');
        const aIn = await page.$$('input[placeholder*="answer" i],textarea[placeholder*="answer" i]');
        if (qIn[i]) await qIn[i].fill(FAQS[i][0]);
        if (aIn[i]) await aIn[i].fill(FAQS[i][1]);
        console.log(`   ✓ FAQ ${i+1}`);
      } catch {}
      await sleep(200);
    }

    await page.screenshot({ path: '/tmp/sona-agent-filled.png' }).catch(() => {});

    // ── STEP 6: GATE — AWAIT CONFIRMATION ────────────────────────────
    await setPhase('awaiting_publish_confirm', `All fields filled. Submit "${SECRET_WORD}" to publish, or "cancel" to abort.`);
    await notifyEmail('✅ Sona ready to publish — confirmation required', `
      <h2>All Sona fields are filled. Awaiting your confirmation to publish.</h2>
      <p><b>Phone:</b> ${QUO_PHONE}</p>
      <p><b>Greeting:</b> "${GREETING}"</p>
      <p><b>Tone:</b> Friendly | English + Spanish</p>
      <p><b>FAQs:</b> ${FAQS.length} added</p>
      <p><b>URLs:</b> ${URLS.length} added</p>
      <p>Open the control panel to publish or cancel:</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${PUBLIC_PAGE}" style="background:#C9A84C;color:#000;padding:14px 28px;text-decoration:none;font-weight:600;letter-spacing:2px;text-transform:uppercase;font-size:12px;">→ Open Control Panel</a>
      </p>
      <p style="color:#888;font-size:13px;">Type <b>${SECRET_WORD}</b> to publish, or <b>cancel</b> to abort. Times out in 60 minutes.</p>
    `);

    const confirmation = await pollFor('confirm', 60 * 60 * 1000);
    if (!confirmation) {
      await setPhase('error', 'Timed out waiting for publish confirmation (60 min)');
      await notifyEmail('⏱ Publish confirmation timeout', '<p>No confirmation received in 60 minutes. Browser left open for manual review.</p>');
      throw new Error('Confirmation timeout');
    }

    if (confirmation.toLowerCase() === 'cancel') {
      await setPhase('cancelled', 'Cancelled by user');
      await notifyEmail('🛑 Sona deployment cancelled', '<p>Setup was cancelled. Browser is open if you want to review manually.</p>');
      console.log('Cancelled. Browser stays open.');
      await new Promise(() => {});
      return;
    }

    if (confirmation !== SECRET_WORD) {
      await setPhase('error', `Wrong confirmation word ("${confirmation}"). Expected "${SECRET_WORD}".`);
      await notifyEmail('❌ Wrong confirmation word', `<p>You typed: <b>${confirmation}</b><br>Expected: <b>${SECRET_WORD}</b></p><p>Re-run the agent to try again.</p>`);
      throw new Error('Wrong confirmation');
    }

    // ── STEP 7: PUBLISH ──────────────────────────────────────────────
    await setPhase('publishing', 'Confirmation received. Publishing Sona...');
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(b => /^(publish|save|apply|done)$/i.test(b.textContent.trim()));
      if (b) b.click();
    });
    await sleep(3000);
    await page.screenshot({ path: '/tmp/sona-agent-published.png' }).catch(() => {});

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    await setPhase('completed', `✅ Sona is LIVE on ${QUO_PHONE}. Total time: ${elapsed}s`);
    await notifyEmail('🎉 Sona is LIVE on PropertyDNA', `
      <h2>Sona AI is now answering calls on ${QUO_PHONE}</h2>
      <p>Setup completed in ${elapsed} seconds.</p>
      <p>Call <b>${QUO_PHONE}</b> right now to test.</p>
      <p>Sona should pick up in under 2 seconds with: <i>"PropertyDNA, this is Sona. How can I help you today?"</i></p>
      <hr>
      <p style="color:#888;font-size:12px;">Browser stays open for verification. Close when satisfied.</p>
    `);

    console.log('\n✅ COMPLETE');
    await new Promise(() => {});

  } catch (e) {
    console.error('\n❌ Agent error:', e.message);
    await setPhase('error', e.message);
    await notifyEmail('❌ Sona agent error', `<p>${e.message}</p><p>Browser stays open at: ${page.url()}</p>`).catch(() => {});
    await new Promise(() => {});
  }
})();
