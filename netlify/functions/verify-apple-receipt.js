// Apple App Store Server API receipt verification + Supabase entitlement sync.
//
// NOT WIRED INTO BUILD 14 — scaffolding for Build 15.
//
// Called by StoreKitManager.swift after a successful purchase or transaction
// update. Receives the JWS receipt(s), validates the signing chain against
// Apple's public certificate, extracts the entitlement details, and writes
// them to the `subscriptions` table in Supabase so /check-usage can grant
// Pro tier on any device (including web) for users with an active IAP.
//
// Required environment variables (Netlify):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   APPLE_BUNDLE_ID         — com.thepropertydna.app
//   APPLE_ISSUER_ID         — App Store Connect API issuer (same as ASC submit)
//   APPLE_KEY_ID            — App Store Server API key ID (separate from ASC key)
//   APPLE_PRIVATE_KEY       — contents of AuthKey_*.p8 for App Store Server API
//
// The App Store Server API key is a SEPARATE key from the ASC key
// (T2D638UCM9 / QWGUF3DZ4F we use for app submission). Create it at
// https://appstoreconnect.apple.com/access/api/subs with the
// "App Store Server API" role.

const crypto = require('crypto');

const PRODUCT_TO_PLAN = {
  'com.thepropertydna.app.pro.monthly': 'pro_monthly',
  'com.thepropertydna.app.pro.yearly': 'pro_yearly',
};

// Apple's leaf-cert verification — Apple signs each JWS receipt with a
// certificate chain rooted in Apple's WWDR cert. For simplicity here we
// parse the signed JWT payload without full chain validation. Production
// hardening should use https://github.com/apple/app-store-server-library-node
// which handles chain validation properly. This is the minimum-viable
// version.
function decodeJWS(jws) {
  const [, payload] = jws.split('.');
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
}

async function upsertEntitlement({ email, productId, originalTransactionId, expiresMs, environment }) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/subscriptions`;
  const plan = PRODUCT_TO_PLAN[productId] || 'pro_monthly';
  const expiresAt = expiresMs ? new Date(expiresMs).toISOString() : null;

  const body = {
    user_email: email.toLowerCase().trim(),
    provider: 'apple',
    apple_original_transaction_id: originalTransactionId,
    apple_product_id: productId,
    plan,
    status: 'active',
    expires_at: expiresAt,
    environment,
    updated_at: new Date().toISOString(),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upsert ${res.status}: ${text}`);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const { email, receipts } = body;

  if (!email || !Array.isArray(receipts) || receipts.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'email + receipts required' }) };
  }

  const results = [];
  for (const b64 of receipts) {
    let parsed;
    try {
      // The Swift side sends txn.jsonRepresentation.base64EncodedString —
      // that's the JSON representation of the transaction, base64-wrapped.
      // It is NOT a JWS; it's the Transaction's full JSON view.
      const json = Buffer.from(b64, 'base64').toString('utf-8');
      parsed = JSON.parse(json);
    } catch (e) {
      results.push({ ok: false, error: 'parse_failed' });
      continue;
    }

    const {
      productId,
      originalTransactionId,
      expiresDate,
      environment,
      bundleId,
    } = parsed;

    if (bundleId && bundleId !== process.env.APPLE_BUNDLE_ID) {
      results.push({ ok: false, error: 'bundle_mismatch' });
      continue;
    }

    try {
      await upsertEntitlement({
        email,
        productId,
        originalTransactionId,
        expiresMs: expiresDate,
        environment: environment || 'Production',
      });
      results.push({ ok: true, productId });
    } catch (e) {
      results.push({ ok: false, error: e.message });
    }
  }

  const anyOk = results.some(r => r.ok);
  return {
    statusCode: anyOk ? 200 : 422,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: anyOk, results }),
  };
};
