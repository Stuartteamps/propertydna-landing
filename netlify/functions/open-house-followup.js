/**
 * open-house-followup — Hourly cron driving the Tom Ferry 8-touch cadence.
 *
 * Step 0 (T+0)    — instant SMS + email + matches  [done by capture-open-house-lead]
 * Step 1 (T+24h)  — SMS: "Great to meet you / quick question"
 * Step 2 (T+2d)   — Email: 3 matching off-market homes (deeper dive)
 * Step 3 (T+4d)   — SMS: "Any questions on the home or others you'd like to see?"
 * Step 4 (T+7d)   — Email: what's moving in Thunderbird CC / Heights this month
 * Step 5 (T+14d)  — Email: rates + buying-power update + DNA report nudge
 * Step 6 (T+21d)  — Email: personal note from Dan (no pitch)
 * Step 7 (T+30d)  — SMS + Email: loop-close ("last note from me; reply to stay in touch")
 *
 * Unsubscribed / replied SMS leads are skipped automatically.
 *
 * Schedule: netlify.toml [functions."open-house-followup"] schedule = "0 * * * *"
 */
const https = require("https");
const db    = require("./_supabase");
const { sendSMS } = require("./send-sms");
const { findOffMarketMatches } = require("./_off-market-matcher");

const SITE          = "https://thepropertydna.com";
const OWNER_EMAIL   = process.env.OWNER_EMAIL   || "stuartteamps@gmail.com";
const OWNER_PHONE   = process.env.OWNER_PHONE   || null;
const SENDER        = process.env.SENDER_EMAIL  || "reports@thepropertydna.com";
const SENDER_NAME   = process.env.SENDER_NAME   || "PropertyDNA";
const SMS_ENABLED   = process.env.SMS_ENABLED === "true";

// Server-side mirror of properties.ts — keeps parity for cron emails.
const PROPERTIES = {
  "40380-tonopah":   { address: "40380 Tonopah Road",   community: "Thunderbird Heights",                city: "Rancho Mirage", state: "CA", zip: "92270", price: "$2,999,999", beds: "3", baths: "4.5", sqft: "4,181", latitude: 33.7755, longitude: -116.4167 },
  "70629-boothill":  { address: "70629 Boothill Road",  community: "Thunderbird Heights",                city: "Rancho Mirage", state: "CA", zip: "92270", price: "$3,895,000", beds: "4", baths: "4.5", sqft: "6,452", latitude: 33.7748, longitude: -116.4180 },
  "40231-club-view": { address: "40231 Club View Drive", community: "Thunderbird Country Club Estates",  city: "Rancho Mirage", state: "CA", zip: "92270", price: "$4,300,000", beds: "4", baths: "4",   sqft: "4,821", latitude: 33.7700, longitude: -116.4220 },
  "9520-ekwanok":    { address: "9520 Ekwanok Dr",      community: "Mission Lakes Country Club",         city: "Desert Hot Springs", state: "CA", zip: "92240", price: "$433,000",   beds: "3", baths: "2",   sqft: "1,842" },
};

const STEP_DEFINITIONS = [
  { step: 1, minAgeHours: 24,  channel: "sms",   label: "T+1d intro" },
  { step: 2, minAgeHours: 48,  channel: "email", label: "T+2d matches" },
  { step: 3, minAgeHours: 96,  channel: "sms",   label: "T+4d check-in" },
  { step: 4, minAgeHours: 168, channel: "email", label: "T+7d market" },
  { step: 5, minAgeHours: 336, channel: "email", label: "T+14d rates" },
  { step: 6, minAgeHours: 504, channel: "email", label: "T+21d personal" },
  { step: 7, minAgeHours: 720, channel: "both",  label: "T+30d loop-close" },
];

// ── Resend ───────────────────────────────────────────────────────────────
function sendEmailViaResend({ to, subject, html, text, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return Promise.resolve({ status: 503, data: { error: "no_resend_key" } });

  const payload = JSON.stringify({
    from: `${SENDER_NAME} <${SENDER}>`,
    to, reply_to: replyTo || "stuartteamps@gmail.com",
    subject, html, text,
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api.resend.com", path: "/emails", method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    }, (res) => {
      let raw = ""; res.on("data", c => raw += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: { _raw: raw } }); }
      });
    });
    req.on("error", err => resolve({ status: 0, data: { error: err.message } }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ status: 0, data: { error: "timeout" } }); });
    req.write(payload);
    req.end();
  });
}

// ── Shared shell ─────────────────────────────────────────────────────────
function shell(inner) {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f9f7f4;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f4;">
<tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e5e0d8;">
<tr><td style="padding:32px 40px 24px;border-bottom:1px solid #e5e0d8;">
<p style="margin:0;font-size:11px;color:#999;letter-spacing:3px;text-transform:uppercase;">PropertyDNA</p>
</td></tr>
<tr><td style="padding:32px 40px;">${inner}</td></tr>
<tr><td style="padding:18px 40px;border-top:1px solid #e5e0d8;background:#faf8f5;">
<p style="margin:0;font-size:11px;color:#999;">PropertyDNA · thepropertydna.com · <a href="${SITE}/unsubscribe" style="color:#999;">Unsubscribe</a></p>
</td></tr></table></td></tr></table></body></html>`;
}

const safe = (s) => (s == null ? "" : String(s).replace(/[<>]/g, ""));
const firstNameOf = (lead) => safe(lead.first_name) || "there";

// ── Step content ─────────────────────────────────────────────────────────
function stepSMS(step, lead) {
  const n = firstNameOf(lead);
  const a = lead.property_address || "the open house";
  switch (step) {
    case 1: return `Hi ${n} — Dan again. Great to meet you at ${a}. Couple things to share: I pulled 3 off-market opportunities in your same enclave that fit your criteria. Want me to send the dossier? Reply YES.`;
    case 3: return `${n} — Dan from PropertyDNA. Any questions on ${a}, or homes you'd like to walk through this week? Happy to set up showings — no obligation. Reply with what you're thinking.`;
    case 7: return `${n} — final note. If timing isn't right just yet, no worries. The PropertyDNA tracker keeps watching Thunderbird for you in the background. Stay in touch — Dan. (Reply STOP to opt out)`;
    default: return "";
  }
}

function emailStep2({ lead, property, matches }) {
  const n = firstNameOf(lead);
  const matchRows = (matches || []).map(m => `
<div style="border-left:3px solid #C9A84C;padding:12px 0 12px 16px;margin:0 0 14px;">
<p style="margin:0 0 4px;font-size:16px;color:#1a1a1a;font-family:Georgia,serif;">${safe(m.address)}${m.distanceMi != null ? ` <span style="font-size:11px;color:#999;font-weight:400;">· ${m.distanceMi} mi away</span>` : ""}</p>
<p style="margin:0 0 4px;font-size:12px;color:#666;">${[m.beds && `${m.beds} bed`, m.baths && `${m.baths} bath`, m.sqft && `${Number(m.sqft).toLocaleString()} sqft`, m.yearBuilt && `built ${m.yearBuilt}`].filter(Boolean).join(" · ")}</p>
<p style="margin:0 0 6px;font-size:11px;color:#999;">${m.lastSaleDate ? `Last sold ${m.lastSaleDate}${m.lastSalePrice ? ` for $${Number(m.lastSalePrice).toLocaleString()}` : ""}` : "Long-tenured owner"}</p>
<p style="margin:4px 0 0;font-size:12px;"><a href="${safe(m.dossierUrl)}" style="color:#C9A84C;text-decoration:none;">View dossier &rarr;</a></p>
</div>`).join("");

  const html = shell(`
<p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.75;">Hi ${n},</p>
<p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.75;">Two days after your visit to <strong>${safe(property?.address || lead.property_address)}</strong> — here are the off-market opportunities the index pulled in your enclave. None of these are publicly listed, but each one fits your search profile.</p>
${matchRows || `<p style="margin:0 0 16px;font-size:14px;color:#888;line-height:1.7;">The index didn't surface any new matches today — Thunderbird is a tightly-held enclave. I'll keep watching and ping you the moment something opens up.</p>`}
<p style="margin:18px 0 24px;font-size:14px;color:#444;line-height:1.7;">Want me to reach out to any of these owners discreetly? Reply with the address and I'll handle the outreach.</p>
<table cellpadding="0" cellspacing="0"><tr><td style="background:#1a1a1a;">
<a href="${SITE}/property-dna" style="display:inline-block;padding:14px 28px;color:#E8B84B;font-size:15px;text-decoration:none;letter-spacing:1px;">Run a Free DNA Report &rarr;</a>
</td></tr></table>
<p style="margin:18px 0 0;font-size:13px;color:#777;line-height:1.7;">— Dan Stuart, PropertyDNA</p>`);

  const text = [
    `Hi ${n},`, "",
    `Two days after your visit to ${property?.address || lead.property_address} — off-market opportunities the index pulled:`,
    ...(matches || []).map(m => `  • ${m.address}${m.distanceMi != null ? ` (${m.distanceMi} mi)` : ""}: ${[m.beds && `${m.beds} bed`, m.baths && `${m.baths} bath`, m.sqft && `${m.sqft} sqft`].filter(Boolean).join(" · ")}`),
    "",
    `Reply with an address and I'll reach out to the owner discreetly.`,
    `Run a free DNA report: ${SITE}/property-dna`, "",
    "— Dan",
  ].join("\n");

  return { subject: `Off-market opportunities near ${property?.address || lead.property_address}`, html, text };
}

function emailStep4({ lead, property }) {
  const n = firstNameOf(lead);
  const c = safe(property?.community || lead.community || "your area");
  const html = shell(`
<p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.75;">Hi ${n},</p>
<p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.75;">Quick market read on <strong>${c}</strong> — what the algorithm is seeing this week:</p>
<ul style="margin:0 0 24px 20px;padding:0;font-size:14px;color:#444;line-height:1.85;">
  <li>Days-on-market for the median home stretched from <strong>57 → 71</strong> over the last 30 days — softening, not crashing.</li>
  <li>Active inventory below the trailing 12-month average by <strong>~14%</strong> — sellers holding firm.</li>
  <li>Sub-$5M listings in Thunderbird/Mirada are seeing <strong>2–3% price reductions</strong> after 60 DOM. That's your negotiation window.</li>
  <li>Insurance trajectory tightening across the Coachella Valley — affects carrying cost.</li>
</ul>
<p style="margin:0 0 18px;font-size:14px;color:#444;line-height:1.7;">If you'd like a full DNA report on the property you visited — comps, hazard layer, DNA score, valuation drift — it's free for your first report.</p>
<table cellpadding="0" cellspacing="0"><tr><td style="background:#1a1a1a;">
<a href="${SITE}/property-dna" style="display:inline-block;padding:14px 28px;color:#E8B84B;font-size:15px;text-decoration:none;letter-spacing:1px;">Get the Report &rarr;</a>
</td></tr></table>
<p style="margin:18px 0 0;font-size:13px;color:#777;line-height:1.7;">— Dan</p>`);
  const text = [
    `Hi ${n},`, "",
    `Quick read on ${c}:`,
    "• Median DOM: 57 → 71 (softening, not crashing)",
    "• Active inventory below 12-mo average by ~14%",
    "• Sub-$5M listings seeing 2-3% price cuts after 60 DOM — your window",
    "• Insurance tightening across the valley", "",
    `Free DNA report: ${SITE}/property-dna`, "", "— Dan",
  ].join("\n");
  return { subject: `${c} — what's moving this week`, html, text };
}

function emailStep5({ lead, property }) {
  const n = firstNameOf(lead);
  const html = shell(`
<p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.75;">Hi ${n},</p>
<p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.75;">It's been two weeks since we met at <strong>${safe(property?.address || lead.property_address)}</strong>. Wanted to share one piece of market math that changes the calculus:</p>
<p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.85;">In the desert luxury bracket, <strong>cash and cash-to-loan</strong> buyers represent over 70% of closings. That means rates matter less than people assume — what matters is having a verified valuation when you walk in, so you don't overpay or under-bid.</p>
<p style="margin:0 0 18px;font-size:14px;color:#444;line-height:1.85;">A PropertyDNA report on a property you're considering gives you that ground truth in 3 minutes: comp velocity, DNA score, hazard layer, and a verdict — would we buy it at the asking price.</p>
<table cellpadding="0" cellspacing="0"><tr><td style="background:#1a1a1a;">
<a href="${SITE}/property-dna" style="display:inline-block;padding:14px 28px;color:#E8B84B;font-size:15px;text-decoration:none;letter-spacing:1px;">Run a Report &rarr;</a>
</td></tr></table>
<p style="margin:18px 0 0;font-size:13px;color:#777;line-height:1.7;">— Dan Stuart, PropertyDNA</p>`);
  const text = [
    `Hi ${n},`, "",
    `Two weeks since we met at ${property?.address || lead.property_address}. One piece of math:`, "",
    "In desert luxury, ~70%+ of closings are cash or cash-to-loan.",
    "Rates matter less than having a verified valuation when you walk in.", "",
    `Run a DNA report: ${SITE}/property-dna`, "", "— Dan",
  ].join("\n");
  return { subject: "The math that matters in desert luxury", html, text };
}

function emailStep6({ lead, property }) {
  const n = firstNameOf(lead);
  const html = shell(`
<p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.75;">Hi ${n},</p>
<p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.75;">No pitch on this one. Just a personal note.</p>
<p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.75;">Three weeks ago you stopped by <strong>${safe(property?.address || lead.property_address)}</strong>. Whether or not it's the right home, your buying decision is going to involve more zeros than any other call you make this year, and I built PropertyDNA because most buyers don't get the data on their side of the table.</p>
<p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.75;">If at any point you want a sober second opinion on a property — yours, one you're considering, or a comp — reply to this email. No CRM funnel, just a human read.</p>
<p style="margin:0 0 0;font-size:15px;color:#444;line-height:1.75;">— Dan</p>`);
  const text = [
    `Hi ${n},`, "",
    "No pitch on this one. Just a personal note.", "",
    `Three weeks ago you stopped by ${property?.address || lead.property_address}. Whether or not it's the right home, your buying decision will involve more zeros than any other call you make this year. PropertyDNA exists so buyers get the data on their side of the table.`, "",
    "If you ever want a sober second opinion on a property, reply to this email. No funnel, just a human read.", "",
    "— Dan",
  ].join("\n");
  return { subject: `A note about ${property?.address || lead.property_address}`, html, text };
}

function emailStep7({ lead, property }) {
  const n = firstNameOf(lead);
  const html = shell(`
<p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.75;">Hi ${n},</p>
<p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.75;">Last note from me on the <strong>${safe(property?.address || lead.property_address)}</strong> follow-up. If your search is on pause, no problem.</p>
<p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.75;">Two ways to stay in touch with zero noise:</p>
<ul style="margin:0 0 20px 20px;padding:0;font-size:14px;color:#444;line-height:1.85;">
  <li><strong>PropertyDNA Pro</strong> — track up to 25 properties, alerts on DNA score shifts. $19/mo, cancel anytime.</li>
  <li><strong>Reply once with what you'd value</strong> — off-market drips, monthly market read, or nothing at all. Easy to dial in.</li>
</ul>
<p style="margin:0 0 18px;font-size:14px;color:#444;line-height:1.7;">Either way — appreciated meeting you. Reach me anytime at <a href="tel:+12132054933" style="color:#C9A84C;">(213) 205-4933</a> or this email.</p>
<p style="margin:0;font-size:14px;color:#444;line-height:1.7;">— Dan Stuart, PropertyDNA</p>`);
  const text = [
    `Hi ${n},`, "",
    `Last note from me on the ${property?.address || lead.property_address} follow-up.`, "",
    "Two ways to stay in touch with zero noise:",
    " • PropertyDNA Pro: track 25 properties, DNA shift alerts. $19/mo.",
    " • Reply once with what you'd value — off-market drips, monthly read, or nothing.", "",
    "Reach me anytime: (213) 205-4933 or reply here.", "", "— Dan",
  ].join("\n");
  return { subject: `Last note from me — ${property?.address || lead.property_address}`, html, text };
}

const EMAIL_BUILDERS = {
  2: emailStep2,
  4: emailStep4,
  5: emailStep5,
  6: emailStep6,
  7: emailStep7,
};

// When SMS is disabled (A2P 10DLC pending), SMS-channel steps become owner-alert
// emails with a tap-to-text link so Dan fires the touch from his personal phone.
function ownerAlertEmail({ step, lead }) {
  const n = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "(no name)";
  const a = lead.property_address || lead.property_slug || "(unknown property)";
  const phoneDigits = (lead.phone || "").replace(/[^\d]/g, "");
  const e164 = phoneDigits.length === 10 ? "+1" + phoneDigits : "+" + phoneDigits;
  const suggested = stepSMS(step, lead) || `Hi ${firstNameOf(lead)} — Dan from PropertyDNA. Checking in on ${a}.`;
  const smsLink = phoneDigits ? `sms:${e164}&body=${encodeURIComponent(suggested)}` : "";
  const dayLabel = ({ 1: "Day 1", 3: "Day 4", 7: "Day 30" })[step] || `Step ${step}`;

  if (!phoneDigits) {
    return {
      subject: `[${dayLabel}] ${n} — no phone on file, email touch skipped`,
      html: `<p>${n} signed in for ${a} but didn't leave a phone. Nothing to text. Email cadence continues.</p>`,
      text: `${n} signed in for ${a} but didn't leave a phone.`,
    };
  }

  const html = shell(`
<p style="margin:0 0 8px;font-size:11px;color:#999;letter-spacing:3px;text-transform:uppercase;">${dayLabel} touch · text needed</p>
<p style="margin:0 0 16px;font-size:18px;color:#1a1a1a;font-family:Georgia,serif;">${n} · ${lead.phone}</p>
<p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.7;">${a}${lead.community ? ` · ${lead.community}` : ""}</p>

<table cellpadding="0" cellspacing="0" style="margin:8px 0 16px;">
<tr><td style="background:#1a1a1a;">
<a href="${smsLink}" style="display:inline-block;padding:14px 28px;color:#E8B84B;font-family:Georgia,serif;font-size:15px;text-decoration:none;letter-spacing:1px;">Text ${(lead.first_name || "lead").replace(/[<>]/g,"")} now &rarr;</a>
</td></tr></table>

<p style="margin:0 0 6px;font-size:11px;color:#999;letter-spacing:2px;text-transform:uppercase;">Suggested message</p>
<p style="margin:0 0 16px;font-size:13px;color:#444;line-height:1.7;border-left:3px solid #e5e0d8;padding:10px 14px;background:#faf8f5;font-family:Georgia,serif;">${suggested}</p>

<p style="margin:0 0 14px;font-size:13px;color:#666;line-height:1.7;">
  <strong>Timeline:</strong> ${lead.buyer_timeline || "—"}<br/>
  <strong>Interest:</strong> ${lead.interest || "—"}
</p>
<p style="margin:0;font-size:11px;color:#aaa;">Auto-flips to direct SMS once Quo A2P approval lands. open_house_leads.id=${lead.id}</p>`);

  return {
    subject: `[${dayLabel}] Text ${n} — ${a}`,
    html,
    text: `${dayLabel} touch needed.\n${n} · ${lead.phone}\n${a}\n\nSuggested SMS:\n"${suggested}"\n\nTap-to-text: ${smsLink}`,
  };
}

// ── Cadence runner ───────────────────────────────────────────────────────
async function processStep({ step, minAgeHours, channel, label }) {
  const cutoff = new Date(Date.now() - minAgeHours * 3600 * 1000).toISOString();

  // Find leads at step-1 created at least minAgeHours ago, still active
  const candidates = await db.from("open_house_leads")
    .select("id,email,phone,first_name,last_name,property_slug,property_address,community,buyer_timeline,interest,follow_up_step,status,created_at")
    .eq("follow_up_step", step - 1)
    .eq("status", "active")
    .lte("created_at", cutoff)
    .limit(50)
    .get()
    .catch(() => []);

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { step, label, candidates: 0, sent: 0 };
  }

  let sent = 0, skipped = 0;
  const errors = [];

  for (const lead of candidates) {
    const property = lead.property_slug ? PROPERTIES[lead.property_slug] : null;
    let smsResult = null, emailResult = null;

    try {
      // SMS path: only attempt Quo if enabled. Otherwise email Dan a "text now" alert.
      if ((channel === "sms" || channel === "both") && lead.phone) {
        const text = stepSMS(step, lead);
        if (text) {
          if (SMS_ENABLED) {
            smsResult = await sendSMS({ to: lead.phone, text, leadId: lead.id });
          } else {
            const tmpl = ownerAlertEmail({ step, lead });
            await sendEmailViaResend({
              to: OWNER_EMAIL,
              subject: tmpl.subject,
              html: tmpl.html,
              text: tmpl.text,
              replyTo: lead.email,
            });
            smsResult = { sent: false, skipped: "owner_alert_sent" };
          }
        }
      }

      if (channel === "email" || channel === "both") {
        const builder = EMAIL_BUILDERS[step];
        if (builder) {
          let extra = {};
          if (step === 2 && property) {
            extra.matches = await findOffMarketMatches(property, 3).catch(() => []);
          }
          const tmpl = builder({ lead, property, ...extra });
          emailResult = await sendEmailViaResend({
            to: lead.email,
            subject: tmpl.subject,
            html: tmpl.html,
            text: tmpl.text,
          });
        }
      }

      // Advance step even if one channel failed, so we don't re-fire endlessly
      await db.from("open_house_leads").eq("id", lead.id).update({
        follow_up_step: step,
        follow_up_sent_at: new Date().toISOString(),
        last_event: `step_${step}_${channel}`,
      }).catch(() => {});

      const anySent = (smsResult && smsResult.sent) || (emailResult && emailResult.status < 300);
      if (anySent) sent++; else skipped++;

      db.kpi("open_house_followup_sent", lead.email, {
        step, channel,
        sms_ok: smsResult?.sent === true,
        email_ok: emailResult ? emailResult.status < 300 : null,
        property_slug: lead.property_slug,
      });

      await pause(250);
    } catch (e) {
      errors.push({ email: lead.email, step, err: e.message });
    }
  }

  return { step, label, candidates: candidates.length, sent, skipped, errors };
}

function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Handler ──────────────────────────────────────────────────────────────
exports.handler = async () => {
  const results = [];
  for (const def of STEP_DEFINITIONS) {
    try {
      results.push(await processStep(def));
    } catch (e) {
      results.push({ step: def.step, label: def.label, error: e.message });
    }
  }
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ran_at: new Date().toISOString(), results }, null, 2),
  };
};
