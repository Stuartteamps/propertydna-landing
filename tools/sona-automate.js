const { chromium } = require('/Users/danstuart/propertydna-landing/app/frontend/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright');
const path = require('path');

const CHROME_PROFILE = path.join(
  process.env.HOME,
  'Library/Application Support/Google/Chrome'
);

const STEP1_BUSINESS = `PropertyDNA is an AI property intelligence platform serving real estate agents, buyers, and investors across the Coachella Valley and Southern California. We generate instant property reports covering full permit history, automated valuations, comparable sales, and neighborhood market data — in under 60 seconds. Agents use PropertyDNA to win listing appointments and serve clients with data the MLS cannot provide. Based in Palm Springs, CA. Phone: (213) 205-4933. Website: propertydna.com. Operating Hours: We answer 24/7 via AI. A team member follows up during business hours Mon–Sat 8am–7pm PT. Location: Palm Springs, California 92262.`;

const GREETING = `Thank you for calling PropertyDNA — the AI property intelligence platform serving Palm Springs and the Coachella Valley. I'm Sona, your AI assistant. I can answer questions about our platform, take your information for a callback, or send you a link to run a free property report right now. How can I help you today?`;

const INSTRUCTIONS = `IDENTITY: You are Sona, the AI assistant for PropertyDNA. You answer calls on behalf of the Daniel Stuart Real Estate Team. You have complete knowledge of the product, pricing, coverage, and how to handle every type of caller. Always respond immediately and confidently — all answers are below.

PRODUCT: PropertyDNA generates AI property reports in under 60 seconds. Reports include: full permit history from county records, automated valuation with comparable sales, ownership timeline, neighborhood heat maps, FEMA flood zone, and an AI narrative analysis. Built for real estate agents, buyers, and investors in the Coachella Valley.

COVERAGE AREA: Full Coachella Valley — Palm Springs (29,000+ parcels), Palm Desert, Cathedral City, Rancho Mirage, Indian Wells, La Quinta, Indio, Coachella, Desert Hot Springs. Total: 168,000+ parcels. Expanding to LA, Orange County, San Diego. If caller asks about property outside CV: note their city and collect email — team will notify them when available.

PRICING (quote these exact numbers):
- Free: first report free, no credit card, at propertydna.com/analyze
- Consumer: $19/month, 25 reports — for home buyers
- Pro: $49/month, 75 reports — for occasional-use agents
- Realtor Pro: $99/month, 150 reports — MOST POPULAR for active agents
- Enterprise: $149/month, 200 reports — for teams and brokerages
- Investor: $299/month, 250 reports — for real estate investors
- Overage: $0.75 per report above monthly limit

HOW TO GET A REPORT: Go to propertydna.com/analyze, enter any Coachella Valley address, receive full report in under 60 seconds. First report is always free.

PERMIT HISTORY: Shows every construction permit on a property since built — pools, additions, remodels, unpermitted work flags. In the Coachella Valley, unpermitted additions are very common and affect pricing, disclosure requirements, loan eligibility, and insurance. PropertyDNA pulls this automatically. Standard CMA tools have zero permit data.

CALLER TYPES:
- Real estate agent: Recommend Realtor Pro $99/mo. Mention 150 reports, permit history, AI narrative, heat maps. Offer free trial at propertydna.com/analyze.
- Home buyer: Recommend Consumer $19/mo. Mention permit history reveals what MLS listing hides. Offer free first report.
- Investor: Recommend Investor $299/mo. Mention 250 reports, off-market intelligence, permit history.
- Team/brokerage: Recommend Enterprise $149/mo, 200 reports for a team of 3-5 agents.
- Wants Daniel/callback: Collect name, email, best callback time, nature of inquiry. Promise one business day follow-up.
- Billing/account issue: Collect email on their account and describe issue. Flag as priority.
- Partnership inquiry: Flag for Daniel specifically. Collect name, company, email.
- Spanish speaker: Switch to Spanish immediately.

OBJECTIONS:
- "Too expensive": "The Realtor Pro plan is $3.30 a day. If it helps you win one additional listing, it pays for itself many times over. Your first report is free — no credit card."
- "Already use Zillow/Redfin": "Those show MLS data. PropertyDNA adds full permit history from county records — something no MLS tool shows. Try a free report on a property you know well."
- "Won't use it enough": "Start with the free report, no commitment. If it saves you an hour of prep for your next listing appointment, you'll have your answer."
- "Not tech-savvy": "It's as simple as typing an address and pressing a button. Under 60 seconds."
- "Does it replace my MLS?": "No — it works alongside your MLS. Your MLS shows what's listed. PropertyDNA shows the county record, permit history, and AI analysis."

SMS TO SEND:
- Report link: propertydna.com/analyze — say "I'm texting you the link right now."
- Missed call: "Thanks for calling PropertyDNA! Run a free report at propertydna.com/analyze or reply and we'll call back. — Daniel Stuart Team (213) 205-4933"
- After message: "Got your message — the team will follow up within one business day. propertydna.com"
- For agents: "PropertyDNA Realtor Pro: $99/mo, 150 reports, permit history, heat maps. First report free at propertydna.com/analyze"
- For investors: "PropertyDNA Investor: $299/mo, 250 reports, off-market intelligence. Start free: propertydna.com/analyze"

LEAD CAPTURE (collect in order): 1. Full name, 2. Email address (required), 3. Property address if relevant (optional), 4. Role: buyer/seller/agent/investor, 5. Best callback time.

RULES:
- Always collect email before ending the call
- Always close with: "Is there anything else I can help you with before I let you go?"
- Never quote specific values for a caller's property without running a report
- Never make investment recommendations
- Never mention competitor platforms by name
- Never promise callback sooner than one business day
- Never end a call without offering to send the report link via SMS`;

const FAQS = [
  { q: 'What is PropertyDNA?', a: 'PropertyDNA is an AI-powered platform generating instant property reports in under 60 seconds — full permit history from county records, automated valuation, comparable sales, and neighborhood market data. Built for real estate agents, buyers, and investors in the Coachella Valley.' },
  { q: 'How much does it cost?', a: 'Free first report, no credit card. Paid plans: Consumer $19/mo, Realtor Pro $99/mo (most popular for agents, 150 reports), Enterprise $149/mo for teams (200 reports), Investor $299/mo (250 reports). Start at propertydna.com.' },
  { q: 'What cities do you cover?', a: 'All of the Coachella Valley — Palm Springs, Cathedral City, Rancho Mirage, Palm Desert, Indian Wells, La Quinta, Indio, Coachella, and Desert Hot Springs. 168,000 plus parcels indexed. Expanding to more Southern California markets.' },
  { q: 'How do I run a report?', a: 'Go to propertydna.com/analyze, enter any Coachella Valley address, report ready in under 60 seconds. First one is free. I can text you the link right now.' },
  { q: 'What is permit history?', a: 'Every construction permit filed on a property — pools, additions, remodels, unpermitted work. In Palm Springs, unpermitted additions are very common and affect pricing, disclosures, and loan eligibility. PropertyDNA pulls this automatically. No standard CMA tool includes this.' },
  { q: 'Can I speak to someone on the team?', a: 'Yes — give me your name, email, and a brief note and the team will follow up within one business day. What is the best email to reach you?' },
  { q: 'Is there a free trial?', a: 'Your first property report is always free — no credit card, no sign-up required. Go to propertydna.com/analyze and enter any Coachella Valley address.' },
  { q: 'What is IntellaGraph?', a: 'PropertyDNA\'s 3D parcel visualization tool showing land value at the parcel level across the Coachella Valley. Helps investors and developers identify undervalued land. Included in Realtor Pro, Enterprise, and Investor plans.' },
  { q: 'What are market heat maps?', a: 'Interactive maps showing price per square foot, buyer demand, and inventory by neighborhood — updated in real time. Shows where the market is moving before it appears in list prices.' },
  { q: 'Can I cancel anytime?', a: 'Yes — all plans are month to month, cancel anytime from your dashboard. No contracts.' },
];

const URLS = [
  'https://propertydna.com/sona-kb.html',
  'https://propertydna.com',
  'https://propertydna.com/how-it-works',
  'https://propertydna.com/blog',
];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fillField(page, selector, text, opts = {}) {
  const el = await page.waitForSelector(selector, { timeout: 10000 });
  await el.click({ clickCount: 3 });
  await el.fill('');
  await el.type(text, { delay: opts.fast ? 0 : 10 });
}

(async () => {
  console.log('Launching browser with Chrome profile...');
  const browser = await chromium.launchPersistentContext(CHROME_PROFILE, {
    headless: false,
    channel: 'chrome',
    args: ['--no-first-run', '--no-default-browser-check'],
    viewport: { width: 1280, height: 900 },
    slowMo: 100,
  });

  const page = browser.pages()[0] || await browser.newPage();

  console.log('Navigating to my.quo.com...');
  await page.goto('https://my.quo.com', { waitUntil: 'networkidle' });
  await sleep(2000);

  const url = page.url();
  console.log('Current URL:', url);

  if (url.includes('login') || url.includes('signin') || url.includes('auth')) {
    console.log('⚠️  Not logged in — please log in to my.quo.com in this window, then press Enter in terminal...');
    await new Promise(resolve => process.stdin.once('data', resolve));
    await page.goto('https://my.quo.com', { waitUntil: 'networkidle' });
    await sleep(2000);
  }

  console.log('✅ Logged in. Looking for Phone Numbers...');

  // Navigate to phone numbers
  try {
    await page.click('a[href*="phone-number"], a[href*="numbers"], [data-testid="phone-numbers"], text=Phone Numbers', { timeout: 8000 });
  } catch {
    await page.goto('https://my.quo.com/phone-numbers', { waitUntil: 'networkidle' });
  }
  await sleep(2000);

  // Click on the (213) number
  console.log('Looking for (213) 205-4933...');
  try {
    await page.click('text=213', { timeout: 8000 });
    await sleep(1500);
  } catch {
    console.log('Could not find number directly — screenshot saved');
    await page.screenshot({ path: '/tmp/quo-debug-1.png' });
  }

  // Click Call Flow tab
  console.log('Looking for Call Flow...');
  try {
    await page.click('text=Call Flow', { timeout: 8000 });
    await sleep(2000);
  } catch {
    await page.screenshot({ path: '/tmp/quo-debug-2.png' });
    console.log('Could not find Call Flow tab — check /tmp/quo-debug-2.png');
  }

  // Take screenshot of current state
  await page.screenshot({ path: '/tmp/quo-callflow.png' });
  console.log('Screenshot saved to /tmp/quo-callflow.png');

  // Try to find and click Add Sona / Edit Sona
  try {
    const sonaBtn = await page.$('text=Sona, text=Add Sona, [data-testid="sona"]');
    if (sonaBtn) {
      await sonaBtn.click();
      await sleep(2000);
    } else {
      // Try clicking + button to add step
      await page.click('button:has-text("Add"), button:has-text("+"), [aria-label="Add step"]', { timeout: 5000 });
      await sleep(1000);
      await page.click('text=Sona', { timeout: 5000 });
      await sleep(2000);
    }
  } catch (e) {
    console.log('Could not find Sona step button:', e.message);
    await page.screenshot({ path: '/tmp/quo-debug-3.png' });
  }

  await page.screenshot({ path: '/tmp/quo-sona-panel.png' });
  console.log('Current state screenshot: /tmp/quo-sona-panel.png');
  console.log('\nPage HTML snapshot:');
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
  console.log(bodyText);

  console.log('\nBrowser left open for manual completion. Close when done.');
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
