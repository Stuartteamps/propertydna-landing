/**
 * send-sms — Quo (OpenPhone) SMS sender
 *
 * Sends an SMS via OpenPhone API from the team line (+12132054933).
 * Used by capture-open-house-lead + open-house-followup cron.
 *
 * POST body:
 *   to       text   E.164 phone number e.g. "+17605551234" (or 10-digit, will be coerced)
 *   text     text   The message body (≤1600 chars; longer is split by carrier)
 *   leadId   text   optional — open_house_leads.id for delivery tracking
 *
 * Auth: x-internal-key header must match INTERNAL_API_KEY.
 *
 * Env required:
 *   QUO_API_KEY              OpenPhone API key
 *   QUO_PHONE_NUMBER_ID      e.g. "PN4z0mXRyD" (sender phone-number record)
 *   QUO_FROM_NUMBER          e.g. "+12132054933"
 *   INTERNAL_API_KEY         shared secret for internal-only callers
 */
const https = require("https");
const db    = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

const QUO_HOST = "api.openphone.com";

function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d]/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits[0] === "1") return "+" + digits;
  if (raw.startsWith("+")) return raw;
  return null;
}

function quoSend({ from, to, text, phoneNumberId }) {
  const key = process.env.QUO_API_KEY;
  if (!key) return Promise.resolve({ status: 503, data: { error: "QUO_API_KEY missing" } });

  // OpenPhone messages API
  const payload = JSON.stringify({
    from,
    to: [to],
    content: text,
    phoneNumberId,
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: QUO_HOST,
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Authorization": key,
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
    req.on("error", (err) => resolve({ status: 0, data: { error: err.message } }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ status: 0, data: { error: "timeout" } }); });
    req.write(payload);
    req.end();
  });
}

// Exported helper so other Netlify functions can send SMS directly.
// Honors SMS_ENABLED env flag — when false (default until Quo A2P 10DLC
// approval lands), returns { sent: false, skipped: "sms_disabled" } without
// hitting the Quo API. This lets the rest of the system code-path assume
// SMS exists; flip the flag to turn it on without redeploying functions.
async function sendSMS({ to, text, leadId }) {
  const normalized = normalizePhone(to);
  if (!normalized) return { sent: false, error: "invalid_phone" };

  if (process.env.SMS_ENABLED !== "true") {
    return { sent: false, skipped: "sms_disabled", to: normalized };
  }

  const phoneNumberId = process.env.QUO_PHONE_NUMBER_ID || "PN4z0mXRyD";
  const from          = process.env.QUO_FROM_NUMBER     || "+12132054933";

  const result = await quoSend({ from, to: normalized, text, phoneNumberId });
  const ok = result.status >= 200 && result.status < 300;

  // Log to email_delivery_events (channel=sms) for unified tracking.
  db.insert("email_delivery_events", {
    recipient_email: normalized,                          // phone goes in recipient column
    sender_email:    from,
    subject:         text.slice(0, 80),
    status:          ok ? "sent" : "failed",
    provider:        "quo_openphone",
    error_code:      ok ? null : String(result.status),
    error_message:   ok ? null : JSON.stringify(result.data || {}).slice(0, 300),
    metadata:        { channel: "sms", lead_id: leadId || null, message_id: result.data?.data?.id || null },
  }).catch((e) => console.warn("[sms-log]", e.message));

  if (!ok) {
    console.error("[send-sms]", result.status, result.data);
    return { sent: false, error: result.data, status: result.status };
  }
  return { sent: true, id: result.data?.data?.id, to: normalized };
}

// ── HTTP handler ───────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const internalKey = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (!process.env.INTERNAL_API_KEY || internalKey !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }
  const { to, text, leadId } = body;
  if (!to || !text) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "to and text required" }) };
  }

  const r = await sendSMS({ to, text, leadId });
  return {
    statusCode: r.sent ? 200 : 502,
    headers: CORS,
    body: JSON.stringify(r),
  };
};

module.exports.sendSMS = sendSMS;
module.exports.normalizePhone = normalizePhone;
