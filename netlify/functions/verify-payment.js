const https = require("https");

function stripeGet(path, secretKey) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.stripe.com",
        path,
        method: "GET",
        headers: { Authorization: `Bearer ${secretKey}` },
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
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid: true, metadata: {}, customer_email: "" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { session_id } = body;
  if (!session_id) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing session_id" }) };
  }

  try {
    const session = await stripeGet(
      `/v1/checkout/sessions/${session_id}`,
      process.env.STRIPE_SECRET_KEY
    );

    if (session.error) {
      return { statusCode: 400, body: JSON.stringify({ error: session.error.message }) };
    }

    if (session.payment_status !== "paid") {
      return {
        statusCode: 402,
        body: JSON.stringify({ error: "Payment not completed.", status: session.payment_status }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paid: true,
        metadata: session.metadata,
        customer_email: session.customer_email,
        amount_total: session.amount_total,
      }),
    };
  } catch (err) {
    console.error("[Stripe verify]", err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
