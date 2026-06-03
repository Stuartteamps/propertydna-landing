/**
 * capture-open-house-lead — Instant flow when a guest signs in at the open house.
 *
 * Replaces the n8n round-trip for the OPEN_HOUSE funnel. Called directly by
 * /open-house page on form submit.
 *
 * What it does (all in <2s):
 *   1. Inserts into open_house_leads (idempotent on email+property_slug)
 *   2. Queries off-market matches near the subject property
 *   3. Sends instant SMS to the guest (Quo) — short personal intro
 *   4. Sends instant email to the guest (Resend) — property details + matches
 *   5. Notifies Dan via SMS + email — new lead alert
 *
 * Cadence steps 1-8 run via the open-house-followup hourly cron.
 *
 * POST body — same shape as old n8n funnel payload:
 *   email, firstName, lastName, phone, propertySlug, propertyAddress,
 *   community, agent, campaign, leadSource, workingWithAgent, buyerTimeline,
 *   interest, message, utm*, pageUrl, userAgent, referrer
 */
const https = require("https");
const db    = require("./_supabase");
const { sendSMS } = require("./send-sms");
const { findOffMarketMatches } = require("./_off-market-matcher");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

const SITE = "https://thepropertydna.com";
const OWNER_EMAIL = process.env.OWNER_EMAIL || "stuartteamps@gmail.com";
const OWNER_PHONE = process.env.OWNER_PHONE || null; // set in Netlify env to enable owner SMS alerts
const SENDER = process.env.SENDER_EMAIL || "reports@thepropertydna.com";
const SENDER_NAME = process.env.SENDER_NAME || "PropertyDNA";

// Properties config — kept in sync with app/frontend/src/config/properties.ts
// Server-side mirror so we can render server-side emails without bundling frontend.
const PROPERTIES = {
  "40380-tonopah": {
    address: "40380 Tonopah Road",
    community: "Thunderbird Heights",
    city: "Rancho Mirage", state: "CA", zip: "92270",
    price: "$2,999,999", beds: "3", baths: "4.5", sqft: "4,181",
    latitude: 33.7755, longitude: -116.4167,
    description: "Contemporary estate on over half an acre, panoramic mountain and city-light views, saltwater pool, outdoor kitchen, owned solar.",
  },
  "70629-boothill": {
    address: "70629 Boothill Road",
    community: "Thunderbird Heights",
    city: "Rancho Mirage", state: "CA", zip: "92270",
    price: "$3,895,000", beds: "4", baths: "4.5", sqft: "6,452",
    latitude: 33.7748, longitude: -116.4180,
    description: "Celebrity-owned estate on nearly two-thirds of an acre, four fireplaces, walls of glass framing mountain views.",
  },
  "40231-club-view": {
    address: "40231 Club View Drive",
    community: "Thunderbird Country Club Estates",
    city: "Rancho Mirage", state: "CA", zip: "92270",
    price: "$4,300,000", beds: "4", baths: "4", sqft: "4,821",
    latitude: 33.7700, longitude: -116.4220,
    description: "William Cody mid-century icon on the 18th fairway — one of only 28 residences in Thunderbird Estates.",
  },
  "9520-ekwanok": {
    address: "9520 Ekwanok Dr",
    community: "Mission Lakes Country Club",
    city: "Desert Hot Springs", state: "CA", zip: "92240",
    price: "$433,000", beds: "3", baths: "2", sqft: "1,842",
    description: "Golf course living in Mission Lakes Country Club with mountain views and resort-style amenities.",
  },
};

// ── Resend ───────────────────────────────────────────────────────────────
function sendEmailViaResend({ to, subject, html, text, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return Promise.resolve({ status: 503, data: { error: "no_resend_key" } });

  const payload = JSON.stringify({
    from: `${SENDER_NAME} <${SENDER}>`,
    to,
    reply_to: replyTo || "stuartteamps@gmail.com",
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

// ── Templates ────────────────────────────────────────────────────────────
function instantSMS({ firstName, propertyAddress }) {
  const n = firstName || "there";
  const a = propertyAddress ? `at ${propertyAddress}` : "today";
  return `Hi ${n} — Dan Stuart with PropertyDNA. Thanks for stopping by ${a}. I'll send the full details + a few nearby off-market opportunities to your email shortly. Text me anytime with questions. (Reply STOP to opt out.)`;
}

function ownerNotifySMS(lead) {
  const n = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "(no name)";
  const a = lead.property_address || lead.property_slug || "(unknown property)";
  return `New OH lead: ${n} (${lead.email}${lead.phone ? ", " + lead.phone : ""}) at ${a}. Timeline: ${lead.buyer_timeline || "n/a"} · Interest: ${lead.interest || "n/a"}${lead.working_with_agent ? " · Agent: " + lead.working_with_agent : ""}`;
}

function suggestedInstantSMS(lead) {
  const n = (lead.first_name || "there").replace(/[<>]/g, "");
  const a = lead.property_address ? `at ${lead.property_address}` : "today";
  return `Hi ${n} — Dan Stuart with PropertyDNA. Thanks for stopping by ${a}. Sending the full details + a few nearby off-market opportunities to your email shortly. Text me anytime with questions.`;
}

function ownerNotifyEmail(lead) {
  const n = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "(no name)";
  const phoneDigits = (lead.phone || "").replace(/[^\d]/g, "");
  const smsLink = phoneDigits ? `sms:+${phoneDigits.length === 10 ? "1" + phoneDigits : phoneDigits}&body=${encodeURIComponent(suggestedInstantSMS(lead))}` : "";
  const telLink = phoneDigits ? `tel:+${phoneDigits.length === 10 ? "1" + phoneDigits : phoneDigits}` : "";

  const rows = [
    ["Name", n],
    ["Email", lead.email],
    ["Phone", lead.phone ? `<a href="${telLink}" style="color:#C9A84C;text-decoration:none;">${lead.phone}</a>` : "—"],
    ["Property", lead.property_address || lead.property_slug],
    ["Community", lead.community || "—"],
    ["Working with agent?", lead.working_with_agent || "—"],
    ["Buying timeline", lead.buyer_timeline || "—"],
    ["Interest", lead.interest || "—"],
    ["Notes", lead.message || "—"],
    ["Lead source", lead.lead_source || "—"],
    ["UTM", [lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(Boolean).join(" / ") || "—"],
  ];

  const ctaBlock = phoneDigits ? `
<table cellpadding="0" cellspacing="0" style="margin:20px 0 8px;">
<tr><td style="background:#1a1a1a;padding:0;">
<a href="${smsLink}" style="display:inline-block;padding:14px 26px;color:#E8B84B;font-family:Georgia,serif;font-size:15px;text-decoration:none;letter-spacing:1px;">Text ${(lead.first_name || "Lead").replace(/[<>]/g,"")} now &rarr;</a>
</td></tr></table>
<p style="margin:6px 0 14px;font-size:12px;color:#888;line-height:1.6;">Tap the button on your phone — opens iMessage pre-filled with the standard intro.</p>
<p style="margin:0 0 14px;font-size:11px;color:#999;font-family:Georgia,serif;border-left:3px solid #e5e0d8;padding:10px 12px;background:#faf8f5;">"${suggestedInstantSMS(lead)}"</p>` : `<p style="margin:14px 0;font-size:13px;color:#888;font-style:italic;">(No phone provided — email-only follow-up.)</p>`;

  const html = `<table cellpadding="0" cellspacing="0" style="font-family:Georgia,serif;border-collapse:collapse;width:100%;max-width:580px;">
<thead><tr><td colspan="2" style="padding:12px 0;border-bottom:1px solid #ddd;font-size:13px;letter-spacing:2px;color:#999;text-transform:uppercase;">New Open House Lead</td></tr></thead>
<tbody>${rows.map(([k, v]) => `<tr><td style="padding:8px 12px 8px 0;font-size:13px;color:#888;width:160px;vertical-align:top;">${k}</td><td style="padding:8px 0;font-size:14px;color:#222;">${v}</td></tr>`).join("")}</tbody>
</table>
${ctaBlock}
<p style="margin:20px 0 0;font-size:12px;color:#aaa;font-family:Georgia,serif;">Captured ${new Date().toISOString()} · open_house_leads.id=${lead.id || "(pending)"}</p>`;

  return {
    subject: `New OH lead: ${n} — ${lead.property_address || lead.property_slug}`,
    html,
    text: rows.map(([k, v]) => `${k}: ${(v || "").toString().replace(/<[^>]+>/g, "")}`).concat([
      "",
      phoneDigits ? `Suggested SMS to ${lead.phone}:` : "",
      phoneDigits ? `"${suggestedInstantSMS(lead)}"` : "",
    ]).join("\n"),
  };
}

function guestEmail({ firstName, property, matches }) {
  const n = firstName || "there";
  const safe = (s) => (s || "").toString().replace(/[<>]/g, "");

  const matchesHtml = matches && matches.length
    ? `<tr><td style="padding:24px 40px 0;">
<p style="margin:0 0 8px;font-size:11px;color:#999;letter-spacing:3px;text-transform:uppercase;">Off-Market Opportunities Nearby</p>
<p style="margin:0 0 16px;font-size:13px;color:#888;line-height:1.7;">Long-tenured owners in the same enclave with similar specs — these aren't listed, but they match your search profile. We track them via the PropertyDNA index.</p>
${matches.map(m => `<div style="border-left:3px solid #C9A84C;padding:10px 0 10px 14px;margin:0 0 12px;">
<p style="margin:0 0 4px;font-size:15px;color:#1a1a1a;font-family:Georgia,serif;">${safe(m.address)}${m.distanceMi != null ? `<span style="font-size:11px;color:#999;font-weight:400;letter-spacing:2px;text-transform:uppercase;"> · ${m.distanceMi} mi</span>` : ""}</p>
<p style="margin:0 0 4px;font-size:12px;color:#666;">${[m.beds && `${m.beds} bed`, m.baths && `${m.baths} bath`, m.sqft && `${Number(m.sqft).toLocaleString()} sqft`, m.yearBuilt && `built ${m.yearBuilt}`].filter(Boolean).join(" · ")}</p>
<p style="margin:0;font-size:11px;color:#999;">${m.lastSaleDate ? `Last sold ${m.lastSaleDate}${m.lastSalePrice ? ` for $${Number(m.lastSalePrice).toLocaleString()}` : ""}` : "Long-tenured owner"}</p>
</div>`).join("")}
<p style="margin:0 0 16px;font-size:12px;color:#777;line-height:1.7;">Want me to reach out discreetly to any of these owners? Reply with the address and I'll handle the outreach personally.</p>
</td></tr>`
    : "";

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f9f7f4;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f4;">
<tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e5e0d8;">

<tr><td style="padding:32px 40px 24px;border-bottom:1px solid #e5e0d8;">
<p style="margin:0;font-size:11px;color:#999;letter-spacing:3px;text-transform:uppercase;">PropertyDNA</p>
</td></tr>

<tr><td style="padding:32px 40px 0;">
<p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.75;">Hi ${safe(n)},</p>
<p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.75;">Thanks for stopping by <strong>${safe(property.address)}</strong> today. Here's what you came in for, plus a few off-market opportunities the algorithm pulled in your same enclave.</p>
</td></tr>

<tr><td style="padding:24px 40px 0;">
<p style="margin:0 0 8px;font-size:11px;color:#999;letter-spacing:3px;text-transform:uppercase;">The Home</p>
<p style="margin:0 0 6px;font-size:20px;color:#1a1a1a;font-family:Georgia,serif;">${safe(property.address)}</p>
<p style="margin:0 0 6px;font-size:13px;color:#666;">${safe(property.community)} · ${safe(property.city)}, ${safe(property.state)}</p>
<p style="margin:0 0 12px;font-size:22px;color:#C9A84C;font-family:Georgia,serif;">${safe(property.price)}</p>
<p style="margin:0 0 16px;font-size:13px;color:#555;line-height:1.85;">${[property.beds && `<strong>${property.beds}</strong> bed`, property.baths && `<strong>${property.baths}</strong> bath`, property.sqft && `<strong>${property.sqft}</strong> sqft`].filter(Boolean).join(" &nbsp;·&nbsp; ")}</p>
<p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.85;">${safe(property.description)}</p>
</td></tr>

${matchesHtml}

<tr><td style="padding:24px 40px;">
<table cellpadding="0" cellspacing="0"><tr><td style="background:#1a1a1a;">
<a href="${SITE}/property-dna" style="display:inline-block;padding:14px 28px;color:#E8B84B;font-size:15px;text-decoration:none;letter-spacing:1px;">Run a Free DNA Report on Any Address &rarr;</a>
</td></tr></table>
<p style="margin:18px 0 0;font-size:13px;color:#777;line-height:1.7;">Reply directly to this email — it goes straight to my inbox. Or text me at <a href="tel:+12132054933" style="color:#C9A84C;">(213) 205-4933</a>.</p>
<p style="margin:14px 0 0;font-size:14px;color:#1a1a1a;font-family:Georgia,serif;">— Dan Stuart, PropertyDNA</p>
</td></tr>

<tr><td style="padding:18px 40px;border-top:1px solid #e5e0d8;background:#faf8f5;">
<p style="margin:0;font-size:11px;color:#999;">PropertyDNA · thepropertydna.com · Reply STOP to unsubscribe</p>
</td></tr>

</table></td></tr></table></body></html>`;

  const text = [
    `Hi ${n},`, "",
    `Thanks for stopping by ${property.address} today.`, "",
    `${property.address} — ${property.community}`,
    `${property.price} · ${property.beds}BR/${property.baths}BA · ${property.sqft} sqft`,
    property.description, "",
    matches && matches.length ? "Off-market opportunities nearby:" : "",
    ...(matches || []).map(m => `  ${m.address}${m.distanceMi != null ? ` (${m.distanceMi} mi)` : ""} — ${[m.beds && `${m.beds} bed`, m.baths && `${m.baths} bath`, m.sqft && `${m.sqft} sqft`].filter(Boolean).join(" · ")}`),
    "",
    `Run a free DNA report on any address: ${SITE}/property-dna`,
    `Reply to this email or text (213) 205-4933.`,
    "", "— Dan Stuart, PropertyDNA",
  ].filter(Boolean).join("\n");

  return {
    subject: `Thanks for visiting ${property.address} — your follow-up`,
    html, text,
  };
}

// ── Handler ──────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const email = (body.email || "").toLowerCase().trim();
  if (!email || !email.includes("@")) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Valid email required" }) };
  }

  const propertySlug = body.propertySlug || "";
  const property = PROPERTIES[propertySlug] || null;
  const propertyAddress = body.propertyAddress || (property ? `${property.address}, ${property.city}, ${property.state} ${property.zip}` : "");

  // ── 1. Insert lead ─────────────────────────────────────────────────────
  const leadRow = {
    email,
    phone: body.phone || null,
    first_name: body.firstName || null,
    last_name: body.lastName || null,
    property_slug: propertySlug || null,
    property_address: propertyAddress || null,
    community: property?.community || body.community || null,
    agent: body.agent || "daniel",
    campaign: body.campaign || (property ? `open_house_${propertySlug.replace(/-/g, "_")}` : "open_house"),
    lead_source: body.leadSource || (body.utmSource === "qr" ? "qr_open_house" : "web_open_house"),
    working_with_agent: body.workingWithAgent || null,
    buyer_timeline: body.buyerTimeline || null,
    interest: body.interest || null,
    message: body.message || null,
    utm_source: body.utmSource || null,
    utm_medium: body.utmMedium || null,
    utm_campaign: body.utmCampaign || null,
    page_url: body.pageUrl || null,
    user_agent: body.userAgent || null,
    referrer: body.referrer || null,
    follow_up_step: 0,
    status: "active",
  };

  let leadId = null;
  try {
    const inserted = await db.insert("open_house_leads", leadRow);
    leadId = Array.isArray(inserted) && inserted[0] ? inserted[0].id : null;
  } catch (e) {
    console.error("[capture-open-house-lead] insert failed:", e.message);
    // Don't fail the whole flow — guest still gets confirmation
  }
  leadRow.id = leadId;

  // ── 2. Off-market matches (parallel with everything else) ──────────────
  const matchesPromise = property ? findOffMarketMatches(property, 3).catch(() => []) : Promise.resolve([]);

  // ── 3. Guest SMS (instant intro) ───────────────────────────────────────
  let guestSmsResult = { sent: false, skipped: "no_phone" };
  if (body.phone) {
    guestSmsResult = await sendSMS({
      to: body.phone,
      text: instantSMS({ firstName: body.firstName, propertyAddress }),
      leadId,
    });
  }

  // ── 4. Guest email (instant — with matches) ────────────────────────────
  const matches = await matchesPromise;
  const guestTmpl = property
    ? guestEmail({ firstName: body.firstName, property, matches })
    : guestEmail({ firstName: body.firstName, property: { address: "your property", community: "—", city: "", state: "", price: "", beds: "", baths: "", sqft: "", description: "Welcome — let's get you set up." }, matches: [] });

  const guestEmailResult = await sendEmailViaResend({
    to: email,
    subject: guestTmpl.subject,
    html: guestTmpl.html,
    text: guestTmpl.text,
  });

  // ── 5. Notify Dan (SMS + email, parallel) ──────────────────────────────
  const [ownerSmsResult, ownerEmailResult] = await Promise.all([
    OWNER_PHONE ? sendSMS({ to: OWNER_PHONE, text: ownerNotifySMS(leadRow), leadId }) : Promise.resolve({ sent: false, skipped: "no_owner_phone" }),
    (async () => {
      const tmpl = ownerNotifyEmail(leadRow);
      return sendEmailViaResend({ to: OWNER_EMAIL, subject: tmpl.subject, html: tmpl.html, text: tmpl.text, replyTo: email });
    })(),
  ]);

  // Mark step 0 done so the cron doesn't re-fire instant touches
  if (leadId) {
    db.from("open_house_leads").eq("id", leadId).update({
      follow_up_step: 0,
      follow_up_sent_at: new Date().toISOString(),
      last_event: "instant_capture",
    }).catch(() => {});
  }

  db.kpi("open_house_lead_captured", email, {
    property_slug: propertySlug,
    lead_source: leadRow.lead_source,
    matches_count: matches.length,
    sms_sent: guestSmsResult.sent === true,
    email_sent: guestEmailResult.status < 300,
  });

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      success: true,
      leadId,
      matchCount: matches.length,
      matches,                                      // full array — rendered on the welcome page
      sms: guestSmsResult.sent === true,
      email: guestEmailResult.status < 300,
    }),
  };
};
