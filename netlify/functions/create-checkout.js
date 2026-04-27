const https = require("https");

function stripePost(path, data, secretKey) {
  const body = new URLSearchParams(data).toString();
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.stripe.com",
        path,
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try { resolve(JSON.parse(raw)); } catch { reject(new Error("Bad JSON")); }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// mode: 'free' | 'per_report' | 'subscription' | 'enterprise'
exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: "Method Not Allowed" };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { fullName, email, phone, role, address, city, state, zip, notes, mode = "free" } = body;

  if (!email || !address) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Email and address are required." }) };
  }

  const origin = event.headers.origin || "https://thepropertydna.com";
  const meta = {
    "metadata[fullName]": fullName || "",
    "metadata[email]": email,
    "metadata[phone]": phone || "",
    "metadata[role]": role || "Buyer",
    "metadata[address]": address,
    "metadata[city]": city || "",
    "metadata[state]": state || "",
    "metadata[zip]": zip || "",
    "metadata[notes]": notes || "",
    "metadata[mode]": mode,
  };

  // ── FREE: no Stripe needed, redirect directly ──────────────────────────
  if (mode === "free") {
    const params = new URLSearchParams({
      bypass: "1", mode: "free",
      fullName: fullName || "", email,
      phone: phone || "", role: role || "Buyer",
      address, city: city || "", state: state || "", zip: zip || "", notes: notes || "",
    });
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: `${origin}/report-pending?${params.toString()}` }),
    };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    // Fallback: treat as free when no Stripe configured
    const params = new URLSearchParams({
      bypass: "1", mode,
      fullName: fullName || "", email,
      phone: phone || "", role: role || "Buyer",
      address, city: city || "", state: state || "", zip: zip || "", notes: notes || "",
    });
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: `${origin}/report-pending?${params.toString()}` }),
    };
  }

  try {
    let priceId;
    let sessionMode = "payment";
    let successPath = "/report-pending?session_id={CHECKOUT_SESSION_ID}";

    if (mode === "per_report") {
      priceId = process.env.STRIPE_PRICE_PER_REPORT || process.env.STRIPE_PRICE_ID;
    } else if (mode === "subscription") {
      priceId = process.env.STRIPE_PRICE_SUBSCRIPTION;
      sessionMode = "subscription";
      successPath = "/report-pending?session_id={CHECKOUT_SESSION_ID}&sub=1";
    } else if (mode === "enterprise") {
      priceId = process.env.STRIPE_PRICE_ENTERPRISE;
      sessionMode = "subscription";
      successPath = "/report-pending?session_id={CHECKOUT_SESSION_ID}&sub=1&plan=enterprise";
    } else {
      priceId = process.env.STRIPE_PRICE_ID;
    }

    const sessionData = {
      "payment_method_types[0]": "card",
      mode: sessionMode,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      customer_email: email,
      ...meta,
      success_url: `${origin}${successPath}`,
      cancel_url: `${origin}/#form`,
    };

    if (sessionMode === "subscription") {
      delete sessionData["payment_method_types[0]"];
    }

    const session = await stripePost("/v1/checkout/sessions", sessionData, process.env.STRIPE_SECRET_KEY);

    if (session.error) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: session.error.message }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error("[Stripe]", err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
