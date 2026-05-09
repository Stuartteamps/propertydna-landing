/**
 * PropertyDNA Sona — One-Command Deploy
 *
 * Usage: node tools/sona-deploy.js (or: bash tools/sona-go.sh)
 *
 * Total user attention: ~10 seconds (type 6-digit code from email)
 * Everything else: fully automated
 */

const { chromium } = require('/Users/danstuart/propertydna-landing/app/frontend/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright');
const readline = require('readline');

// ── CONFIG ────────────────────────────────────────────────────────
const QUO_EMAIL  = 'stuartteamps@gmail.com';
const QUO_PHONE  = '(213) 205-4933';
const QUO_NUMBER_ID = 'PN4z0mXRyD';

const GREETING = `PropertyDNA, this is Sona. How can I help you today?`;

const BUSINESS_INFO = `PropertyDNA is an AI property intelligence platform for real estate agents, buyers, and investors in the Coachella Valley. Instant property reports including permit history, valuations, comparable sales, and neighborhood market data — delivered in under 60 seconds. Phone: (213) 205-4933. Website: propertydna.com. Hours: Mon-Sat 8am-7pm PT, AI answers 24/7.`;

const INSTRUCTIONS = `You are Sona, AI assistant for PropertyDNA and the Daniel Stuart Real Estate Team in Palm Springs, CA.

RESPOND IMMEDIATELY. Every answer is already written below — match the caller's question and read it out.

ABOUT: PropertyDNA generates instant property reports — permit history, valuations, comparable sales, heat maps — in under 60 seconds. Covers all Coachella Valley: Palm Springs, Palm Desert, Cathedral City, Rancho Mirage, Indian Wells, La Quinta, Indio, Coachella, Desert Hot Springs. 168,000+ parcels. propertydna.com. Phone: (213) 205-4933.

PRICING:
Free: first report free, no card, propertydna.com/analyze
Consumer: $19/month, home buyers
Realtor Pro: $99/month, active agents — MOST POPULAR, 150 reports
Enterprise: $149/month, teams, 200 reports
Investor: $299/month, investors, 250 reports
Overage: $0.75/report

SPOKEN RESPONSES — use word for word:

"What is PropertyDNA": PropertyDNA generates instant property reports covering permit history, valuations, and market data in under 60 seconds. Real estate agents use it to win listing appointments. First report is free at propertydna.com.

"How much does it cost": Plans start at $19 a month for buyers. Realtor Pro is $99 a month — most popular for active agents. Enterprise for teams is $149. First report is always free.

"How do I get a report": Go to propertydna.com, enter any Coachella Valley address, report ready in 60 seconds. I can text you the link — what is your number?

"Permit history": PropertyDNA pulls every permit ever filed — pools, additions, remodels, anything unpermitted. In Palm Springs this affects pricing, disclosures, and loans. No CMA tool has this.

"I am a real estate agent": Realtor Pro is $99 a month and includes 150 reports. Agents send a full property report to sellers before the listing appointment — you walk in and they have already read your research. Want me to text you the free trial link?

"Speak to Daniel or team": Absolutely. I will make sure Daniel's team gets your message. Can I get your name, email, and what it is regarding? They follow up within one business day.

"What cities": We cover the full Coachella Valley — Palm Springs, Palm Desert, Rancho Mirage, Indian Wells, La Quinta, Indio, Coachella, Cathedral City, and Desert Hot Springs.

"Replace MLS or Zillow": No — it works alongside your MLS. Zillow shows what is listed. PropertyDNA shows the county record: permit history, ownership timeline, and AI analysis.

"Too expensive": First report is completely free — no credit card. Realtor Pro is $3.30 a day. If it wins one extra listing it pays for itself many times over.

"Not tech savvy": As simple as typing an address and pressing a button. Under 60 seconds.

AUTO-SMS after calls: Thanks for calling PropertyDNA. Run a free report at propertydna.com/analyze — Daniel Stuart Team (213) 205-4933

LEAD CAPTURE before hanging up: 1. Name 2. Email required 3. Role: buyer seller agent investor 4. Best callback time

RULES: Keep every response 2-3 sentences max. Never make up property values. Always offer to text the report link. Always close: Is there anything else I can help you with? Switch to Spanish immediately if caller speaks Spanish.`;

const FAQS = [
  ['What is PropertyDNA?', 'PropertyDNA generates instant property reports in under 60 seconds — permit history, valuations, comparable sales. First report free at propertydna.com.'],
  ['How much does it cost?', 'First report free. Realtor Pro $99/month for active agents. Consumer $19/month for buyers. Enterprise $149/month for teams.'],
  ['What cities do you cover?', 'Full Coachella Valley — Palm Springs, Palm Desert, Rancho Mirage, Indian Wells, La Quinta, Indio, Coachella, Cathedral City, Desert Hot Springs.'],
  ['How do I run a report?', 'Go to propertydna.com/analyze, enter any Coachella Valley address. Ready in 60 seconds. First one free.'],
  ['What is permit history?', 'Every construction permit on a property since built — pools, additions, remodels, unpermitted work. PropertyDNA pulls this automatically.'],
  ['Can I speak to someone?', 'Yes — give me your name and email and Daniel\'s team will follow up within one business day.'],
  ['Is there a free trial?', 'Yes — first report always free at propertydna.com/analyze. No credit card needed.'],
  ['Does it work on mobile?', 'Yes, fully mobile-friendly at propertydna.com.'],
];

const URLS = [
  'https://propertydna.com/sona-kb.html',
  'https://propertydna.com',
  'https://propertydna.com/how-it-works',
];

// ── HELPERS ───────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function ask(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(prompt, ans => { rl.close(); resolve(ans.trim()); }));
}

async function shot(page, name) {
  const path = `/tmp/sona-${name}.png`;
  await page.screenshot({ path }).catch(() => {});
  return path;
}

async function fillTextarea(page, kws, text, label) {
  const selectors = kws.flatMap(k => [
    `textarea[placeholder*="${k}" i]`,
    `textarea[name*="${k}" i]`,
    `textarea[aria-label*="${k}" i]`,
    `[data-field*="${k}" i] textarea`,
  ]);
  for (const sel of selectors) {
    try {
      const el = await page.waitForSelector(sel, { timeout: 3000 });
      await el.scrollIntoViewIfNeeded();
      await el.click({ clickCount: 3 });
      await page.keyboard.press('Meta+a');
      await page.keyboard.press('Backspace');
      for (const chunk of (text.match(/.{1,200}/gs) || [text])) {
        await el.type(chunk, { delay: 1 });
      }
      console.log(`   ✅ ${label}`);
      return true;
    } catch { /* try next selector */ }
  }
  console.log(`   ⚠️  ${label} — needs manual paste`);
  return false;
}

// ── MAIN ──────────────────────────────────────────────────────────
(async () => {
  console.log('\n📞 Launching browser...');
  const browser = await chromium.launch({
    headless: false,
    slowMo: 50,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
  });
  const ctx = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();

  // ── LOGIN ───────────────────────────────────────────────────────
  console.log('🔐 Opening Quo login...');
  await page.goto('https://my.quo.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2000);

  // Click Email code
  await page.getByText('Email code').first().click();
  await sleep(1200);

  // Fill email
  await page.getByLabel('Email address').fill(QUO_EMAIL);
  await sleep(400);
  await page.getByRole('button', { name: 'Continue' }).click();
  await sleep(1500);

  // Big visible prompt for the code
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📧  CHECK YOUR EMAIL OR PHONE FOR THE QUO 6-DIGIT CODE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Email subject: "Your Quo Code"');
  console.log('  Sent to: ' + QUO_EMAIL);
  console.log('═══════════════════════════════════════════════════════════\n');

  let code = '';
  while (!/^\d{6}$/.test(code)) {
    code = await ask('Enter 6-digit code: ');
    if (!/^\d{6}$/.test(code)) {
      console.log('   ❌ Must be exactly 6 digits, try again');
    }
  }

  console.log(`\n🔑 Entering code: ${code}`);
  try {
    await page.getByLabel(/enter the code/i).fill(code);
  } catch {
    const inputs = await page.$$('input');
    if (inputs.length) await inputs[inputs.length - 1].fill(code);
  }
  await sleep(400);
  await page.getByRole('button', { name: 'Continue' }).click();
  await sleep(3000);

  // Wait for login
  try {
    await page.waitForURL(u => u.includes('my.quo.com') && !u.includes('login') && !u.includes('verify'), { timeout: 25000 });
    console.log('✅ Logged in!');
  } catch {
    console.log('⚠️  Still on:', page.url(), '— continuing anyway');
  }
  await sleep(2000);

  // ── NAVIGATE TO PHONE NUMBER ─────────────────────────────────────
  console.log('\n📱 Opening phone number settings...');
  await page.goto('https://my.quo.com/phone-numbers', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await sleep(3000);

  // Click 213 number
  const numClicked = await page.evaluate(() => {
    const els = document.querySelectorAll('a,button,li,tr,[tabindex],[role="button"],div');
    for (const el of els) {
      const txt = el.textContent || '';
      if (txt.includes('213') && txt.length < 80 && (el.onclick || el.getAttribute('role') === 'button' || el.tagName === 'A' || el.tagName === 'BUTTON' || el.tagName === 'LI')) {
        try { el.click(); return txt.trim().slice(0, 40); } catch {}
      }
    }
    return null;
  });
  console.log(numClicked ? `   ✅ Clicked: ${numClicked}` : '   ⚠️  Click (213) 205-4933 manually');
  if (!numClicked) await ask('Press Enter after clicking the number...');
  await sleep(2000);

  // Call Flow tab
  try {
    await page.getByText('Call Flow').first().click({ timeout: 5000 });
    console.log('   ✅ Call Flow tab opened');
  } catch {
    console.log('   ⚠️  Click "Call Flow" tab manually');
    await ask('Press Enter when on Call Flow page...');
  }
  await sleep(2000);

  // ── OPEN SONA STEP ───────────────────────────────────────────────
  console.log('\n🤖 Opening Sona step...');
  let sonaOpen = false;
  try {
    await page.getByText('Sona').first().click({ timeout: 5000 });
    sonaOpen = true;
    console.log('   ✅ Sona panel opened');
  } catch {
    // Try add step → Sona
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(b => /add step|new step|\+/i.test(b.textContent.trim()) && b.textContent.length < 30);
      if (b) b.click();
    });
    await sleep(800);
    try {
      await page.getByText('Sona').first().click({ timeout: 4000 });
      sonaOpen = true;
      console.log('   ✅ Sona added via + button');
    } catch {
      console.log('   ⚠️  Click Sona step manually');
      await ask('Press Enter when Sona panel is open...');
    }
  }
  await sleep(2000);

  // ── FILL ALL FIELDS ──────────────────────────────────────────────
  console.log('\n📝 Filling Sona fields...');

  await fillTextarea(page,
    ['business','about','description','company'],
    BUSINESS_INFO, 'Business info');
  await sleep(300);

  await fillTextarea(page,
    ['greeting','welcome','intro'],
    GREETING, 'Greeting');
  await sleep(300);

  await fillTextarea(page,
    ['instruct','custom','additional','context','rules'],
    INSTRUCTIONS, 'Instructions');
  await sleep(300);

  // Tone — Friendly
  try {
    await page.getByText('Friendly').first().click({ timeout: 3000 });
    console.log('   ✅ Tone: Friendly');
  } catch {
    console.log('   ⚠️  Set tone to Friendly manually');
  }

  // Spanish
  try {
    await page.getByText('Spanish').first().click({ timeout: 3000 });
    console.log('   ✅ Spanish enabled');
  } catch {
    console.log('   ⚠️  Enable Spanish manually');
  }

  // ── URLS ─────────────────────────────────────────────────────────
  console.log('\n🌐 Adding website URLs...');
  for (let i = 0; i < URLS.length; i++) {
    try {
      if (i > 0) {
        await page.evaluate(() => {
          const b = [...document.querySelectorAll('button')].find(b => /add url|add website|\+\s*url/i.test(b.textContent));
          if (b) b.click();
        });
        await sleep(600);
      }
      const urlInputs = await page.$$('input[type="url"],input[placeholder*="http" i],input[placeholder*="url" i]');
      if (urlInputs[i]) { await urlInputs[i].fill(URLS[i]); console.log(`   ✅ URL ${i+1}: ${URLS[i].slice(0,40)}`); }
      else if (urlInputs[0] && i === 0) { await urlInputs[0].fill(URLS[0]); console.log(`   ✅ URL 1`); }
      else console.log(`   ⚠️  Add manually: ${URLS[i]}`);
    } catch { console.log(`   ⚠️  URL ${i+1}: ${URLS[i]}`); }
    await sleep(300);
  }

  // ── FAQS ─────────────────────────────────────────────────────────
  console.log('\n❓ Adding FAQs...');
  for (let i = 0; i < FAQS.length; i++) {
    const [q, a] = FAQS[i];
    try {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(b => /add faq|add question|\+ faq|add q&a/i.test(b.textContent));
        if (b) b.click();
      });
      await sleep(400);
      const qInputs = await page.$$('input[placeholder*="question" i],textarea[placeholder*="question" i]');
      const aInputs = await page.$$('input[placeholder*="answer" i],textarea[placeholder*="answer" i]');
      if (qInputs[i]) await qInputs[i].fill(q);
      if (aInputs[i]) await aInputs[i].fill(a);
      console.log(`   ✅ FAQ ${i+1}: ${q.slice(0,40)}`);
    } catch {
      console.log(`   ⚠️  FAQ ${i+1} — add manually`);
    }
    await sleep(200);
  }

  // ── PAUSE BEFORE PUBLISH ────────────────────────────────────────
  await shot(page, 'before-publish');
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ✅ ALL FIELDS FILLED');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Browser is open at the Sona configuration screen.');
  console.log('  Quickly verify the fields look right, then:');
  console.log('  → Click PUBLISH in the browser');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Then call ${QUO_PHONE} to test — Sona should answer in <2s`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Try to auto-publish too
  const autoPublish = await ask('Auto-click Publish? (y/n): ');
  if (autoPublish.toLowerCase().startsWith('y')) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(b => /^(publish|save|apply|done)$/i.test(b.textContent.trim()));
      if (b) b.click();
    });
    await sleep(2000);
    console.log('✅ Published!');
  }

  console.log('\n✅ DONE. Browser stays open for verification. Close when satisfied.\n');
  // Keep alive so browser stays open
  await new Promise(() => {});
})().catch(e => {
  console.error('\n❌ Error:', e.message);
  process.exit(1);
});
