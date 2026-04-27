const https = require("https");
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

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

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  // No Stripe configured — bypass (dev mode)
  if (!process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ paid: true, metadata: {}, customer_email: "" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { session_id } = body;
  if (!session_id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing session_id" }) };

  const SK = process.env.STRIPE_SECRET_KEY;

  try {
    const session = await stripeGet(`/v1/checkout/sessions/${session_id}`, SK);

    if (session.error) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: session.error.message }) };

    const isComplete = session.payment_status === "paid" || session.status === "complete";
    if (!isComplete) {
      return { statusCode: 402, headers: CORS, body: JSON.stringify({ error: "Payment not completed.", status: session.payment_status }) };
    }

    const meta = session.metadata || {};
    const isSubscription = session.mode === "subscription";
    const customerEmail = (session.customer_email || meta.email || "").toLowerCase().trim();
    const mode = meta.mode || (isSubscription ? "subscription" : "per_report");
    const plan = meta.plan || (isSubscription ? "monthly" : null);

    // ── Upsert profile ─────────────────────────────────────────
    if (customerEmail) {
      db.upsert("profiles", {
        email: customerEmail,
        full_name: meta.fullName || null,
        phone: meta.phone || null,
        stripe_customer_id: session.customer || null,
      }, "email").catch((e) => console.error("[profile upsert]", e.message));
    }

    // ── Record payment ─────────────────────────────────────────
    if (!isSubscription && customerEmail) {
      const priceId = mode === "per_report"
        ? (process.env.STRIPE_PRICE_PER_REPORT || process.env.STRIPE_PRICE_ID)
        : process.env.STRIPE_PRICE_ID;

      db.insert("payments", {
        email: customerEmail,
        stripe_session_id: session_id,
        stripe_customer_id: session.customer || null,
        stripe_price_id: priceId || null,
        amount: session.amount_total || 0,
        currency: session.currency || "usd",
        status: "paid",
        mode,
        plan_name: null,
      }).catch((e) => console.error("[payment insert]", e.message));

      db.kpi("paid_report", customerEmail, { session_id, amount: session.amount_total, mode });
    }

    // ── Record subscription ────────────────────────────────────
    if (isSubscription && customerEmail) {
      const planName = meta.plan === "enterprise" ? "enterprise" : "monthly";
      const priceId = planName === "enterprise"
        ? process.env.STRIPE_PRICE_ENTERPRISE
        : process.env.STRIPE_PRICE_SUBSCRIPTION;

      db.upsert("subscriptions", {
        email: customerEmail,
        stripe_subscription_id: session.subscription || session_id,
        stripe_customer_id: session.customer || null,
        stripe_price_id: priceId || null,
        plan_name: planName,
        status: "active",
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }, "stripe_subscription_id").catch((e) => console.error("[sub upsert]", e.message));

      // Record as a payment too
      db.insert("payments", {
        email: customerEmail,
        stripe_session_id: session_id,
        stripe_customer_id: session.customer || null,
        stripe_price_id: priceId || null,
        amount: session.amount_total || 0,
        currency: session.currency || "usd",
        status: "paid",
        mode,
        plan_name: planName,
      }).catch((e) => console.error("[payment sub insert]", e.message));

      db.kpi("sub_start", customerEmail, { plan: planName, session_id });
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        paid: true,
        isSubscription,
        metadata: meta,
        customer_email: customerEmail,
        amount_total: session.amount_total,
      }),
    };
  } catch (err) {
    console.error("[verify-payment]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
