/**
 * import-contacts — Batch import contacts into a campaign
 *
 * POST body:
 *   campaignId?     UUID    — existing campaign (creates new if omitted)
 *   campaignName?   text    — used when creating new campaign
 *   campaignType?   text    — 'homeowner' | 'buyer' | 'agent' | 'general'
 *   campaignSubject text    — email subject line for this campaign
 *   contacts        array   — parsed contact objects from CSV
 *     { firstName, lastName, email, phone, address, city, state, zip }
 *
 * Returns: { campaignId, imported, skipped, unsubscribed, duplicates, total }
 *
 * Auth: x-internal-key header
 */
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

function normalizePhone(raw) {
  if (!raw) return "";
  const d = (raw + "").replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  return raw.trim();
}

function normalizeName(raw) {
  if (!raw) return "";
  return raw.trim().split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function normalizeEmail(raw) {
  if (!raw) return "";
  return (raw + "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeContact(c) {
  return {
    first_name:    normalizeName(c.firstName || c.first_name || ""),
    last_name:     normalizeName(c.lastName  || c.last_name  || ""),
    email:         normalizeEmail(c.email || ""),
    phone:         normalizePhone(c.phone || c.mobile || c.cell || ""),
    address:       (c.address || c.street || c.property_address || "").trim(),
    city:          normalizeName(c.city || ""),
    state:         (c.state || "CA").trim().toUpperCase().slice(0, 2),
    zip:           (c.zip || c.zipcode || c.zip_code || c.postal || "").trim().slice(0, 5),
    brokerage:     (c.brokerage || "").trim(),
    property_type: (c.propertyType || c.property_type || "").trim(),
    metadata:      {},
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const internalKey = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (process.env.INTERNAL_API_KEY && internalKey !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const {
    campaignId: existingId,
    campaignName = "Untitled Campaign",
    campaignType = "homeowner",
    campaignSubject = "",
    contacts = [],
  } = body;

  if (!Array.isArray(contacts) || contacts.length === 0) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "contacts array required" }) };
  }

  // ── Normalize + validate contacts ────────────────────────────
  const normalized = contacts.map(normalizeContact).filter(c => isValidEmail(c.email));
  const invalidCount = contacts.length - normalized.length;

  if (normalized.length === 0) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "No valid emails found in contacts", invalid: invalidCount }) };
  }

  // ── Get or create campaign ───────────────────────────────────
  let campaignId = existingId;
  if (!campaignId) {
    try {
      const [newCampaign] = await db.insert("campaigns", {
        name:    campaignName,
        type:    campaignType,
        status:  "draft",
        subject: campaignSubject,
        total_contacts: 0,
      });
      campaignId = newCampaign.id;
    } catch (err) {
      console.error("[import-contacts] create campaign:", err.message);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Failed to create campaign" }) };
    }
  }

  // ── Load existing emails in this campaign (dupe check) ───────
  let existingEmails = new Set();
  try {
    const existing = await db.from("campaign_contacts")
      .select("email")
      .eq("campaign_id", campaignId)
      .get();
    if (Array.isArray(existing)) existing.forEach(r => existingEmails.add(r.email));
  } catch (err) {
    console.warn("[import-contacts] existing check:", err.message);
  }

  // ── Load global unsubscribe list ─────────────────────────────
  let unsubEmails = new Set();
  try {
    const unsubs = await db.from("campaign_unsubscribes").select("email").get();
    if (Array.isArray(unsubs)) unsubs.forEach(r => unsubEmails.add(r.email));
  } catch (err) {
    console.warn("[import-contacts] unsubscribe check:", err.message);
  }

  // ── Filter contacts ──────────────────────────────────────────
  const toImport   = [];
  let duplicates   = 0;
  let unsubscribed = 0;

  for (const c of normalized) {
    if (unsubEmails.has(c.email)) { unsubscribed++; continue; }
    if (existingEmails.has(c.email)) { duplicates++; continue; }
    toImport.push(c);
    existingEmails.add(c.email); // prevent intra-batch dupes
  }

  // ── Batch insert (chunks of 200) ─────────────────────────────
  let imported = 0;
  const CHUNK  = 200;
  for (let i = 0; i < toImport.length; i += CHUNK) {
    const chunk = toImport.slice(i, i + CHUNK).map(c => ({ ...c, campaign_id: campaignId, status: "pending" }));
    try {
      await db.insert("campaign_contacts", chunk);
      imported += chunk.length;
    } catch (err) {
      console.error("[import-contacts] insert chunk:", err.message);
    }
  }

  // ── Update campaign total_contacts ───────────────────────────
  try {
    const current = await db.from("campaigns").select("total_contacts").eq("id", campaignId).get();
    const prev = (current?.[0]?.total_contacts) || 0;
    await db.update("campaigns", { id: campaignId }, { total_contacts: prev + imported });
  } catch (err) {
    console.warn("[import-contacts] update total:", err.message);
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      campaignId,
      imported,
      skipped: invalidCount,
      unsubscribed,
      duplicates,
      total: contacts.length,
    }),
  };
};
