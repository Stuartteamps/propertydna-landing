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

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { fullName, email, phone, role, address, city, state, zip, notes } = body;

  if (!email || !address) {
    return { statusCode: 400, body: JSON.stringify({ error: "Email and address are required." }) };
  }

  const origin = event.headers.origin || "https://thepropertydna.com";

  // ── If Stripe keys are configured, use hosted Checkout ──────────────────
  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID) {
    try {
      const session = await stripePost(
        "/v1/checkout/sessions",
        {
          "payment_method_types[0]": "card",
          mode: "payment",
          "line_items[0][price]": process.env.STRIPE_PRICE_ID,
          "line_items[0][quantity]": "1",
          customer_email: email,
          "metadata[fullName]": fullName || "",
          "metadata[email]": email,
          "metadata[phone]": phone || "",
          "metadata[role]": role || "Buyer",
          "metadata[address]": address,
          "metadata[city]": city || "",
          "metadata[state]": state || "",
          "metadata[zip]": zip || "",
          "metadata[notes]": notes || "",
          success_url: `${origin}/report-pending?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/#form`,
        },
        process.env.STRIPE_SECRET_KEY
      );

      if (session.error) {
        return { statusCode: 400, body: JSON.stringify({ error: session.error.message }) };
      }

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: session.url }),
      };
    } catch (err) {
      console.error("[Stripe]", err.message);
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  // ── No Stripe keys — skip payment, go straight to report ────────────────
  const params = new URLSearchParams({
    bypass: "1",
    fullName: fullName || "",
    email,
    phone: phone || "",
    role: role || "Buyer",
    address,
    city: city || "",
    state: state || "",
    zip: zip || "",
    notes: notes || "",
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: `${origin}/report-pending?${params.toString()}` }),
  };
};
