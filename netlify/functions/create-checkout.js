const https = require("https");
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

function stripePost(path, data, key) {
  const body = new URLSearchParams(data).toString();
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.stripe.com",
        path,
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error("Bad JSON")); } });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function stripeGet(path, key) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: "api.stripe.com", path, method: "GET", headers: { Authorization: `Bearer ${key}` } },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error("Bad JSON")); } });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function getOrCreateStripeCustomer(email, fullName, SK) {
  // Search for existing customer
  const existing = await stripeGet(
    `/v1/customers?email=${encodeURIComponent(email)}&limit=1`,
    SK
  );
  if (existing.data && existing.data.length > 0) return existing.data[0];

  // Create new customer
  return stripePost("/v1/customers", { email, name: fullName || "" }, SK);
}

// mode: 'free' | 'per_report' | 'subscription' | 'enterprise'
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { fullName, email, phone, role, address, unit, city, state, zip, notes, mode = "free",
    propertyType, idxUrl, mlsNumber, listingSource, listingAgent, listingBrokerage } = body;

  if (!email || !address) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Email and address are required." }) };

  const normalizedEmail = email.toLowerCase().trim();
  const origin = event.headers.origin || "https://thepropertydna.com";

  const meta = {
    "metadata[fullName]": fullName || "",
    "metadata[email]": normalizedEmail,
    "metadata[phone]": phone || "",
    "metadata[role]": role || "Buyer",
    "metadata[address]": address,
    "metadata[unit]": unit || "",
    "metadata[city]": city || "",
    "metadata[state]": state || "",
    "metadata[zip]": zip || "",
    "metadata[propertyType]": propertyType || "",
    "metadata[notes]": notes || "",
    "metadata[mode]": mode,
    "metadata[idxUrl]": (idxUrl || "").slice(0, 500),
    "metadata[mlsNumber]": (mlsNumber || "").slice(0, 100),
    "metadata[listingSource]": (listingSource || "").slice(0, 100),
    "metadata[listingAgent]": (listingAgent || "").slice(0, 100),
    "metadata[listingBrokerage]": (listingBrokerage || "").slice(0, 100),
  };

  // ── FREE path ────────────────────────────────────────────────
  if (mode === "free") {
    // Save report_searches record
    db.insert("report_searches", { email: normalizedEmail, address, city: city || null, state: state || null, zip: zip || null }).catch(() => {});
    db.kpi("free_report", normalizedEmail, { address, mode: "free" });

    const params = new URLSearchParams({
      bypass: "1", mode: "free",
      fullName: fullName || "", email: normalizedEmail,
      phone: phone || "", role: role || "Buyer",
      address, unit: unit || "", city: city || "", state: state || "", zip: zip || "",
      propertyType: propertyType || "", notes: notes || "",
    });
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ url: `${origin}/report-pending?${params.toString()}` }) };
  }

  // ── Stripe path ───────────────────────────────────────────────
  if (!process.env.STRIPE_SECRET_KEY) {
    // No Stripe configured — fall back to free
    db.kpi("free_report", normalizedEmail, { address, mode, note: "no_stripe_key" });
    const params = new URLSearchParams({
      bypass: "1", mode,
      fullName: fullName || "", email: normalizedEmail,
      phone: phone || "", role: role || "Buyer",
      address, city: city || "", state: state || "", zip: zip || "", notes: notes || "",
    });
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ url: `${origin}/report-pending?${params.toString()}` }) };
  }

  const SK = process.env.STRIPE_SECRET_KEY;

  try {
    // Get or create Stripe customer for better tracking
    const customer = await getOrCreateStripeCustomer(normalizedEmail, fullName, SK).catch(() => null);
    const customerId = customer?.id;

    // Update profile with Stripe customer ID
    if (customerId) {
      db.upsert("profiles", {
        email: normalizedEmail,
        full_name: fullName || null,
        phone: phone || null,
        stripe_customer_id: customerId,
      }, "email").catch(() => {});
    }

    let priceId;
    let sessionMode = "payment";
    let successPath = "/report-pending?session_id={CHECKOUT_SESSION_ID}";

    if (mode === "per_report") {
      priceId = process.env.STRIPE_PRICE_PER_REPORT || process.env.STRIPE_PRICE_ID;
      db.kpi("paid_report_initiated", normalizedEmail, { address, mode });
    } else if (mode === "subscription") {
      priceId = process.env.STRIPE_PRICE_SUBSCRIPTION;
      sessionMode = "subscription";
      successPath = "/report-pending?session_id={CHECKOUT_SESSION_ID}&sub=1";
      db.kpi("sub_initiated", normalizedEmail, { plan: "monthly" });
    } else if (mode === "enterprise") {
      priceId = process.env.STRIPE_PRICE_ENTERPRISE;
      sessionMode = "subscription";
      successPath = "/report-pending?session_id={CHECKOUT_SESSION_ID}&sub=1&plan=enterprise";
      db.kpi("sub_initiated", normalizedEmail, { plan: "enterprise" });
    } else {
      priceId = process.env.STRIPE_PRICE_ID;
    }

    const sessionData = {
      mode: sessionMode,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      customer_email: normalizedEmail,
      ...(customerId ? { customer: customerId } : {}),
      ...meta,
      success_url: `${origin}${successPath}`,
      cancel_url: `${origin}/#form`,
    };

    if (sessionMode === "payment") {
      sessionData["payment_method_types[0]"] = "card";
    }

    const session = await stripePost("/v1/checkout/sessions", sessionData, SK);

    if (session.error) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: session.error.message }) };

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ url: session.url, sessionId: session.id }) };
  } catch (err) {
    console.error("[create-checkout]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
