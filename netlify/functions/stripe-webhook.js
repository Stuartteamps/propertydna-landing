/**
 * Stripe Webhook Handler
 *
 * Register this URL in your Stripe Dashboard:
 *   https://thepropertydna.com/.netlify/functions/stripe-webhook
 *
 * Events to subscribe:
 *   checkout.session.completed
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   invoice.paid
 *   invoice.payment_failed
 *   payment_intent.succeeded
 *   payment_intent.payment_failed
 */
const https = require("https");
const crypto = require("crypto");
const db = require("./_supabase");

function verifyStripeSignature(payload, sigHeader, secret) {
  if (!secret) return true; // Skip in dev
  const parts = sigHeader.split(",").reduce((acc, part) => {
    const [k, v] = part.split("=");
    if (k === "t") acc.timestamp = v;
    if (k === "v1") acc.signatures.push(v);
    return acc;
  }, { timestamp: null, signatures: [] });

  const signed = `${parts.timestamp}.${payload}`;
  const expected = crypto.createHmac("sha256", secret).update(signed, "utf8").digest("hex");
  return parts.signatures.some((s) => crypto.timingSafeEqual(Buffer.from(s, "hex"), Buffer.from(expected, "hex")));
}

async function handleCheckoutCompleted(session) {
  const meta = session.metadata || {};
  const email = (session.customer_email || meta.email || "").toLowerCase().trim();
  const isSubscription = session.mode === "subscription";
  const mode = meta.mode || (isSubscription ? "subscription" : "per_report");

  if (!email) return;

  // Upsert profile
  await db.upsert("profiles", {
    email,
    full_name: meta.fullName || null,
    phone: meta.phone || null,
    stripe_customer_id: session.customer || null,
  }, "email").catch((e) => console.error("[profile]", e.message));

  if (!isSubscription) {
    // Record payment
    await db.insert("payments", {
      email,
      stripe_session_id: session.id,
      stripe_customer_id: session.customer || null,
      amount: session.amount_total || 0,
      currency: session.currency || "usd",
      status: "paid",
      mode,
      plan_name: null,
    }).catch((e) => console.error("[payment]", e.message));

    // Create property_report record
    const unitStr = meta.unit || "";
    const fullAddress = [
      meta.address,
      unitStr ? `Unit ${unitStr}` : null,
      meta.city, meta.state, meta.zip,
    ].filter(Boolean).join(", ");

    await db.insert("property_reports", {
      email,
      address: meta.address || "",
      unit: unitStr || null,
      city: meta.city || null,
      state: meta.state || null,
      zip: meta.zip || null,
      full_address: fullAddress,
      property_type: meta.propertyType || null,
      role: meta.role || "Buyer",
      stripe_session_id: session.id,
      status: "pending",
      idx_url: meta.idxUrl || null,
      mls_number: meta.mlsNumber || null,
      listing_source: meta.listingSource || null,
      listing_agent: meta.listingAgent || null,
      listing_brokerage: meta.listingBrokerage || null,
      mls_enrichment_status: meta.idxUrl || meta.mlsNumber ? "pending" : null,
    }).catch((e) => console.error("[report create]", e.message));

    db.kpi("paid_report", email, { session_id: session.id, amount: session.amount_total });
  }

  if (isSubscription) {
    const plan = meta.plan === "enterprise" ? "enterprise" : "monthly";
    await db.upsert("subscriptions", {
      email,
      stripe_subscription_id: session.subscription || session.id,
      stripe_customer_id: session.customer || null,
      stripe_price_id: plan === "enterprise" ? process.env.STRIPE_PRICE_ENTERPRISE : process.env.STRIPE_PRICE_SUBSCRIPTION,
      plan_name: plan,
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }, "stripe_subscription_id").catch((e) => console.error("[sub]", e.message));

    db.kpi("sub_start", email, { plan, session_id: session.id });
  }
}

async function handleSubscriptionUpdated(subscription) {
  const SK = process.env.STRIPE_SECRET_KEY;
  let email = null;

  // Get email from customer
  if (subscription.customer && SK) {
    await new Promise((resolve) => {
      const req = https.request(
        { hostname: "api.stripe.com", path: `/v1/customers/${subscription.customer}`, method: "GET", headers: { Authorization: `Bearer ${SK}` } },
        (res) => {
          let raw = "";
          res.on("data", (c) => (raw += c));
          res.on("end", () => {
            try { const c = JSON.parse(raw); email = c.email || null; } catch {}
            resolve();
          });
        }
      );
      req.on("error", resolve);
      req.end();
    });
  }

  if (!email) return;

  const periodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000).toISOString() : null;
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString() : null;

  await db.from("subscriptions")
    .eq("stripe_subscription_id", subscription.id)
    .update({
      status: subscription.status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
    })
    .catch((e) => console.error("[sub update]", e.message));

  if (subscription.status === "canceled") {
    db.kpi("sub_cancel", email, { subscription_id: subscription.id });
  }
}

async function handleSubscriptionDeleted(subscription) {
  await db.from("subscriptions")
    .eq("stripe_subscription_id", subscription.id)
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .catch((e) => console.error("[sub delete]", e.message));

  db.kpi("sub_cancel", null, { subscription_id: subscription.id });
}

async function handleInvoicePaid(invoice) {
  if (!invoice.subscription) return;

  await db.from("subscriptions")
    .eq("stripe_subscription_id", invoice.subscription)
    .update({
      status: "active",
      current_period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
      current_period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
    })
    .catch((e) => console.error("[invoice paid]", e.message));

  // Record payment
  const email = invoice.customer_email || null;
  if (email) {
    await db.insert("payments", {
      email: email.toLowerCase(),
      stripe_payment_intent_id: typeof invoice.payment_intent === "string" ? invoice.payment_intent : null,
      stripe_customer_id: invoice.customer || null,
      amount: invoice.amount_paid || 0,
      currency: invoice.currency || "usd",
      status: "paid",
      mode: "subscription",
      plan_name: "monthly",
    }).catch(() => {});

    db.kpi("subscription_renewal", email, { invoice_id: invoice.id, amount: invoice.amount_paid });
  }
}

async function handleInvoicePaymentFailed(invoice) {
  if (invoice.subscription) {
    await db.from("subscriptions")
      .eq("stripe_subscription_id", invoice.subscription)
      .update({ status: "past_due" })
      .catch((e) => console.error("[invoice failed]", e.message));
  }

  const email = invoice.customer_email || null;
  db.kpi("failed_payment", email, {
    invoice_id: invoice.id,
    amount: invoice.amount_due,
    attempt_count: invoice.attempt_count,
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const sig = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
  const rawBody = event.body;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Verify signature
  if (sig && webhookSecret) {
    if (!verifyStripeSignature(rawBody, sig, webhookSecret)) {
      console.error("[stripe-webhook] Invalid signature");
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid signature" }) };
    }
  }

  let stripeEvent;
  try { stripeEvent = JSON.parse(rawBody); } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { id: eventId, type, data } = stripeEvent;
  const object = data?.object;

  // Idempotency — skip already-processed events
  const existing = await db.from("stripe_events")
    .select("id,processed")
    .eq("stripe_event_id", eventId)
    .limit(1)
    .get()
    .catch(() => []);

  if (Array.isArray(existing) && existing.length > 0 && existing[0].processed) {
    console.log(`[stripe-webhook] Skipping duplicate event ${eventId}`);
    return { statusCode: 200, body: JSON.stringify({ received: true, skipped: true }) };
  }

  // Store raw event
  await db.upsert("stripe_events", {
    stripe_event_id: eventId,
    event_type: type,
    data: stripeEvent,
    processed: false,
  }, "stripe_event_id").catch((e) => console.error("[event store]", e.message));

  let processingError = null;

  try {
    switch (type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(object);
        break;
      case "invoice.paid":
        await handleInvoicePaid(object);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(object);
        break;
      default:
        console.log(`[stripe-webhook] Unhandled event type: ${type}`);
    }
  } catch (err) {
    processingError = err.message;
    console.error(`[stripe-webhook] Error processing ${type}:`, err.message);
  }

  // Mark as processed (even on error — prevents retry loops)
  await db.from("stripe_events")
    .eq("stripe_event_id", eventId)
    .update({ processed: true, error: processingError })
    .catch(() => {});

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
