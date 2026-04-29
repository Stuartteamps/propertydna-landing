/**
 * send-lead-email — Domain-aligned lead confirmation emails
 *
 * Replaces Gmail: Lead Confirmation nodes in all 6 Stuart Team workflows.
 * Sends from reports@thepropertydna.com via Resend with DKIM signing.
 * Logs every send to email_delivery_events with execution ID for tracking.
 *
 * POST body (from n8n):
 *   funnelType      text  — buyer | seller | off_market | open_house | newsletter | contact
 *   recipientEmail  text
 *   recipientName   text
 *   propertyAddress text  — for seller/open_house funnels
 *   executionId     text  — n8n $execution.id (unique per submission)
 *   phone           text  — optional
 *   message         text  — optional, from contact form
 */
const https = require("https");
const db    = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

// ── Email templates per funnel ──────────────────────────────────────────────

function buildTemplate(funnel, { name, address, executionId, message }) {
  const first  = (name || "").split(" ")[0] || "there";
  const ref    = executionId ? executionId.slice(-8).toUpperCase() : "—";
  const site   = "https://thepropertydna.com";
  const year   = new Date().getFullYear();

  const footer = `
<tr><td style="padding:24px 40px;border-top:1px solid #e5e0d8;background:#faf8f5;">
  <p style="margin:0 0 4px;font-size:14px;color:#1a1a1a;font-family:Georgia,serif;">Daniel Stuart</p>
  <p style="margin:0 0 2px;font-size:12px;color:#777;">Stuart Team — Real Estate</p>
  <p style="margin:0 0 2px;font-size:12px;color:#777;">daniel@thepropertydna.com &nbsp;·&nbsp; thepropertydna.com</p>
  <p style="margin:8px 0 0;font-size:10px;color:#bbb;letter-spacing:1px;">Ref: ${ref}</p>
</td></tr>
<tr><td style="padding:16px 40px;border-top:1px solid #e5e0d8;">
  <p style="margin:0;font-size:11px;color:#bbb;line-height:1.6;">
    © ${year} Stuart Team Real Estate · PropertyDNA. Not a licensed appraisal.
    If you did not submit this form, please ignore this message.
  </p>
</td></tr>`;

  const wrap = (subject, preheader, bodyRows) => ({
    subject,
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f9f7f4;font-family:Georgia,'Times New Roman',serif;">
<span style="display:none;max-height:0;overflow:hidden;">${preheader}&nbsp;&zwnj;</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f4;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0"
  style="max-width:600px;width:100%;background:#fff;border:1px solid #e5e0d8;">
<tr><td style="padding:32px 40px 24px;border-bottom:1px solid #e5e0d8;">
  <p style="margin:0;font-family:Georgia,serif;font-size:11px;color:#999;letter-spacing:3px;text-transform:uppercase;">Stuart Team · Property DNA</p>
</td></tr>
${bodyRows}
${footer}
</table></td></tr></table></body></html>`,
    text: `${subject}\n\nHi ${first},\n\n${preheader}\n\nRef: ${ref}\n\n---\nDaniel Stuart\nStuart Team Real Estate\ndaniel@thepropertydna.com\n${site}\n\n© ${year} Stuart Team Real Estate`,
  });

  const row = (html) => `<tr><td style="padding:28px 40px 0;">${html}</td></tr>`;

  switch (funnel) {
    case "buyer":
      return wrap(
        "Your buyer access is confirmed — Stuart Team",
        `Hi ${first}, you're set up. Curated homes coming your way shortly.`,
        row(`<p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.75;">Hi ${first},</p>
<p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.75;">You're confirmed. I'll be sending you curated home listings that match your criteria — off-market when available, MLS when relevant.</p>
<p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.75;">While you wait, run a free Property DNA report on any address you're curious about — full valuation, flood zone, crime, and a direct verdict on whether we'd buy it.</p>
<table cellpadding="0" cellspacing="0"><tr><td style="background:#1a1a1a;">
  <a href="${site}" style="display:inline-block;padding:14px 28px;color:#c9a84c;font-family:Georgia,serif;font-size:13px;text-decoration:none;letter-spacing:1px;">Run a Free Property DNA Report &rarr;</a>
</td></tr></table>`));


    case "seller":
      return wrap(
        `Valuation request received — ${address || "your property"}`,
        `Hi ${first}, I've received your request and will follow up shortly.`,
        row(`<p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.75;">Hi ${first},</p>
<p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.75;">I've received your valuation request for <strong>${address || "your property"}</strong> and will follow up with a full market analysis shortly.</p>
<p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.75;">In the meantime, you can run a Property DNA report on your address for an instant data-driven view of comparable sales, flood zone, and current value range.</p>
<table cellpadding="0" cellspacing="0"><tr><td style="background:#1a1a1a;">
  <a href="${site}" style="display:inline-block;padding:14px 28px;color:#c9a84c;font-family:Georgia,serif;font-size:13px;text-decoration:none;letter-spacing:1px;">Get a Property DNA Report &rarr;</a>
</td></tr></table>`));


    case "off_market":
      return wrap(
        "You're on the off-market list — Stuart Team",
        `Hi ${first}, you'll hear from me first when something matches.`,
        row(`<p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.75;">Hi ${first},</p>
<p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.75;">You're on the list. When an off-market property becomes available that matches your criteria, you'll hear from me before it goes anywhere else.</p>
<p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.75;">Off-market moves fast. If you see an address you're interested in, run a Property DNA report on it — full intelligence in under 3 minutes, so you're ready to act.</p>
<table cellpadding="0" cellspacing="0"><tr><td style="background:#1a1a1a;">
  <a href="${site}" style="display:inline-block;padding:14px 28px;color:#c9a84c;font-family:Georgia,serif;font-size:13px;text-decoration:none;letter-spacing:1px;">Run a Property DNA Report &rarr;</a>
</td></tr></table>`));


    case "open_house":
      return wrap(
        `Thanks for visiting${address ? " — " + address : ""} — Stuart Team`,
        `Hi ${first}, great meeting you. Here's what comes next.`,
        row(`<p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.75;">Hi ${first},</p>
<p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.75;">Thanks for stopping by${address ? " <strong>" + address + "</strong>" : ""}. It was great to meet you.</p>
<p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.75;">If you'd like a full Property DNA report on this home or any other you're considering — valuation, flood zone, comparable sales, and a direct verdict — it's free for your first report.</p>
<table cellpadding="0" cellspacing="0"><tr><td style="background:#1a1a1a;">
  <a href="${site}" style="display:inline-block;padding:14px 28px;color:#c9a84c;font-family:Georgia,serif;font-size:13px;text-decoration:none;letter-spacing:1px;">Get Your Free Property DNA Report &rarr;</a>
</td></tr></table>`));


    case "newsletter":
      return wrap(
        "You're subscribed — Stuart Team",
        `Hi ${first}, you're on the list. Market intel coming your way.`,
        row(`<p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.75;">Hi ${first},</p>
<p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.75;">You're subscribed. I send a weekly market update covering Coachella Valley — pricing shifts, inventory, off-market opportunities, and data-backed analysis.</p>
<p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.75;">First issue coming soon. In the meantime, run a free Property DNA report on any address you're curious about.</p>
<table cellpadding="0" cellspacing="0"><tr><td style="background:#1a1a1a;">
  <a href="${site}" style="display:inline-block;padding:14px 28px;color:#c9a84c;font-family:Georgia,serif;font-size:13px;text-decoration:none;letter-spacing:1px;">Run a Free Property DNA Report &rarr;</a>
</td></tr></table>`));


    case "contact":
    default:
      return wrap(
        "Message received — Stuart Team",
        `Hi ${first}, I've received your message and will follow up shortly.`,
        row(`<p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.75;">Hi ${first},</p>
<p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.75;">I've received your message and will follow up shortly — usually within a few hours during business hours.</p>
${message ? `<p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.75;border-left:3px solid #e5e0d8;padding-left:16px;"><em>${message.replace(/</g,"&lt;").replace(/>/g,"&gt;").slice(0,400)}</em></p>` : ""}
<p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.75;">While you wait, run a free Property DNA report on any address you're interested in.</p>
<table cellpadding="0" cellspacing="0"><tr><td style="background:#1a1a1a;">
  <a href="${site}" style="display:inline-block;padding:14px 28px;color:#c9a84c;font-family:Georgia,serif;font-size:13px;text-decoration:none;letter-spacing:1px;">Run a Free Property DNA Report &rarr;</a>
</td></tr></table>`));

  }
}

// ── Resend sender ───────────────────────────────────────────────────────────

function sendViaResend({ to, subject, html, text }) {
  const key     = process.env.RESEND_API_KEY;
  const from    = `Stuart Team <${process.env.SENDER_EMAIL || "reports@thepropertydna.com"}>`;
  const replyTo = process.env.REPLY_TO_EMAIL || "stuartteamps@gmail.com";
  if (!key) return Promise.resolve({ status: 503, data: { error: "No RESEND_API_KEY" } });

  const payload = JSON.stringify({ from, reply_to: replyTo, to, subject, html, text });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.resend.com", path: "/emails", method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    }, (res) => {
      let r = ""; res.on("data", c => r += c);
      res.on("end", () => { try { resolve({ status: res.statusCode, data: JSON.parse(r) }); } catch { resolve({ status: res.statusCode, data: { _raw: r } }); } });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ── Handler ─────────────────────────────────────────────────────────────────

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

  const {
    funnelType     = "contact",
    recipientEmail,
    recipientName  = "",
    propertyAddress = "",
    executionId    = "",
    phone          = "",
    message        = "",
  } = body;

  if (!recipientEmail) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "recipientEmail required" }) };
  }

  const template = buildTemplate(funnelType, {
    name:        recipientName,
    address:     propertyAddress,
    executionId,
    message,
  });

  const result = await sendViaResend({
    to:      recipientEmail,
    subject: template.subject,
    html:    template.html,
    text:    template.text,
  });

  const success = result.status < 300;

  // Log to email_delivery_events (fire and forget)
  db.insert("email_delivery_events", {
    recipient_email: recipientEmail,
    sender_email:    process.env.SENDER_EMAIL || "reports@thepropertydna.com",
    subject:         template.subject,
    status:          success ? "sent" : "failed",
    provider:        "resend",
    error_code:      success ? null : String(result.status),
    error_message:   success ? null : JSON.stringify(result.data || {}).slice(0, 300),
    metadata:        { funnel_type: funnelType, execution_id: executionId, phone },
  }).catch(e => console.warn("[lead-email-log]", e.message));

  if (!success) {
    console.error("[send-lead-email]", result.status, result.data);
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ sent: false, error: result.data }) };
  }

  db.kpi("lead_email_sent", recipientEmail, { funnel: funnelType, execution_id: executionId });

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ sent: true, provider: "resend", funnel: funnelType, ref: executionId.slice(-8).toUpperCase() }),
  };
};
