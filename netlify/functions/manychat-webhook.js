/**
 * manychat-webhook — Single endpoint for ManyChat IG/FB qualifier flows
 *
 * ManyChat (External Request action) calls this at the end of the multi-step
 * qualifier with the captured fields. We:
 *   1. Log the lead into Supabase (campaign_contacts) with source tagging
 *   2. Fire a Resend confirmation email via send-lead-email (per-role template)
 *   3. Optionally queue a real PropertyDNA report if address provided
 *   4. Return a personalized /report-pending bypass URL for ManyChat to DM back
 *
 * Auth: header `x-manychat-token` must equal env MANYCHAT_WEBHOOK_TOKEN.
 *
 * POST body (from ManyChat External Request):
 *   role        text   buyer | seller | agent | investor
 *   firstName   text
 *   lastName    text   (optional)
 *   email       text
 *   phone       text   (optional)
 *   address     text   (optional — only for sellers / address lookups)
 *   city        text   (optional)
 *   state       text   (optional, default "CA")
 *   zip         text   (optional)
 *   platform    text   ig | fb (optional, defaults "ig")
 *   igHandle    text   (optional, ManyChat user info)
 *   subscriberId text  (optional, ManyChat subscriber ID)
 *
 * Response (ManyChat v2 dynamic-block format):
 *   {
 *     version: "v2",
 *     content: { messages: [...], actions: [...set_field_value report_url...] }
 *   }
 */
const https = require("https");
const db    = require("./_supabase");

const SITE  = "https://thepropertydna.com";
const CORS  = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-manychat-token",
};

// ── Helpers ────────────────────────────────────────────────────────────

function normPhone(raw) {
  if (!raw) return "";
  const d = String(raw).replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  return String(raw).trim();
}

function normName(raw) {
  if (!raw) return "";
  return String(raw).trim().split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function normEmail(raw) {
  return (String(raw || "")).trim().toLowerCase();
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function roleToFunnel(role) {
  const r = String(role || "").toLowerCase();
  if (r.includes("sell") || r.includes("owner")) return "seller";
  if (r.includes("agent") || r.includes("broker")) return "contact";
  if (r.includes("invest")) return "off_market";
  return "buyer";
}

// Fire-and-forget POST to internal Netlify function (same site)
function postInternal(path, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const host = process.env.URL || process.env.DEPLOY_URL || "https://thepropertydna.com";
    const u = new URL(host + path);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
        "x-internal-key": process.env.INTERNAL_API_KEY || "",
      },
    }, (res) => {
      let r = ""; res.on("data", c => r += c);
      res.on("end", () => resolve({ status: res.statusCode, body: r }));
    });
    req.on("error", (e) => resolve({ status: 0, error: e.message }));
    req.write(data);
    req.end();
  });
}

// Build the personalized /report-pending bypass URL
function buildReportUrl(c) {
  const params = new URLSearchParams();
  params.set("bypass", "1");
  if (c.fullName) params.set("fullName", c.fullName);
  if (c.email)    params.set("email",    c.email);
  if (c.phone)    params.set("phone",    c.phone);
  if (c.role)     params.set("role",     c.role);
  if (c.address)  params.set("address",  c.address);
  if (c.city)     params.set("city",     c.city);
  if (c.state)    params.set("state",    c.state);
  if (c.zip)      params.set("zip",      c.zip);
  params.set("utm_source",  "manychat");
  params.set("utm_medium",  c.platform === "fb" ? "fb_dm" : "ig_dm");
  params.set("utm_campaign", "dm_qualifier");
  return `${SITE}/report-pending?${params.toString()}`;
}

// Per-role DM message
function dmMessage(role, firstName, reportUrl, hasAddress) {
  const first = firstName || "there";
  const r = String(role || "").toLowerCase();

  if (r.includes("sell") || r.includes("owner")) {
    return hasAddress
      ? `Got it, ${first}. I'm pulling your full PropertyDNA report — valuation, comps, flood zone, and a direct verdict. It'll land in your inbox in under 3 minutes. Tap below to watch it generate live.`
      : `Got it, ${first}. Tap below to drop your address — I'll pull your full PropertyDNA seller report (valuation, comps, market velocity) for free.`;
  }
  if (r.includes("agent") || r.includes("broker")) {
    return `Welcome, ${first}. PropertyDNA gives you instant institutional-grade reports for any address — perfect for buyer presentations and listing prep. Tap below to run your first report free.`;
  }
  if (r.includes("invest")) {
    return `${first}, you're on the off-market list. I'll DM you first when something fits your criteria. In the meantime, tap below to run a free DNA report on any address you're tracking.`;
  }
  return `Awesome, ${first}. Tap below to run your free PropertyDNA report — full valuation, flood zone, crime, and a direct buy/skip verdict in under 3 minutes.`;
}

// ── Handler ────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST")   return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  // Auth: ManyChat must include x-manychat-token header
  const expected = process.env.MANYCHAT_WEBHOOK_TOKEN;
  const got      = event.headers["x-manychat-token"] || event.headers["X-Manychat-Token"];
  if (expected && got !== expected) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const role         = String(body.role || "buyer").trim();
  const firstName    = normName(body.firstName || body.first_name || "");
  const lastName     = normName(body.lastName  || body.last_name  || "");
  const email        = normEmail(body.email);
  const phone        = normPhone(body.phone);
  const address      = (body.address || "").trim();
  const city         = normName(body.city || "");
  const state        = (body.state || "CA").trim().toUpperCase().slice(0,2);
  const zip          = (body.zip || "").trim().slice(0,5);
  const platform     = (body.platform || "ig").toLowerCase();
  const igHandle     = (body.igHandle || body.ig_handle || "").trim();
  const subscriberId = (body.subscriberId || body.subscriber_id || "").toString();

  if (!isValidEmail(email)) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        version: "v2",
        content: {
          messages: [{
            type: "text",
            text: "Hmm — that email doesn't look right. Reply with a valid email and I'll send your free PropertyDNA report.",
          }],
        },
      }),
    };
  }

  const fullName  = `${firstName} ${lastName}`.trim() || firstName;
  const funnel    = roleToFunnel(role);
  const source    = platform === "fb" ? "manychat_fb" : "manychat_ig";
  const executionId = `mc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // ── 1. Persist contact (fire-and-forget; never block the DM) ─────────
  db.upsert("campaign_contacts", {
    first_name: firstName,
    last_name:  lastName,
    email,
    phone,
    address,
    city,
    state,
    zip,
    status:     "pending",
    metadata: {
      source,
      role,
      platform,
      ig_handle:     igHandle,
      subscriber_id: subscriberId,
      execution_id:  executionId,
      captured_at:   new Date().toISOString(),
    },
  }, "email").catch(e => console.warn("[manychat] contact upsert:", e.message));

  db.kpi("manychat_lead", email, { source, role, platform, has_address: !!address });

  // ── 2. Fire confirmation email (fire-and-forget) ─────────────────────
  postInternal("/.netlify/functions/send-lead-email", {
    funnelType:      funnel,
    recipientEmail:  email,
    recipientName:   fullName,
    propertyAddress: address,
    executionId,
    phone,
    message:         `Captured via ManyChat ${platform.toUpperCase()} (${role})${igHandle ? " @" + igHandle : ""}`,
  }).catch(e => console.warn("[manychat] send-lead-email:", e.message));

  // ── 3. If address provided, kick off a real DNA report ───────────────
  if (address && city) {
    postInternal("/.netlify/functions/queue-report", {
      fullName,
      email,
      phone,
      role:    funnel === "seller" ? "Seller" : "Buyer",
      address,
      city,
      state,
      zip,
      notes:   `ManyChat ${platform.toUpperCase()} qualifier`,
      stripeSessionId: "manychat",
    }).catch(e => console.warn("[manychat] queue-report:", e.message));
  }

  // ── 4. Build personalized link + return ManyChat v2 response ─────────
  const reportUrl = buildReportUrl({
    fullName, email, phone, role: funnel === "seller" ? "Seller" : "Buyer",
    address, city, state, zip, platform,
  });

  const text = dmMessage(role, firstName, reportUrl, !!address);
  const buttonText = address ? "Open my report" : "Run my free report";

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      version: "v2",
      content: {
        messages: [{
          type: "text",
          text,
          buttons: [{ type: "url", caption: buttonText, url: reportUrl }],
        }],
        actions: [
          { action: "set_field_value", field_name: "report_url",   value: reportUrl },
          { action: "set_field_value", field_name: "lead_funnel",  value: funnel    },
          { action: "set_field_value", field_name: "execution_id", value: executionId },
        ],
      },
    }),
  };
};
