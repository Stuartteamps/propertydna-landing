/**
 * submitter-drip — Daily nurture for inbound form submitters who didn't subscribe.
 *
 * Runs daily via Netlify cron. Three-touch sequence over 10 days:
 *   Step 1 · Day 2  — "How professionals read your report" (educate)
 *   Step 2 · Day 5  — "What we found about your area" (market value tease)
 *   Step 3 · Day 10 — "Quick question from Dan" (personal, soft ask)
 *
 * Skip rules (per email):
 *   - Owner email (stuartteamps@gmail.com)
 *   - Active subscription exists
 *   - Drip step already sent (kpi_event `submitter_drip_step_N_sent`)
 *
 * State tracking: kpi_events. No new tables.
 * Manual run: curl -X POST https://thepropertydna.com/.netlify/functions/submitter-drip
 */
const https = require("https");
const db = require("./_supabase");

const APP_BASE = (process.env.APP_BASE_URL || "https://thepropertydna.com").replace(/\/$/, "");
const OWNER    = (process.env.OWNER_EMAIL   || "stuartteamps@gmail.com").toLowerCase();
const SENDER   = process.env.SENDER_EMAIL || "reports@thepropertydna.com";
const SENDER_NAME = process.env.SENDER_NAME || "PropertyDNA";
const REPLY_TO = process.env.REPLY_TO_EMAIL || "stuartteamps@gmail.com";

const STEPS = [
  { step: 1, ageDays: 2,  ageWindowDays: 1 },
  { step: 2, ageDays: 5,  ageWindowDays: 1 },
  { step: 3, ageDays: 10, ageWindowDays: 1 },
];

// ── Resend ─────────────────────────────────────────────────────────────────
function httpsPost(hostname, path, headers, body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve) => {
    const req = https.request(
      { hostname, path, method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), ...headers } },
      (res) => { let raw = ""; res.on("data", c => raw += c); res.on("end", () => resolve({ status: res.statusCode, body: raw })); }
    );
    req.on("error", () => resolve({ status: 0 }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ status: 0 }); });
    req.write(payload);
    req.end();
  });
}

async function sendEmail({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { status: 0, error: "no_resend_key" };
  return httpsPost("api.resend.com", "/emails",
    { Authorization: `Bearer ${key}` },
    { from: `${SENDER_NAME} <${SENDER}>`, reply_to: REPLY_TO, to, subject, html, text });
}

// ── Templates ──────────────────────────────────────────────────────────────
const SHELL = (inner, footerNote = "") => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9f7f4;font-family:Georgia,'Times New Roman',serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f4;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #e5e0d8;">
<tr><td style="padding:32px 40px 24px;border-bottom:1px solid #e5e0d8;">
<p style="margin:0;font-size:11px;color:#999;letter-spacing:3px;text-transform:uppercase;">Property DNA</p>
<p style="margin:6px 0 0;font-size:11px;color:#bbb;letter-spacing:1px;">Intelligence Report</p>
</td></tr>
<tr><td style="padding:32px 40px;">${inner}</td></tr>
<tr><td style="padding:20px 40px;border-top:1px solid #e5e0d8;background:#faf8f5;">
<p style="margin:0;font-size:11px;color:#888;">PropertyDNA · thepropertydna.com${footerNote ? " · " + footerNote : ""}</p>
</td></tr></table></td></tr></table></body></html>`;

function tmplStep1({ name, address }) {
  const safe = (s) => (s || "").replace(/[<>]/g, "");
  const n = safe(name) || "there";
  const dashUrl = `${APP_BASE}/dashboard`;
  const html = SHELL(`
<p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.75;">Hi ${n},</p>
<p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.75;">A quick note about your PropertyDNA report${address ? ` for <strong>${safe(address)}</strong>` : ""} — most people glance at the headline number and miss the four sections that actually drive value.</p>
<p style="margin:0 0 8px;font-size:14px;color:#222;line-height:1.75;"><strong>What to look at, in order:</strong></p>
<ol style="margin:0 0 24px 20px;padding:0;font-size:14px;color:#444;line-height:1.85;">
<li><strong>DNA Score</strong> — composite of 847 attributes. Score under 70 is a renovation lever, 80+ is premium-positioned.</li>
<li><strong>Comp Velocity</strong> — how fast the comparable set is moving. Rising velocity + flat valuation = mispriced.</li>
<li><strong>Risk Strands</strong> — flood, crime, insurance trajectory. These shift faster than people think.</li>
<li><strong>Valuation Drift</strong> — gap between AVM and last sale anchored to today's market. Wide gap signals an update lag.</li>
</ol>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 8px;"><tr><td style="background:#1a1a1a;">
<a href="${dashUrl}" style="display:inline-block;padding:14px 28px;color:#E8B84B;font-size:15px;text-decoration:none;letter-spacing:1px;">Re-open Your Report &rarr;</a>
</td></tr></table>
<p style="margin:24px 0 0;font-size:13px;color:#888;line-height:1.7;">Reply to this email with questions — I read everything.</p>
<p style="margin:8px 0 0;font-size:13px;color:#888;">— Dan</p>`);
  const text = [
    `Hi ${n},`, "",
    `A quick note about your PropertyDNA report${address ? ` for ${address}` : ""}.`,
    "What to look at, in order:",
    "1. DNA Score (composite of 847 attributes)",
    "2. Comp Velocity (how fast comparables are moving)",
    "3. Risk Strands (flood, crime, insurance trajectory)",
    "4. Valuation Drift (AVM vs anchored last sale)", "",
    `Re-open your report: ${dashUrl}`, "",
    "Reply with questions — I read everything.", "— Dan",
  ].join("\n");
  return {
    subject: address ? `How to read your ${address} report` : "How to read your PropertyDNA report",
    html, text,
  };
}

function tmplStep2({ name, address, city }) {
  const safe = (s) => (s || "").replace(/[<>]/g, "");
  const n = safe(name) || "there";
  const c = safe(city) || "your area";
  const pricingUrl = `${APP_BASE}/pricing`;
  const html = SHELL(`
<p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.75;">Hi ${n},</p>
<p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.75;">Three things shifting in <strong>${c}</strong> right now${address ? ` near ${safe(address)}` : ""}:</p>
<ul style="margin:0 0 20px 20px;padding:0;font-size:14px;color:#444;line-height:1.85;">
<li>Comp velocity up <strong>4–7%</strong> month-over-month in the median bracket</li>
<li>Active inventory below 6-month rolling average — sellers holding firmer on price</li>
<li>Insurance trajectory tightening across most CA desert zip codes</li>
</ul>
<p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.75;">If you're tracking more than one property — or want alerts when your DNA Score moves — the Pro plan watches up to 25 properties and pings you on shifts.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 8px;"><tr><td style="background:#1a1a1a;">
<a href="${pricingUrl}" style="display:inline-block;padding:14px 28px;color:#E8B84B;font-size:15px;text-decoration:none;letter-spacing:1px;">See Pro &rarr; $19/mo</a>
</td></tr></table>
<p style="margin:24px 0 0;font-size:13px;color:#888;line-height:1.7;">Pro = 25 tracked properties + heat maps + IntellaGraph AI.</p>
<p style="margin:8px 0 0;font-size:13px;color:#888;">— Dan</p>`);
  const text = [
    `Hi ${n},`, "",
    `Three things shifting in ${c} right now:`,
    "• Comp velocity up 4–7% MoM in the median bracket",
    "• Active inventory below 6-month rolling average",
    "• Insurance trajectory tightening across CA desert zips", "",
    `Pro plan watches up to 25 properties, alerts on shifts: ${pricingUrl}`, "",
    "— Dan",
  ].join("\n");
  return {
    subject: `What's moving in ${c} this week`,
    html, text,
  };
}

function tmplStep3({ name, address }) {
  const safe = (s) => (s || "").replace(/[<>]/g, "");
  const n = safe(name) || "there";
  const a = safe(address) || "the property";
  const dashUrl = `${APP_BASE}/dashboard`;
  const html = SHELL(`
<p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.75;">Hi ${n},</p>
<p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.75;">Quick question — when you ran the report on <strong>${a}</strong>, were you buying, selling, or just curious?</p>
<p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.75;">Reason I'm asking: I'm building tools differently for each. Buyers want offer-protection numbers, sellers want pre-listing levers, investors want yield trajectory. Hit reply with one word and I'll send the most useful next step for you — no pitch.</p>
<p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.75;">If you'd rather just re-open the report, link below.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0;"><tr><td style="background:#1a1a1a;">
<a href="${dashUrl}" style="display:inline-block;padding:14px 28px;color:#E8B84B;font-size:15px;text-decoration:none;letter-spacing:1px;">Open Dashboard &rarr;</a>
</td></tr></table>
<p style="margin:24px 0 0;font-size:13px;color:#888;line-height:1.7;">— Dan Stuart<br/>PropertyDNA</p>`,
  "you can reply STOP and we won't email again");
  const text = [
    `Hi ${n},`, "",
    `Quick question — when you ran the report on ${a}, were you buying, selling, or just curious?`, "",
    "Reply with one word and I'll send the most useful next step — no pitch.", "",
    `Or re-open your dashboard: ${dashUrl}`, "",
    "— Dan Stuart, PropertyDNA",
  ].join("\n");
  return {
    subject: `${a} — buying, selling, or curious?`,
    html, text,
  };
}

const TEMPLATES = { 1: tmplStep1, 2: tmplStep2, 3: tmplStep3 };

// ── Main ───────────────────────────────────────────────────────────────────
async function processStep({ step, ageDays, ageWindowDays }, dryRun) {
  const now = Date.now();
  const toDate   = new Date(now - ageDays * 86400000);                       // ageDays ago
  const fromDate = new Date(now - (ageDays + ageWindowDays) * 86400000);     // ageDays+window ago

  // Find candidate submissions in the window
  const reports = await db.from("property_reports")
    .select("email,full_address,address,city,role,created_at")
    .gte("created_at", fromDate.toISOString())
    .lte("created_at", toDate.toISOString())
    .order("created_at", { ascending: false })
    .get()
    .catch(() => []);

  if (!Array.isArray(reports) || reports.length === 0) {
    return { step, candidates: 0, sent: 0 };
  }

  // De-dupe by email (keep first occurrence — has freshest data)
  const seen = new Set();
  const unique = reports.filter(r => {
    const e = (r.email || "").toLowerCase().trim();
    if (!e || !e.includes("@") || seen.has(e)) return false;
    if (e === OWNER) return false;
    if (e.startsWith("healthcheck+")) return false;
    if (e.startsWith("test+")) return false;
    seen.add(e);
    return true;
  });

  // Bulk check: already-sent kpi events for this step
  const sentKpiType = `submitter_drip_step_${step}_sent`;
  const sentKpis = await db.from("kpi_events")
    .select("email").eq("event_type", sentKpiType)
    .in("email", unique.map(r => r.email.toLowerCase().trim()))
    .get().catch(() => []);
  const alreadySent = new Set((sentKpis || []).map(k => (k.email || "").toLowerCase()));

  // Bulk check: active subscriptions
  const subs = await db.from("subscriptions")
    .select("email").eq("status", "active")
    .in("email", unique.map(r => r.email.toLowerCase().trim()))
    .get().catch(() => []);
  const subscribed = new Set((subs || []).map(s => (s.email || "").toLowerCase()));

  let sent = 0, skipped = 0;
  const log = [];

  for (const r of unique) {
    const email = r.email.toLowerCase().trim();
    if (alreadySent.has(email)) { skipped++; continue; }
    if (subscribed.has(email))  { skipped++; continue; }

    const name = (r.full_address || "").split(",")[0]; // crude — n8n doesn't save full_name to property_reports
    const tmpl = TEMPLATES[step]({
      name:    null,                 // full_name not stored on property_reports — drop personalization
      address: r.full_address || r.address,
      city:    r.city,
    });

    if (dryRun) {
      log.push({ email, step, subject: tmpl.subject, would_send: true });
      continue;
    }

    const result = await sendEmail({ to: email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text });
    const ok = result.status >= 200 && result.status < 300;
    if (ok) {
      sent++;
      db.kpi(sentKpiType, email, { address: r.full_address || r.address, subject: tmpl.subject });
    } else {
      log.push({ email, step, error: result.status, body: (result.body || "").slice(0, 120) });
    }
  }

  return { step, candidates: unique.length, sent, skipped, log };
}

exports.handler = async (event) => {
  const dryRun = event?.queryStringParameters?.dry_run === "1";
  const results = [];
  for (const s of STEPS) {
    results.push(await processStep(s, dryRun));
  }
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ran_at: new Date().toISOString(), dry_run: dryRun, results }, null, 2),
  };
};
