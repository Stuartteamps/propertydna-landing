const https = require("https");
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ── Geo-gating ──────────────────────────────────────────────────────────────
// PropertyDNA only has data coverage in the US today. Non-US visitors are
// routed to /waitlist instead of paying for a thin report. The supported
// list is intentionally narrow — expand once data partners are wired up.
const SUPPORTED_COUNTRIES = new Set(
  (process.env.SUPPORTED_COUNTRIES || "US").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
);
const GEO_GATE_ENABLED = (process.env.GEO_GATE_ENABLED || "1") !== "0";

function decodeNetlifyGeo(event) {
  // Netlify Edge sets x-nf-geo (base64 JSON: {country:{code,name},city,...})
  const raw = event.headers["x-nf-geo"] || event.headers["X-NF-Geo"];
  if (!raw) return null;
  try { return JSON.parse(Buffer.from(raw, "base64").toString("utf8")); }
  catch { return null; }
}

function lookupCountryByIp(ip) {
  // Lightweight free service (no key). 1s budget so we never block checkout.
  return new Promise((resolve) => {
    if (!ip) return resolve(null);
    const req = https.request(
      { hostname: "ipapi.co", path: `/${encodeURIComponent(ip)}/json/`, method: "GET", headers: { "User-Agent": "PropertyDNA/1.0" } },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
      }
    );
    req.on("error", () => resolve(null));
    req.setTimeout(1200, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

async function detectCountry(event, body) {
  // 1) Explicit signal from the client wins (browser geolocation / manual select)
  const explicit = (body.countryCode || body.country || "").toString().toUpperCase().slice(0, 2);
  if (explicit) return { code: explicit, name: body.countryName || null, source: "client" };

  // 2) Netlify Edge geo header
  const nf = decodeNetlifyGeo(event);
  if (nf?.country?.code) return { code: nf.country.code.toUpperCase(), name: nf.country.name || null, source: "edge" };

  // 3) IP lookup (best-effort)
  const ip = event.headers["x-nf-client-connection-ip"]
          || (event.headers["x-forwarded-for"] || "").split(",")[0].trim()
          || null;
  const ipInfo = await lookupCountryByIp(ip);
  if (ipInfo?.country) return { code: ipInfo.country.toUpperCase(), name: ipInfo.country_name || null, source: "ip" };

  return { code: null, name: null, source: "unknown" };
}

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

  const subOnlyModes = ["consumer", "realtor_pro", "investor", "subscription", "enterprise"];
  if (!email) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Email is required." }) };
  if (!address && !subOnlyModes.includes(mode)) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Email and address are required." }) };

  const normalizedEmail = email.toLowerCase().trim();
  const origin = event.headers.origin || "https://thepropertydna.com";

  // ── Owner bypass — platform owner is never charged ────────────────
  const OWNER_EMAIL = process.env.OWNER_EMAIL || "stuartteamps@gmail.com";
  const isOwner = normalizedEmail === OWNER_EMAIL;

  // ── Geo-gate — non-US visitors land on /waitlist (owner is exempt) ─
  if (GEO_GATE_ENABLED && !isOwner) {
    const geo = await detectCountry(event, body);
    if (geo.code && !SUPPORTED_COUNTRIES.has(geo.code)) {
      const waitlistRow = {
        email:        normalizedEmail,
        full_name:    fullName || null,
        country_code: geo.code,
        country_name: geo.name,
        city:         city || null,
        state:        state || null,
        address:      address || null,
        source:       "create_checkout",
        ip:           event.headers["x-nf-client-connection-ip"] || (event.headers["x-forwarded-for"] || "").split(",")[0].trim() || null,
        user_agent:   event.headers["user-agent"] || null,
      };
      db.insert("waitlist", waitlistRow).catch(() => {}); // table may not exist yet; non-blocking
      db.kpi("geo_blocked", normalizedEmail, { country: geo.code, source: geo.source, mode });
      const params = new URLSearchParams({ country: geo.code, email: normalizedEmail, joined: "1" });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ url: `${origin}/waitlist?${params.toString()}`, gated: true, country: geo.code }) };
    }
  }

  if (isOwner) {
    // Always ensure owner has enterprise subscription in DB
    db.upsert("subscriptions", {
      email: OWNER_EMAIL,
      plan_name: "enterprise",
      status: "active",
      current_period_end: null,
    }, "email").catch(() => {});

    // FREE mode → generate report via n8n (same as regular free user)
    if (mode === "free") {
      db.insert("report_searches", { email: normalizedEmail, address, city: city || null, state: state || null, zip: zip || null }).catch(() => {});
      db.kpi("owner_free_report", OWNER_EMAIL, { address });
      const params = new URLSearchParams({
        bypass: "1", mode: "free",
        fullName: fullName || "", email: normalizedEmail,
        phone: phone || "", role: role || "Buyer",
        address, unit: unit || "", city: city || "", state: state || "", zip: zip || "",
        propertyType: propertyType || "", notes: notes || "",
      });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ url: `${origin}/report-pending?${params.toString()}` }) };
    }

    // PAID modes → bypass Stripe, confirm enterprise access
    db.kpi("owner_bypass", OWNER_EMAIL, { mode });
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ url: `${origin}/dashboard?plan=enterprise&bypass=owner` }) };
  }

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

    // ── $1 TEST MODE — uses inline price_data, no price ID needed ──
    if (mode === "test") {
      const testSession = await stripePost("/v1/checkout/sessions", {
        mode: "payment",
        "payment_method_types[0]": "card",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": "100",
        "line_items[0][price_data][product_data][name]": "PropertyDNA Test Charge",
        "line_items[0][quantity]": "1",
        ...(customerId ? { customer: customerId } : { customer_email: normalizedEmail }),
        success_url: `${origin}/report-pending?session_id={CHECKOUT_SESSION_ID}&test=1`,
        cancel_url: `${origin}/stripe-test`,
        "metadata[email]": normalizedEmail,
        "metadata[mode]": "test",
      }, SK);
      if (testSession.error) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: testSession.error.message }) };
      db.kpi("test_charge_initiated", normalizedEmail, { sessionId: testSession.id });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ url: testSession.url, sessionId: testSession.id }) };
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
    } else if (mode === "subscription_annual") {
      priceId = process.env.STRIPE_PRICE_SUBSCRIPTION_ANNUAL;
      sessionMode = "subscription";
      successPath = "/report-pending?session_id={CHECKOUT_SESSION_ID}&sub=1&plan=annual";
      db.kpi("sub_initiated", normalizedEmail, { plan: "annual" });
    } else if (mode === "enterprise") {
      priceId = process.env.STRIPE_PRICE_ENTERPRISE;
      sessionMode = "subscription";
      successPath = "/report-pending?session_id={CHECKOUT_SESSION_ID}&sub=1&plan=enterprise";
      db.kpi("sub_initiated", normalizedEmail, { plan: "enterprise" });
    } else if (mode === "consumer") {
      priceId = process.env.STRIPE_PRICE_CONSUMER;
      sessionMode = "subscription";
      successPath = "/dashboard?session_id={CHECKOUT_SESSION_ID}&plan=consumer";
      db.kpi("sub_initiated", normalizedEmail, { plan: "consumer" });
    } else if (mode === "realtor_pro") {
      priceId = process.env.STRIPE_PRICE_REALTOR_PRO;
      sessionMode = "subscription";
      successPath = "/dashboard?session_id={CHECKOUT_SESSION_ID}&plan=realtor_pro";
      db.kpi("sub_initiated", normalizedEmail, { plan: "realtor_pro" });
    } else if (mode === "investor") {
      priceId = process.env.STRIPE_PRICE_INVESTOR;
      sessionMode = "subscription";
      successPath = "/dashboard?session_id={CHECKOUT_SESSION_ID}&plan=investor";
      db.kpi("sub_initiated", normalizedEmail, { plan: "investor" });
    } else {
      priceId = process.env.STRIPE_PRICE_ID;
    }

    const sessionData = {
      mode: sessionMode,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      ...(customerId ? { customer: customerId } : { customer_email: normalizedEmail }),
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
