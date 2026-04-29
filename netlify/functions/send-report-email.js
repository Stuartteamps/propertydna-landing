/**
 * send-report-email  — Deliverability-hardened report notification
 *
 * Called by n8n HTTP node (replaces Gmail node).
 * Sends a clean plain-and-HTML email with a single secure report link.
 * Logs every attempt to email_delivery_events in Supabase.
 *
 * n8n HTTP Request node:
 *   POST https://thepropertydna.com/.netlify/functions/send-report-email
 *   Headers: x-internal-key: $env.INTERNAL_API_KEY
 *            Content-Type: application/json
 *
 * Required env vars:
 *   INTERNAL_API_KEY   — shared secret with n8n
 *   SENDER_EMAIL       — e.g. reports@thepropertydna.com
 *   REPLY_TO_EMAIL     — e.g. stuartteamps@gmail.com
 *   APP_BASE_URL       — e.g. https://thepropertydna.com
 *
 * Email provider (first found wins):
 *   RESEND_API_KEY     — https://resend.com  (recommended)
 *   SENDGRID_API_KEY   — https://sendgrid.com
 *
 * POST body (from n8n save-report response + lead data):
 *   recipientEmail    text   — lead email
 *   recipientName     text   — lead full name
 *   propertyAddress   text   — full address string
 *   summary           text   — 1-2 sentence executive summary from AI node
 *   viewToken         text   — from save-report response (preferred)
 *   reportId          text   — from save-report response (fallback link)
 *   reportUrl         text   — override full URL (optional)
 *   ownerCopy         bool   — if true, sends a BCC/second email to owner
 */
const https = require("https");
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

// ── Email template ──────────────────────────────────────────────────────────

function buildHtml({ recipientName, propertyAddress, summary, reportUrl, year }) {
  const safeAddress = (propertyAddress || "the subject property").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeName    = (recipientName  || "Valued Client").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeSummary = (summary || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const summaryBlock = safeSummary
    ? `<tr><td style="padding:0 0 24px;"><p style="margin:0;font-size:15px;color:#444;line-height:1.75;font-family:Georgia,serif;">${safeSummary}</p></td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Property DNA Report — ${safeAddress}</title>
</head>
<body style="margin:0;padding:0;background:#f9f7f4;font-family:Georgia,'Times New Roman',serif;">
  <span style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;">Confidential property analysis prepared for ${safeName}&nbsp;&zwnj;&nbsp;</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f4;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e5e0d8;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #e5e0d8;">
              <p style="margin:0;font-family:Georgia,serif;font-size:11px;color:#999;letter-spacing:3px;text-transform:uppercase;">Property DNA</p>
              <p style="margin:6px 0 0;font-family:Georgia,serif;font-size:11px;color:#bbb;letter-spacing:1px;">Intelligence Report</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 0 6px;">
                    <p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:normal;color:#1a1a1a;line-height:1.3;">${safeAddress}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 24px;">
                    <p style="margin:0;font-size:13px;color:#999;">Prepared for ${safeName}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 24px;">
                    <p style="margin:0;font-size:15px;color:#333;line-height:1.75;font-family:Georgia,serif;">Dear ${safeName},</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 24px;">
                    <p style="margin:0;font-size:15px;color:#444;line-height:1.75;font-family:Georgia,serif;">Your Property DNA intelligence report for <strong>${safeAddress}</strong> has been prepared and is ready for review.</p>
                  </td>
                </tr>
                ${summaryBlock}
                <!-- CTA -->
                <tr>
                  <td style="padding:8px 0 32px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background:#1a1a1a;">
                          <a href="${reportUrl}" style="display:inline-block;padding:14px 28px;color:#c9a84c;font-family:Georgia,serif;font-size:13px;text-decoration:none;letter-spacing:1px;">View Your Property DNA Report &rarr;</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:14px 0 0;font-size:11px;color:#aaa;word-break:break-all;">If the button does not work, copy this link into your browser: ${reportUrl}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Contact -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e5e0d8;background:#faf8f5;">
              <p style="margin:0 0 4px;font-size:14px;color:#1a1a1a;font-family:Georgia,serif;">Daniel Stuart</p>
              <p style="margin:0 0 4px;font-size:12px;color:#777;">Stuart Team &mdash; Real Estate Intelligence</p>
              <p style="margin:0 0 2px;font-size:12px;color:#777;">daniel@thepropertydna.com</p>
              <p style="margin:0;font-size:12px;color:#777;">thepropertydna.com</p>
            </td>
          </tr>
          <!-- Disclaimer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #e5e0d8;">
              <p style="margin:0;font-size:11px;color:#bbb;line-height:1.6;">This report is for informational purposes only and is not a licensed appraisal, legal advice, or an offer to buy or sell real estate. Data is sourced from third-party providers and may not reflect current market conditions. &copy; ${year} PropertyDNA. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildText({ recipientName, propertyAddress, summary, reportUrl, year }) {
  const name    = recipientName    || "Valued Client";
  const address = propertyAddress  || "the subject property";
  const lines = [
    "PROPERTY DNA — INTELLIGENCE REPORT",
    "".padEnd(50, "-"),
    "",
    address,
    `Prepared for ${name}`,
    "",
    `Dear ${name},`,
    "",
    `Your Property DNA intelligence report for ${address} has been prepared and is ready for review.`,
  ];
  if (summary) lines.push("", summary);
  lines.push(
    "",
    "View your full report:",
    reportUrl,
    "",
    "".padEnd(50, "-"),
    "Daniel Stuart",
    "Stuart Team — Real Estate Intelligence",
    "Email: daniel@thepropertydna.com",
    "Web:   https://thepropertydna.com",
    "",
    `This report is for informational purposes only and is not a licensed appraisal. © ${year} PropertyDNA.`,
  );
  return lines.join("\n");
}

// ── Email provider implementations (native https only) ─────────────────────

function httpsPost(hostname, path, headers, body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          let data;
          try { data = JSON.parse(raw); } catch { data = { _raw: raw }; }
          resolve({ status: res.statusCode, data });
        });
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function sendViaResend({ from, replyTo, to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return httpsPost(
    "api.resend.com",
    "/emails",
    { Authorization: `Bearer ${key}` },
    { from, reply_to: replyTo, to, subject, html, text },
  );
}

async function sendViaSendGrid({ from, fromName, replyTo, to, subject, html, text }) {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) return null;
  return httpsPost(
    "api.sendgrid.com",
    "/v3/mail/send",
    { Authorization: `Bearer ${key}` },
    {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from, name: fromName || "Property DNA" },
      reply_to: { email: replyTo },
      subject,
      content: [
        { type: "text/plain", value: text },
        { type: "text/html",  value: html },
      ],
    },
  );
}

// ── Delivery logger ─────────────────────────────────────────────────────────

async function logDelivery({ reportId, recipientEmail, senderEmail, subject, status, provider, errorCode, errorMessage, bounceType, metadata }) {
  db.insert("email_delivery_events", {
    report_id:       reportId   || null,
    recipient_email: recipientEmail,
    sender_email:    senderEmail,
    subject,
    status,
    provider,
    error_code:      errorCode    || null,
    error_message:   errorMessage || null,
    bounce_type:     bounceType   || null,
    metadata:        metadata     || {},
  }).catch((e) => console.warn("[email-log]", e.message));
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
    recipientEmail,
    recipientName,
    propertyAddress,
    summary,
    viewToken,
    reportId,
    reportUrl: overrideUrl,
    ownerCopy = true,
  } = body;

  if (!recipientEmail) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "recipientEmail required" }) };
  }

  const APP_BASE    = (process.env.APP_BASE_URL || "https://thepropertydna.com").replace(/\/$/, "");
  const SENDER      = process.env.SENDER_EMAIL   || "reports@thepropertydna.com";
  const REPLY_TO    = process.env.REPLY_TO_EMAIL  || "stuartteamps@gmail.com";
  const OWNER_EMAIL = process.env.OWNER_EMAIL     || "stuartteamps@gmail.com";
  const year        = new Date().getFullYear();

  // Build report URL — prefer token-based secure link
  const reportUrl = overrideUrl
    || (viewToken ? `${APP_BASE}/report/view/${viewToken}` : null)
    || (reportId  ? `${APP_BASE}/report/${reportId}`       : APP_BASE);

  const subject = `Property DNA Report – ${propertyAddress || "Your Property"}`;

  const templateData = { recipientName, propertyAddress, summary, reportUrl, year };
  const html = buildHtml(templateData);
  const text = buildText(templateData);

  const hasResend     = !!process.env.RESEND_API_KEY;
  const hasSendGrid   = !!process.env.SENDGRID_API_KEY;

  if (!hasResend && !hasSendGrid) {
    const msg = "No email provider configured. Set RESEND_API_KEY or SENDGRID_API_KEY in Netlify environment variables.";
    console.error("[send-report-email]", msg);
    await logDelivery({ reportId, recipientEmail, senderEmail: SENDER, subject, status: "failed", provider: "none", errorMessage: msg });
    return {
      statusCode: 503,
      headers: CORS,
      body: JSON.stringify({ sent: false, error: msg }),
    };
  }

  const provider = hasResend ? "resend" : "sendgrid";

  const sendFn = hasResend ? sendViaResend : sendViaSendGrid;
  const fromField = hasResend ? `Property DNA <${SENDER}>` : SENDER;

  let recipientResult = null;
  let ownerResult = null;

  try {
    // Send to recipient
    recipientResult = await sendFn({
      from:     fromField,
      fromName: "Property DNA",
      replyTo:  REPLY_TO,
      to:       recipientEmail,
      subject,
      html,
      text,
    });

    const success = recipientResult && recipientResult.status < 300;

    await logDelivery({
      reportId,
      recipientEmail,
      senderEmail: SENDER,
      subject,
      status:    success ? "sent" : "failed",
      provider,
      errorCode:    success ? null : String(recipientResult?.status || "unknown"),
      errorMessage: success ? null : JSON.stringify(recipientResult?.data || {}),
      metadata: { view_token: viewToken || null },
    });

    if (!success) {
      console.error("[send-report-email] provider error", recipientResult);
      return {
        statusCode: 502,
        headers: CORS,
        body: JSON.stringify({ sent: false, error: "Provider rejected email", detail: recipientResult?.data }),
      };
    }

    // Owner copy
    if (ownerCopy && OWNER_EMAIL && OWNER_EMAIL !== recipientEmail) {
      const ownerSubject = `[Copy] Property DNA Report – ${propertyAddress || "Your Property"} (sent to ${recipientEmail})`;
      const ownerHtml = buildHtml({ ...templateData, recipientName: `${recipientName || recipientEmail} (copy to owner)` });
      const ownerText = buildText({ ...templateData, recipientName: `${recipientName || recipientEmail} (copy to owner)` });
      ownerResult = await sendFn({
        from:     fromField,
        fromName: "Property DNA",
        replyTo:  REPLY_TO,
        to:       OWNER_EMAIL,
        subject:  ownerSubject,
        html:     ownerHtml,
        text:     ownerText,
      }).catch((e) => { console.warn("[owner copy]", e.message); return null; });
    }

    db.kpi("email_sent", recipientEmail, { provider, has_token: !!viewToken, report_id: reportId });

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        sent: true,
        provider,
        reportUrl,
        ownerCopySent: !!(ownerResult && ownerResult.status < 300),
      }),
    };
  } catch (err) {
    console.error("[send-report-email]", err.message);
    await logDelivery({
      reportId,
      recipientEmail,
      senderEmail: SENDER,
      subject,
      status: "failed",
      provider,
      errorMessage: err.message,
    });
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ sent: false, error: err.message }),
    };
  }
};
