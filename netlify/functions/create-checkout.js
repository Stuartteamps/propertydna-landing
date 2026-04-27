const Stripe = require("stripe");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { fullName, email, phone, role, address, city, state, zip, notes } = body;

  if (!email || !address) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Email and address are required." }),
    };
  }

  const origin = event.headers.origin || "https://thepropertydna.com";
  const fullAddress = [address, city, state, zip].filter(Boolean).join(", ");

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      customer_email: email,
      metadata: {
        fullName: fullName || "",
        email,
        phone: phone || "",
        role: role || "Buyer",
        address,
        city: city || "",
        state: state || "",
        zip: zip || "",
        notes: notes || "",
      },
      success_url: `${origin}/report-pending?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#form`,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error("[Stripe]", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
