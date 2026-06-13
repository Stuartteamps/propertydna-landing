/**
 * scan-stale-listings — Daily scan for listings past avg DOM per desert club.
 *
 * Schedule: [functions."scan-stale-listings"] schedule = "0 15 * * *"
 *           (15:00 UTC = 8 AM PDT)
 *
 * For each club in tools/desert-clubs/manifest.json:
 *   1. Pull active listings within the club's zip + price band from RentCast
 *      via property_master (where listing_source != null)
 *   2. Compute DOM (today - list_date)
 *   3. Flag listings with DOM > club.stale_dom_threshold
 *   4. Upsert into stale_listing_tracker
 *   5. Surface NEW stale listings to Dan via daily digest email
 *
 * Pitches go out via a SEPARATE function (pitch-stale-listing-agent.js)
 * so Dan can review the daily digest before firing outreach.
 */
const https = require("https");
const db = require("./_supabase");

// Inline the manifest so we don't depend on filesystem reads at runtime.
const CLUBS = [
  { slug: "thunderbird-country-club",    name: "Thunderbird Country Club",    city: "Rancho Mirage",    zip: "92270", stale_dom_threshold: 110, price_low: 2200000, price_high: 9000000 },
  { slug: "thunderbird-heights",         name: "Thunderbird Heights",         city: "Rancho Mirage",    zip: "92270", stale_dom_threshold: 130, price_low: 2500000, price_high: 8500000 },
  { slug: "mission-lakes-country-club",  name: "Mission Lakes Country Club",  city: "Desert Hot Springs", zip: "92240", stale_dom_threshold: 80,  price_low: 280000,  price_high: 750000 },
  { slug: "indian-wells-country-club",   name: "Indian Wells Country Club",   city: "Indian Wells",     zip: "92210", stale_dom_threshold: 100, price_low: 950000,  price_high: 4500000 },
  { slug: "bighorn-golf-club",           name: "BIGHORN Golf Club",           city: "Palm Desert",      zip: "92260", stale_dom_threshold: 135, price_low: 2500000, price_high: 18000000 },
  { slug: "the-vintage-club",            name: "The Vintage Club",            city: "Indian Wells",     zip: "92210", stale_dom_threshold: 130, price_low: 2800000, price_high: 22000000 },
  { slug: "toscana-country-club",        name: "Toscana Country Club",        city: "Indian Wells",     zip: "92210", stale_dom_threshold: 125, price_low: 1800000, price_high: 9000000 },
  { slug: "stone-eagle-golf-club",       name: "Stone Eagle Golf Club",       city: "Palm Desert",      zip: "92260", stale_dom_threshold: 160, price_low: 4500000, price_high: 22000000 },
  { slug: "the-madison-club",            name: "The Madison Club",            city: "La Quinta",        zip: "92253", stale_dom_threshold: 155, price_low: 4500000, price_high: 35000000 },
  { slug: "the-quarry-at-la-quinta",     name: "The Quarry at La Quinta",     city: "La Quinta",        zip: "92253", stale_dom_threshold: 145, price_low: 3500000, price_high: 18000000 },
  { slug: "the-hideaway-club",           name: "The Hideaway Club",           city: "La Quinta",        zip: "92253", stale_dom_threshold: 130, price_low: 2200000, price_high: 12000000 },
  { slug: "pga-west",                    name: "PGA West",                    city: "La Quinta",        zip: "92253", stale_dom_threshold: 110, price_low: 850000,  price_high: 5500000 },
  { slug: "tradition-golf-club",         name: "Tradition Golf Club",         city: "La Quinta",        zip: "92253", stale_dom_threshold: 130, price_low: 1850000, price_high: 8500000 },
  { slug: "the-reserve-club",            name: "The Reserve Club at Indian Wells", city: "Indian Wells", zip: "92210", stale_dom_threshold: 125, price_low: 1850000, price_high: 7500000 },
  { slug: "morningside-country-club",    name: "Morningside Country Club",    city: "Rancho Mirage",    zip: "92270", stale_dom_threshold: 115, price_low: 950000,  price_high: 5500000 },
  { slug: "the-springs-country-club",    name: "The Springs Country Club",    city: "Rancho Mirage",    zip: "92270", stale_dom_threshold: 105, price_low: 650000,  price_high: 3500000 },
  { slug: "tamarisk-country-club",       name: "Tamarisk Country Club",       city: "Rancho Mirage",    zip: "92270", stale_dom_threshold: 115, price_low: 1450000, price_high: 8500000 },
  { slug: "ironwood-country-club",       name: "Ironwood Country Club",       city: "Palm Desert",      zip: "92260", stale_dom_threshold: 100, price_low: 650000,  price_high: 3850000 },
  { slug: "marrakesh-country-club",      name: "Marrakesh Country Club",      city: "Palm Desert",      zip: "92260", stale_dom_threshold: 95,  price_low: 695000,  price_high: 2950000 },
  { slug: "thunderbird-cove",            name: "Thunderbird Cove",            city: "Rancho Mirage",    zip: "92270", stale_dom_threshold: 110, price_low: 950000,  price_high: 4500000 },
];

const OWNER_EMAIL = process.env.OWNER_EMAIL || "stuartteamps@gmail.com";
const SENDER      = process.env.SENDER_EMAIL || "reports@thepropertydna.com";

function sendEmail({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return Promise.resolve({ status: 0 });
  const payload = JSON.stringify({ from: `PropertyDNA <${SENDER}>`, to, reply_to: "stuartteamps@gmail.com", subject, html, text });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api.resend.com", path: "/emails", method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    }, (res) => {
      let raw = ""; res.on("data", c => raw += c);
      res.on("end", () => { try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode }); } });
    });
    req.on("error", () => resolve({ status: 0 }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ status: 0 }); });
    req.write(payload);
    req.end();
  });
}

async function scanClub(club) {
  // Pull active listings from property_master for this club's zip + price band.
  // property_master row schema has: listing_source, listing_agent, listing_brokerage,
  // mls_number, idx_url, list_date, list_price, address, city, state, zip.
  const today = new Date();
  let rows = [];
  try {
    rows = await db.from("property_master")
      .select("apn,address_line1,city,state,zip,list_price,list_date,listing_agent,listing_brokerage,mls_number,idx_url,listing_source")
      .eq("zip", club.zip)
      .gte("list_price", club.price_low)
      .lte("list_price", club.price_high)
      .not("list_date", "is", null)
      .limit(500)
      .get()
      .catch(() => []);
  } catch { /* fall through */ }
  if (!Array.isArray(rows)) rows = [];

  const stale = [];
  for (const row of rows) {
    if (!row.list_date) continue;
    const listDate = new Date(row.list_date);
    if (isNaN(listDate.getTime())) continue;
    const dom = Math.floor((today.getTime() - listDate.getTime()) / 86400000);
    if (dom < club.stale_dom_threshold) continue;

    stale.push({
      mls_number: row.mls_number || `${row.apn}`,
      address: row.address_line1,
      city: row.city,
      state: row.state,
      zip: row.zip,
      club_slug: club.slug,
      list_price: row.list_price,
      list_date: row.list_date,
      days_on_market: dom,
      avg_dom_for_club: club.stale_dom_threshold,
      dom_ratio: Math.round((dom / club.stale_dom_threshold) * 100) / 100,
      listing_agent: row.listing_agent,
      listing_brokerage: row.listing_brokerage,
      status: "active",
    });
  }

  // Upsert each — keeps existing pitched status intact via on-conflict merge
  for (const item of stale) {
    await db.upsert("stale_listing_tracker", item, "mls_number").catch(() => {});
  }

  return stale;
}

exports.handler = async () => {
  const allStale = [];
  const newToday = [];
  for (const club of CLUBS) {
    const found = await scanClub(club);
    allStale.push(...found);
  }

  // Find which are brand-new (created today)
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const newOnes = await db.from("stale_listing_tracker")
    .select("address,city,club_slug,list_price,days_on_market,avg_dom_for_club,listing_agent,listing_brokerage")
    .gte("created_at", since)
    .order("days_on_market", { ascending: false })
    .limit(200)
    .get()
    .catch(() => []);

  newToday.push(...(Array.isArray(newOnes) ? newOnes : []));

  // Email Dan the daily digest
  if (newToday.length > 0) {
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f9f7f4;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f4;"><tr><td align="center" style="padding:32px 16px;">
<table width="660" cellpadding="0" cellspacing="0" style="max-width:660px;background:#fff;border:1px solid #e5e0d8;">
<tr><td style="padding:24px 32px 12px;border-bottom:1px solid #e5e0d8;">
<p style="margin:0;font-size:11px;color:#999;letter-spacing:3px;text-transform:uppercase;">Stale-listing scan · daily digest</p>
<p style="margin:8px 0 0;font-size:22px;color:#1a1a1a;font-family:Georgia,serif;">${newToday.length} new stale listings to potentially pitch</p>
</td></tr>
<tr><td style="padding:20px 32px;">
<p style="margin:0 0 14px;font-size:13px;color:#444;line-height:1.7;">
Listings past their club's average DOM threshold. Each is a candidate for the listing-agent referral pitch. Review + flag the ones you want to pitch — I'll fire <code>pitch-stale-listing-agent</code> for those individually so the campaign stays opt-in (CAN-SPAM safe + relationship-respectful).
</p>
${newToday.slice(0, 50).map(item => `
<div style="margin-bottom:14px;padding:12px 14px;background:#faf8f5;border-left:3px solid #C9A84C;">
<p style="margin:0 0 4px;font-size:14px;color:#1a1a1a;font-family:Georgia,serif;">${item.address || "(no address)"} · ${item.city}</p>
<p style="margin:0 0 4px;font-size:12px;color:#666;">$${Number(item.list_price || 0).toLocaleString()} · ${item.days_on_market} DOM · threshold ${item.avg_dom_for_club} (${Math.round(item.days_on_market * 100 / Math.max(1, item.avg_dom_for_club))}%)</p>
<p style="margin:0;font-size:11px;color:#888;">Club: ${item.club_slug} · Listing: ${item.listing_agent || "—"} (${item.listing_brokerage || "—"})</p>
</div>`).join("")}
</td></tr>
<tr><td style="padding:18px 32px;background:#0a0908;color:#F4F0E8;text-align:center;font-size:11px;letter-spacing:1px;">
PropertyDNA · stay on track
</td></tr>
</table></td></tr></table></body></html>`;

    await sendEmail({
      to: OWNER_EMAIL,
      subject: `${newToday.length} stale listings to potentially pitch · ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      html,
      text: `${newToday.length} new stale listings:\n\n${newToday.slice(0, 50).map(i => `${i.address || "—"} (${i.city}) · $${Number(i.list_price || 0).toLocaleString()} · ${i.days_on_market} DOM\n  Agent: ${i.listing_agent || "—"} (${i.listing_brokerage || "—"})\n  Club: ${i.club_slug}\n`).join("\n")}`,
    });
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "ok",
      clubs_scanned: CLUBS.length,
      total_stale: allStale.length,
      new_today: newToday.length,
      ran_at: new Date().toISOString(),
    }),
  };
};
