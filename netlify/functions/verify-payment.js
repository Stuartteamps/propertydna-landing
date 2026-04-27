const https = require("https");

function stripeGet(path, secretKey) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: "api.stripe.com", path, method: "GET", headers: { Authorization: `Bearer ${secretKey}` } },
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

function supabasePost(body, serviceKey) {
  const data = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "neccpdfhmfnvyjgyrysy.supabase.co",
        path: "/rest/v1/reports",
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error("Bad JSON")); } });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method Not Allowed" };

  if (!process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 200, headers, body: JSON.stringify({ paid: true, metadata: {}, customer_email: "" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { session_id } = body;
  if (!session_id) return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing session_id" }) };

  try {
    const session = await stripeGet(`/v1/checkout/sessions/${session_id}`, process.env.STRIPE_SECRET_KEY);

    if (session.error) return { statusCode: 400, headers, body: JSON.stringify({ error: session.error.message }) };

    if (session.payment_status !== "paid" && session.status !== "complete") {
      return { statusCode: 402, headers, body: JSON.stringify({ error: "Payment not completed.", status: session.payment_status }) };
    }

    const meta = session.metadata || {};
    const isSubscription = session.mode === "subscription";

    // Save subscription record to Supabase
    if (isSubscription && process.env.SUPABASE_SERVICE_KEY && meta.email) {
      const plan = meta.mode === "enterprise" ? "enterprise" : "monthly";
      await supabasePost(
        {
          email: meta.email.toLowerCase(),
          full_name: meta.fullName || null,
          address: null,
          role: "SUBSCRIPTION",
          property_dna: JSON.stringify({
            status: "active",
            plan,
            stripe_subscription_id: session.subscription || session.id,
            stripe_session_id: session_id,
            activatedAt: new Date().toISOString(),
          }),
        },
        process.env.SUPABASE_SERVICE_KEY
      ).catch((e) => console.error("[Supabase sub save]", e.message));
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        paid: true,
        isSubscription,
        metadata: meta,
        customer_email: session.customer_email || meta.email,
        amount_total: session.amount_total,
      }),
    };
  } catch (err) {
    console.error("[verify-payment]", err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
