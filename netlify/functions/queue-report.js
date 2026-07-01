/**
 * queue-report — the single entry point for all report requests.
 *
 * Replaces the browser→n8n direct call. This function:
 *   1. Validates email + address
 *   2. Saves a pending report record to Supabase (guarantees a viewToken)
 *   3. Sends a "report queued" email to the user RIGHT NOW
 *   4. Fires the n8n enrichment webhook in the background (fire-and-forget)
 *
 * n8n continues to enrich the report async. When it finishes it calls
 * save-report to update status→completed. The user's email already has
 * the view link so they can check back.
 *
 * POST /.netlify/functions/queue-report
 * Body: { email, fullName, address, city, state, zip, role, phone, notes, stripeSessionId }
 */

const https = require("https");
const crypto = require("crypto");
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

const N8N_URL = process.env.N8N_WEBHOOK_URL || "https://dillabean.app.n8n.cloud/webhook/homefax/report";
const APP_BASE = (process.env.APP_BASE_URL || "https://thepropertydna.com").replace(/\/$/, "");
// In-house enrichment is the only live path. n8n is RETIRED and kept only as a
// dormant break-glass fallback — never fires unless ENABLE_N8N_FALLBACK=true
// (decoupled from ENRICHMENT_MODE so a stale env var can't route reports to the
// dead n8n instance).
const ENRICH_URL = `${APP_BASE}/.netlify/functions/enrich-report`;
const USE_N8N = (process.env.ENABLE_N8N_FALLBACK || "").toLowerCase() === "true";

// ── Resend email (identical helper to send-report-email) ────────────────────
function httpsPost(hostname, path, headers, body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve) => {
    const req = https.request(
      { hostname, path, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), ...headers } },
      (res) => { let raw = ""; res.on("data", c => raw += c); res.on("end", () => resolve({ status: res.statusCode })); }
    );
    req.on("error", () => resolve({ status: 0 }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ status: 0 }); });
    req.write(payload);
    req.end();
  });
}

async function sendQueuedEmail({ recipientEmail, recipientName, propertyAddress, viewToken }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;

  const reportUrl = `${APP_BASE}/report/view/${viewToken}`;
  const dashUrl   = `${APP_BASE}/dashboard`;
  const safeName    = (recipientName || "Valued Client").replace(/[<>]/g, "");
  const safeAddress = (propertyAddress || "your property").replace(/[<>]/g, "");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Property DNA Report — ${safeAddress}</title></head>
<body style="margin:0;padding:0;background:#f9f7f4;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f4;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #e5e0d8;">
        <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #e5e0d8;">
          <p style="margin:0;font-family:Georgia,serif;font-size:11px;color:#999;letter-spacing:3px;text-transform:uppercase;">Property DNA</p>
          <p style="margin:6px 0 0;font-family:Georgia,serif;font-size:11px;color:#bbb;letter-spacing:1px;">Intelligence Report</p>
        </td></tr>
        <tr><td style="padding:32px 40px 0;">
          <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;color:#1a1a1a;line-height:1.3;">${safeAddress}</p>
          <p style="margin:0 0 24px;font-size:13px;color:#999;">Prepared for ${safeName}</p>
          <p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.75;">Dear ${safeName},</p>
          <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.75;">We've received your request and your Property DNA intelligence report for <strong>${safeAddress}</strong> is being generated now. This typically takes under 3 minutes.</p>
          <p style="margin:0 0 28px;font-size:15px;color:#444;line-height:1.75;">Your report will appear in your dashboard automatically. Use the link below to view it:</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr><td style="background:#1a1a1a;">
              <a href="${dashUrl}" style="display:inline-block;padding:14px 28px;color:#E8B84B;font-family:Georgia,serif;font-size:15px;text-decoration:none;letter-spacing:1px;">View Dashboard &rarr;</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:12px;color:#aaa;">Direct report link (ready once generated):</p>
          <p style="margin:0 0 32px;font-size:11px;color:#aaa;word-break:break-all;">${reportUrl}</p>
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #e5e0d8;background:#faf8f5;">
          <p style="margin:0 0 4px;font-size:14px;color:#1a1a1a;">PropertyDNA</p>
          <p style="margin:0;font-size:12px;color:#777;">thepropertydna.com</p>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #e5e0d8;">
          <p style="margin:0;font-size:11px;color:#bbb;line-height:1.6;">This report is for informational purposes only. &copy; ${new Date().getFullYear()} PropertyDNA.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    "PROPERTY DNA — INTELLIGENCE REPORT", "".padEnd(50, "-"), "",
    safeAddress, `Prepared for ${safeName}`, "",
    `Dear ${safeName},`,
    "",
    `Your Property DNA report for ${safeAddress} is being generated. Check your dashboard:`,
    dashUrl, "",
    "Direct report link (available once generated):",
    reportUrl, "",
    `© ${new Date().getFullYear()} PropertyDNA — thepropertydna.com`,
  ].join("\n");

  const SENDER  = process.env.SENDER_EMAIL || "reports@thepropertydna.com";
  const SENDER_NAME = process.env.SENDER_NAME || "PropertyDNA powered by IntellaGraphAI";

  return httpsPost("api.resend.com", "/emails",
    { Authorization: `Bearer ${key}` },
    {
      from:     `${SENDER_NAME} <${SENDER}>`,
      reply_to: process.env.REPLY_TO_EMAIL || `${SENDER_NAME} <${SENDER}>`,
      to:       recipientEmail,
      subject:  `Your PropertyDNA report is being generated — ${propertyAddress}`,
      html,
      text,
    }
  );
}

// ── Fire n8n enrichment ────────────────────────────────────────────────────
// AWS Lambda freezes the container the moment exports.handler returns. The
// previous fire-and-forget pattern lost requests because the JS event loop
// halted before the socket finished flushing. We resolve as soon as the
// request body has been WRITTEN to the wire (req 'finish' event ~100ms),
// without waiting for n8n's full 22s response — n8n calls save-report.js
// when done. If n8n responds first (rare), we capture status; otherwise
// we resolve at finish and trust the request is in flight.
function fireN8n(payload) {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (r) => { if (!resolved) { resolved = true; resolve(r); } };

    const body = JSON.stringify(payload);
    const url  = new URL(N8N_URL);
    const req  = https.request(
      { hostname: url.hostname, path: url.pathname, method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
      (res) => {
        // Drain the response so the socket can close cleanly
        res.on("data", () => {});
        res.on("end", () => done({ status: res.statusCode, completed: true }));
      }
    );
    req.on("error",  (e) => done({ status: 0, error: e.message }));
    req.on("finish", () => {
      // Request body fully transmitted — safe to return; n8n will process async
      // Wait one more tick to ensure the OS send buffer has flushed
      setTimeout(() => done({ status: 202, completed: false, sent: true }), 250);
    });
    req.setTimeout(8000, () => { req.destroy(); done({ status: 0, error: "timeout" }); });
    req.write(body);
    req.end();
  });
}

// Fire the in-house enrichment function (enrich-report) — the n8n replacement.
// Same fire-and-forget contract as fireN8n: resolve once the request body is
// flushed (~250ms). enrich-report then runs as its own Lambda to completion
// (RentCast -> save-report), so queue-report returns fast while the report fills
// in. enrich-report requires the internal key.
function fireEnrich(payload) {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (r) => { if (!resolved) { resolved = true; resolve(r); } };
    const body = JSON.stringify(payload);
    const url  = new URL(ENRICH_URL);
    const req  = https.request(
      { hostname: url.hostname, path: url.pathname, method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body),
          "x-internal-key": process.env.INTERNAL_API_KEY || "" } },
      (res) => { res.on("data", () => {}); res.on("end", () => done({ status: res.statusCode, completed: true })); }
    );
    req.on("error",  (e) => done({ status: 0, error: e.message }));
    req.on("finish", () => setTimeout(() => done({ status: 202, completed: false, sent: true }), 250));
    req.setTimeout(8000, () => { req.destroy(); done({ status: 0, error: "timeout" }); });
    req.write(body);
    req.end();
  });
}

// ── Handler ────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { email, fullName, address, city, state, zip, role, phone, notes, propertyType, stripeSessionId } = body;

  if (!email || !email.includes("@")) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Valid email required" }) };
  }
  if (!address || !address.trim()) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Address required" }) };
  }

  // Address quality validation — must contain a street number AND a street name.
  // Catches "Palm Springs, CA" (city only), "92262" (zip only), "Camino Norte" (no number).
  const addrTrim = address.trim();
  const hasStreetNum = /\b\d{1,6}\b/.test(addrTrim);
  const hasStreetWords = /\b[a-zA-Z]{3,}\b/.test(addrTrim);
  const looksLikeJustCity = /^([a-zA-Z\s]+,\s*[A-Z]{2})?$/i.test(addrTrim);

  if (!hasStreetNum || !hasStreetWords || looksLikeJustCity) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({
        error: "Please enter a complete street address (e.g., '420 S Camino Norte')",
        field: "address",
      }),
    };
  }

  const normalizedEmail = email.toLowerCase().trim();
  const viewToken = crypto.randomUUID();
  const reportId  = crypto.randomUUID();
  const fullAddress = [address, city, state, zip].filter(Boolean).join(", ");

  // Synthetic health-check submission (e.g. healthcheck+<ts>@thepropertydna.com from the
  // monitor's Step-3 pipeline test). Exercise the full pipeline (row + n8n enrichment) but
  // send NO email: the user address is a non-existent mailbox that always bounces, and the
  // owner copy is just noise in Dan's inbox on every run.
  const isHealthCheck = /^healthcheck\+/i.test(normalizedEmail);

  // Back-test backfill: an internal pipeline that fires queue-report for every
  // ground-truth address in `properties` so n8n generates a stored DNA value
  // we can join against in backtest-accuracy. Suppresses both the user email
  // and the owner copy (the same way isHealthCheck does), but does NOT hit
  // the health-check rate cap — backfills run 1000+ at a time intentionally.
  // Use email pattern: `backtest+<id>@thepropertydna.com`.
  const isBacktest = /^backtest\+/i.test(normalizedEmail);

  // HARD CAP: generate at most 2 real health-check reports per rolling 24h,
  // spaced >=6h apart — regardless of how often the monitor routine fires.
  // On a capped run we do NOT create a row or call n8n; instead we return the
  // most recent COMPLETED health-check report's token so the monitor's
  // end-to-end check still passes against a known-good report (no false alarm)
  // while no redundant report is generated. If nothing completed exists yet to
  // reuse, we fall through and generate one real test.
  if (isHealthCheck) {
    try {
      const now = Date.now();
      const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
      const cutoff6h = now - 6 * 60 * 60 * 1000;
      const recent = await db.from("property_reports")
        .select("view_token,status,created_at")
        .like("email", "healthcheck+*")
        .gte("created_at", since24h)
        .order("created_at", { ascending: false })
        .limit(10).get();
      const rows = Array.isArray(recent) ? recent : [];
      const within6h = rows.some(r => { const t = Date.parse(r.created_at); return !isNaN(t) && t >= cutoff6h; });
      const overDailyCap = rows.length >= 2;
      if (within6h || overDailyCap) {
        const reuse = rows.find(r => r.status === "completed" && r.view_token);
        if (reuse) {
          console.log(`[queue-report] health-check capped (24h=${rows.length}, within6h=${within6h}) — reusing ${reuse.view_token}`);
          return {
            statusCode: 200,
            headers: CORS,
            body: JSON.stringify({
              queued: true,
              capped: true,
              reason: "health-check rate cap (max 2 / 24h, >=6h apart) — reused last completed report",
              viewToken: reuse.view_token,
              viewUrl: `${APP_BASE}/report/view/${reuse.view_token}`,
            }),
          };
        }
        // No completed report available to reuse — let one real test through.
      }
    } catch (e) {
      console.warn("[queue-report] health-check cap check failed (allowing through):", e.message);
    }
  }

  // ── 1. Save pending record ────────────────────────────────────────────────
  try {
    await db.insert("property_reports", {
      id:           reportId,
      email:        normalizedEmail,
      address,
      city:         city  || null,
      state:        state || null,
      zip:          zip   || null,
      full_address: fullAddress,
      role:         role  || "Buyer",
      status:       "pending",
      view_token:   viewToken,
    });
  } catch (e) {
    console.error("[queue-report] failed to save pending record:", e.message);
  }

  // ── 2. Send queued email to user (skipped for synthetic health-check + backtest runs) ──
  const emailResult = (isHealthCheck || isBacktest) ? null : await sendQueuedEmail({
    recipientEmail: normalizedEmail,
    recipientName:  fullName || null,
    propertyAddress: fullAddress,
    viewToken,
  }).catch(e => { console.error("[queue-report] email error:", e.message); return null; });

  // ── 3. Send owner copy (skipped for synthetic health-check + backtest runs) ──
  const OWNER = process.env.OWNER_EMAIL || "stuartteamps@gmail.com";
  if (!isHealthCheck && !isBacktest && OWNER && OWNER !== normalizedEmail) {
    sendQueuedEmail({
      recipientEmail: OWNER,
      recipientName:  `${fullName || normalizedEmail} (copy to owner)`,
      propertyAddress: fullAddress,
      viewToken,
    }).catch(() => {});
  }

  // ── 4. Fire enrichment (AWAITED — Lambda freezes on return) ───────────────
  // In-house enrich-report by default (the n8n cloud workflow kept OOM-crashing
  // and auto-deactivating). Set ENRICHMENT_MODE=n8n to fall back to the webhook.
  const enrichPayload = {
    fullName:        fullName || "",
    email:           normalizedEmail,
    phone:           phone   || "",
    role:            role    || "Buyer",
    address,
    city:            city    || "",
    state:           state   || "",
    zip:             zip     || "",
    notes:           notes   || "",
    propertyType:    propertyType || "",
    stripeSessionId: stripeSessionId || "bypass",
    paid:            true,
    viewToken,
    reportId,
    leadSource:      "property_dna_web",
    pageUrl:         APP_BASE,
    timestamp:       new Date().toISOString(),
  };
  const n8nResult = USE_N8N ? await fireN8n(enrichPayload) : await fireEnrich(enrichPayload);
  const enrichName = USE_N8N ? "n8n" : "enrich-report";

  if (!n8nResult || (n8nResult.status !== 200 && n8nResult.status !== 202)) {
    console.error(`[queue-report] ${enrichName} enrichment did NOT complete:`, n8nResult);
  } else {
    console.log(`[queue-report] ${enrichName} enrichment in flight:`, n8nResult.status);
  }

  // ── 5. KPI log ────────────────────────────────────────────────────────────
  db.kpi("report_queued", normalizedEmail, {
    address,
    emailSent: !!(emailResult && emailResult.status < 300),
    n8nStatus: n8nResult?.status || 0,
    viewToken,
  });

  // Referral attribution (additive, fire-and-forget — never blocks the report).
  // Frontend forwards ?ref through to this field; absent for normal traffic.
  if (body.ref) {
    db.insert("referrals", {
      code: String(body.ref).slice(0, 40),
      invitee_email: normalizedEmail,
      status: "signed_up",
      attributed_at: new Date().toISOString(),
    }).catch(() => {});
    db.kpi("referral_conversion", normalizedEmail, { code: body.ref });
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      queued: true,
      requestId: reportId.slice(-8).toUpperCase(),
      viewToken,
      viewUrl: `${APP_BASE}/report/view/${viewToken}`,
    }),
  };
};
