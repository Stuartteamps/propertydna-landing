/**
 * send-outreach-batch — Personalized homeowner outreach emails
 *
 * Pulls pending contacts from campaign_contacts, enriches each with
 * city-level market data from market_snapshots, generates a personalized
 * email per homeowner, and sends via Resend.
 *
 * POST body:
 *   campaignId  UUID    — campaign to process
 *   batchSize?  int     — contacts per call (default 50, max 100)
 *   dryRun?     bool    — generate but don't send; returns preview HTML
 *
 * Auth: x-internal-key header
 *
 * Returns: { sent, failed, remaining, dryRunSample? }
 */
const https = require("https");
const db    = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

const SITE = "https://thepropertydna.com";
const YEAR = new Date().getFullYear();

// ── City slug map for market_snapshots lookup ────────────────────────────────
const CITY_SLUG = {
  "palm springs":      "palm-springs",
  "cathedral city":    "cathedral-city",
  "rancho mirage":     "rancho-mirage",
  "palm desert":       "palm-desert",
  "indian wells":      "indian-wells",
  "la quinta":         "la-quinta",
  "indio":             "indio",
  "desert hot springs":"desert-hot-springs",
  "coachella":         "coachella",
  "thousand palms":    "thousand-palms",
};

// ── Market snapshot cache (per invocation) ───────────────────────────────────
const _snapCache = {};
async function getMarketSnapshot(city) {
  const slug = CITY_SLUG[(city || "").toLowerCase().trim()];
  if (!slug) return null;
  if (_snapCache[slug]) return _snapCache[slug];
  try {
    const rows = await db.from("market_snapshots")
      .select("median_price,avg_price_per_sqft,median_dom,active_listings,absorption_rate,appreciation_rate_yoy,demand_score")
      .eq("geo_key", slug)
      .eq("geo_type", "city")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .get();
    _snapCache[slug] = rows?.[0] || null;
  } catch {
    _snapCache[slug] = null;
  }
  return _snapCache[slug];
}

// ── HTTPS helper ─────────────────────────────────────────────────────────────
function httpsPost(hostname, path, headers, body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), ...headers },
    }, (res) => {
      let raw = "";
      res.on("data", c => raw += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: { _raw: raw } }); }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ── Email builder ─────────────────────────────────────────────────────────────
function buildOutreachEmail({ contact, market, subject, campaignId }) {
  const firstName   = contact.first_name || "Homeowner";
  const address     = contact.address    || "your property";
  const city        = contact.city       || "your area";
  const unsubUrl    = `${SITE}/.netlify/functions/unsubscribe?e=${Buffer.from(contact.email).toString("base64")}&c=${campaignId}`;
  const reportUrl   = `${SITE}/?address=${encodeURIComponent(address + ", " + city + ", " + (contact.state || "CA") + " " + (contact.zip || ""))}`;

  // Market signals block
  let marketBlock = "";
  let marketText  = "";
  if (market) {
    const fmt = n => n ? "$" + Math.round(n).toLocaleString() : null;
    const fmtPct = n => n ? (n > 0 ? "+" : "") + n.toFixed(1) + "%" : null;
    const lines = [];
    if (market.median_price)          lines.push(`<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;"><span style="font-size:13px;color:#777;font-family:Georgia,serif;">Median Sale Price</span></td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;"><strong style="font-size:13px;color:#1a1a1a;font-family:Georgia,serif;">${fmt(market.median_price)}</strong></td></tr>`);
    if (market.median_dom)            lines.push(`<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;"><span style="font-size:13px;color:#777;font-family:Georgia,serif;">Avg. Days on Market</span></td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;"><strong style="font-size:13px;color:#1a1a1a;font-family:Georgia,serif;">${market.median_dom} days</strong></td></tr>`);
    if (market.absorption_rate)       lines.push(`<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;"><span style="font-size:13px;color:#777;font-family:Georgia,serif;">Supply</span></td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;"><strong style="font-size:13px;color:#1a1a1a;font-family:Georgia,serif;">${market.absorption_rate.toFixed(1)} mo.</strong></td></tr>`);
    if (market.appreciation_rate_yoy) lines.push(`<tr><td style="padding:6px 0;"><span style="font-size:13px;color:#777;font-family:Georgia,serif;">Year-over-Year</span></td><td style="padding:6px 0;text-align:right;"><strong style="font-size:13px;color:${market.appreciation_rate_yoy >= 0 ? "#2e7d32" : "#c62828"};font-family:Georgia,serif;">${fmtPct(market.appreciation_rate_yoy)}</strong></td></tr>`);

    if (lines.length) {
      marketBlock = `
        <tr><td style="padding:0 0 8px;">
          <p style="margin:0;font-size:13px;color:#999;font-family:Georgia,serif;letter-spacing:1px;text-transform:uppercase;">${city} Market — Current</p>
        </td></tr>
        <tr><td style="padding:0 0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e0d8;">${lines.join("")}</table>
        </td></tr>`;
      marketText = `\n${city} Market Snapshot:\n` + [
        market.median_price          ? `Median Price: ${fmt(market.median_price)}` : null,
        market.median_dom            ? `Avg. Days on Market: ${market.median_dom}` : null,
        market.absorption_rate       ? `Supply: ${market.absorption_rate.toFixed(1)} months` : null,
        market.appreciation_rate_yoy ? `Year-over-Year: ${fmtPct(market.appreciation_rate_yoy)}` : null,
      ].filter(Boolean).join("\n");
    }
  }

  const demandLine = market?.absorption_rate < 3
    ? `It's a <strong>seller's market</strong> — inventory is low and qualified buyers are active.`
    : market?.absorption_rate > 6
    ? `Inventory has increased — buyers have more options, making presentation and pricing critical.`
    : `The market is balanced, with steady buyer demand and normal inventory levels.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f9f7f4;font-family:Georgia,'Times New Roman',serif;">
  <span style="display:none;max-height:0;overflow:hidden;">We've been tracking the market near your home — here's what we're seeing.&nbsp;&zwnj;</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f4;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #e5e0d8;">

        <!-- Header -->
        <tr><td style="padding:28px 40px 24px;border-bottom:1px solid #e5e0d8;">
          <p style="margin:0;font-size:11px;color:#999;letter-spacing:3px;text-transform:uppercase;font-family:Georgia,serif;">PropertyDNA</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 40px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

            <!-- Address headline -->
            <tr><td style="padding:0 0 6px;">
              <p style="margin:0;font-size:20px;font-weight:normal;color:#1a1a1a;line-height:1.3;font-family:Georgia,serif;">${address}</p>
            </td></tr>
            <tr><td style="padding:0 0 24px;">
              <p style="margin:0;font-size:12px;color:#999;font-family:Georgia,serif;">${city}${contact.state ? ", " + contact.state : ""}${contact.zip ? " " + contact.zip : ""}</p>
            </td></tr>

            <!-- Greeting -->
            <tr><td style="padding:0 0 20px;">
              <p style="margin:0;font-size:15px;color:#333;line-height:1.75;font-family:Georgia,serif;">Hi ${firstName},</p>
            </td></tr>
            <tr><td style="padding:0 0 20px;">
              <p style="margin:0;font-size:15px;color:#333;line-height:1.75;font-family:Georgia,serif;">We've been monitoring the market near <strong>${address}</strong> and wanted to share what we're seeing. ${demandLine}</p>
            </td></tr>

            <!-- Market data table -->
            ${marketBlock}

            <!-- Body copy -->
            <tr><td style="padding:0 0 24px;">
              <p style="margin:0;font-size:15px;color:#333;line-height:1.75;font-family:Georgia,serif;">We built a free Property DNA report for your address — it includes a data-driven valuation range, comparable sales within 1 mile, flood and hazard status, and a direct verdict on current market timing for your home.</p>
            </td></tr>

            <!-- CTA -->
            <tr><td style="padding:0 0 32px;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="background:#1a1a1a;">
                  <a href="${reportUrl}" style="display:inline-block;padding:14px 28px;color:#E8B84B;font-family:Georgia,serif;font-size:15px;text-decoration:none;letter-spacing:1px;">See Your Free Property Report &rarr;</a>
                </td>
              </tr></table>
              <p style="margin:12px 0 0;font-size:11px;color:#aaa;word-break:break-all;">Or copy: ${reportUrl}</p>
            </td></tr>

          </table>
        </td></tr>

        <!-- Signature -->
        <tr><td style="padding:24px 40px;border-top:1px solid #e5e0d8;background:#faf8f5;">
          <p style="margin:0 0 4px;font-size:14px;color:#1a1a1a;font-family:Georgia,serif;">PropertyDNA</p>
          <p style="margin:0;font-size:12px;color:#777;">thepropertydna.com</p>
        </td></tr>

        <!-- Footer / unsubscribe -->
        <tr><td style="padding:16px 40px;border-top:1px solid #e5e0d8;">
          <p style="margin:0;font-size:11px;color:#bbb;line-height:1.6;">&copy; ${YEAR} PropertyDNA. This message was sent to ${contact.email} because your property is located in the Coachella Valley market we cover. <a href="${unsubUrl}" style="color:#bbb;">Unsubscribe</a>.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    subject,
    "".padEnd(50, "-"),
    "",
    `Hi ${firstName},`,
    "",
    `We've been monitoring the market near ${address}.`,
    marketText,
    "",
    `We built a free Property DNA report for your address — valuation, comparables, flood status, and market timing.`,
    "",
    `See your report: ${reportUrl}`,
    "",
    "".padEnd(50, "-"),
    "PropertyDNA",
    "Real Estate Intelligence",
    "daniel@thepropertydna.com",
    SITE,
    "",
    `Unsubscribe: ${unsubUrl}`,
  ].join("\n");

  return { html, text };
}

// ── Resend sender ─────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html, text, unsubUrl }) {
  const key    = process.env.RESEND_API_KEY;
  const from   = `${process.env.CAMPAIGN_SENDER_NAME || "PropertyDNA"} <${process.env.CAMPAIGN_SENDER_EMAIL || "hello@mail.thepropertydna.com"}>`;
  const replyTo = process.env.REPLY_TO_EMAIL || "stuartteamps@gmail.com";
  const unsubMailto = process.env.UNSUB_MAILTO || "unsubscribe@mail.thepropertydna.com";
  if (!key) throw new Error("RESEND_API_KEY not set");
  const headers = unsubUrl ? {
    "List-Unsubscribe":      `<mailto:${unsubMailto}?subject=unsubscribe>, <${unsubUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  } : undefined;
  return httpsPost("api.resend.com", "/emails", { Authorization: `Bearer ${key}` }, {
    from, reply_to: replyTo, to, subject, html, text, ...(headers ? { headers } : {}),
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const internalKey = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (process.env.INTERNAL_API_KEY && internalKey !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { campaignId, batchSize = 50, dryRun = false } = body;
  if (!campaignId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "campaignId required" }) };

  const limit = Math.min(Math.max(parseInt(batchSize) || 50, 1), 100);

  // ── Load campaign ─────────────────────────────────────────────
  let campaign;
  try {
    const rows = await db.from("campaigns").select("*").eq("id", campaignId).get();
    campaign = rows?.[0];
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Failed to load campaign: " + err.message }) };
  }
  if (!campaign) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Campaign not found" }) };

  const subject = campaign.subject || "We analyzed your neighborhood — Property DNA";

  // ── Load pending contacts ─────────────────────────────────────
  let contacts;
  try {
    contacts = await db.from("campaign_contacts")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit)
      .get();
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Failed to load contacts: " + err.message }) };
  }

  if (!contacts || contacts.length === 0) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ sent: 0, failed: 0, remaining: 0, message: "No pending contacts" }) };
  }

  // ── Count remaining ───────────────────────────────────────────
  let remaining = 0;
  try {
    const all = await db.from("campaign_contacts").select("id").eq("campaign_id", campaignId).eq("status", "pending").get();
    remaining = Math.max(0, (all?.length || 0) - contacts.length);
  } catch { /* non-critical */ }

  // ── Mark campaign as sending ──────────────────────────────────
  if (!dryRun && campaign.status === "draft") {
    db.update("campaigns", { id: campaignId }, { status: "sending", launched_at: new Date().toISOString() })
      .catch(e => console.warn("[send-outreach-batch] status update:", e.message));
  }

  // ── Send loop ─────────────────────────────────────────────────
  let sent = 0;
  let failed = 0;
  let dryRunSample = null;

  for (const contact of contacts) {
    const market = await getMarketSnapshot(contact.city);
    const { html, text } = buildOutreachEmail({ contact, market, subject, campaignId });

    if (dryRun) {
      if (!dryRunSample) dryRunSample = html;
      sent++;
      continue;
    }

    try {
      const unsubUrl = `${SITE}/.netlify/functions/unsubscribe?e=${Buffer.from(contact.email).toString("base64")}&c=${campaignId}`;
      const result = await sendEmail({ to: contact.email, subject, html, text, unsubUrl });
      const ok = result.status < 300;

      const sentAt = new Date().toISOString();
      await db.update("campaign_contacts", { id: contact.id }, {
        status:   ok ? "sent" : "bounced",
        sent_at:  ok ? sentAt : null,
        resend_id: ok ? (result.data?.id || null) : null,
        metadata: { ...contact.metadata, error: ok ? undefined : JSON.stringify(result.data).slice(0, 200) },
      }).catch(e => console.warn("[update contact]", e.message));

      db.insert("email_delivery_events", {
        recipient_email: contact.email,
        sender_email:    process.env.SENDER_EMAIL || "reports@thepropertydna.com",
        subject,
        status:          ok ? "sent" : "failed",
        provider:        "resend",
        error_message:   ok ? null : JSON.stringify(result.data || {}).slice(0, 300),
        metadata:        { source: "propertydna_outreach", campaign_id: campaignId, resend_id: result.data?.id || null },
      }).catch(() => {});

      if (ok) { sent++; } else { failed++; }
    } catch (err) {
      console.error("[send-outreach-batch] send error:", err.message);
      await db.update("campaign_contacts", { id: contact.id }, {
        status: "bounced",
        metadata: { ...contact.metadata, error: err.message.slice(0, 200) },
      }).catch(() => {});
      failed++;
    }

    // 200ms pause between sends — avoids rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  // ── Update campaign stats ─────────────────────────────────────
  if (!dryRun) {
    try {
      const fresh = await db.from("campaigns").select("sent_count,bounced_count").eq("id", campaignId).get();
      const prev  = fresh?.[0] || {};
      await db.update("campaigns", { id: campaignId }, {
        sent_count:    (prev.sent_count    || 0) + sent,
        bounced_count: (prev.bounced_count || 0) + failed,
        status: remaining === 0 && failed === 0 ? "complete" : "sending",
        ...(remaining === 0 ? { completed_at: new Date().toISOString() } : {}),
      });
    } catch (e) {
      console.warn("[send-outreach-batch] stats update:", e.message);
    }
  }

  db.kpi("outreach_batch_sent", null, { campaign_id: campaignId, sent, failed, dry_run: dryRun });

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ sent, failed, remaining, dryRun, ...(dryRunSample ? { dryRunSample } : {}) }),
  };
};
