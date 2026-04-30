/**
 * Returns recent property reports with coordinates for the Bloomberg heat map.
 * Combines live Supabase data with Coachella Valley fallback properties.
 */
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Fallback ticker data — shown when DB has no coordinates yet
const FALLBACK_TICKERS = [
  { id: "f1", address: "100 W Andreas Rd", city: "Palm Springs", lat: 33.8303, lon: -116.5383, price: 995000, change: 6.3, dom: 14 },
  { id: "f2", address: "2719 N Junipero Ave", city: "Palm Springs", lat: 33.8429, lon: -116.5338, price: 885000, change: 4.1, dom: 21 },
  { id: "f3", address: "71 Kavenish Dr", city: "Rancho Mirage", lat: 33.7392, lon: -116.4300, price: 1450000, change: 7.8, dom: 9 },
  { id: "f4", address: "77622 Woodhaven Dr", city: "Palm Desert", lat: 33.7222, lon: -116.3744, price: 725000, change: 3.2, dom: 31 },
  { id: "f5", address: "80680 Via Pessaro", city: "La Quinta", lat: 33.6631, lon: -116.3100, price: 1895000, change: 9.4, dom: 6 },
  { id: "f6", address: "48800 Amir Dr", city: "Palm Desert", lat: 33.7100, lon: -116.3600, price: 640000, change: 2.8, dom: 38 },
  { id: "f7", address: "74850 Sheryl Ave", city: "Indian Wells", lat: 33.7197, lon: -116.3425, price: 2100000, change: 8.1, dom: 18 },
  { id: "f8", address: "37800 Bankside Dr", city: "Cathedral City", lat: 33.7797, lon: -116.4665, price: 455000, change: 1.9, dom: 47 },
  { id: "f9", address: "55155 Laurel Valley", city: "La Quinta", lat: 33.6500, lon: -116.3200, price: 3200000, change: 11.2, dom: 4 },
  { id: "f10", address: "82400 Enfield Ln", city: "Indio", lat: 33.7206, lon: -116.2156, price: 420000, change: 3.1, dom: 52 },
  { id: "f11", address: "1150 E Palm Canyon Dr", city: "Palm Springs", lat: 33.8140, lon: -116.5200, price: 875000, change: 5.6, dom: 22 },
  { id: "f12", address: "44800 San Pablo Ave", city: "Palm Desert", lat: 33.7300, lon: -116.3800, price: 560000, change: 2.3, dom: 29 },
];

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  try {
    // Pull recent reports that have coordinates in property_dna
    const rawReports = await db.from("reports")
      .select("id,address,property_dna,created_at")
      .order("created_at", { ascending: false })
      .limit(80)
      .get()
      .catch(() => []);

    const live = [];

    if (Array.isArray(rawReports)) {
      for (const row of rawReports) {
        if (!row.address) continue;
        let dna = row.property_dna;
        if (typeof dna === "string") { try { dna = JSON.parse(dna); } catch { continue; } }
        if (!dna) continue;

        const sub = dna.normalized?.subject || {};
        const val = dna.normalized?.valuation || {};
        const lat = parseFloat(sub.lat);
        const lon = parseFloat(sub.lon);

        if (!lat || !lon || isNaN(lat) || isNaN(lon)) continue;

        const price = Number(val.estimate || val.marketValue || 0);
        if (!price) continue;

        // Compute YoY-style change from comps vs estimate
        const comps = dna.normalized?.comps || [];
        const avgComp = comps.length > 0
          ? comps.reduce((s, c) => s + (c.rawPrice || 0), 0) / comps.length
          : price;
        const change = avgComp > 0 ? ((price - avgComp) / avgComp) * 100 : 0;

        live.push({
          id: row.id,
          address: row.address.split(",")[0],
          city: row.address.split(",")[1]?.trim() || "",
          lat,
          lon,
          price,
          change: Math.round(change * 10) / 10,
          dom: dna.normalized?.sale?.daysOnMarket || Math.floor(Math.random() * 45) + 5,
          score: dna.score || null,
          rating: dna.rating || null,
        });
      }
    }

    // Merge live + fallback (fallback fills gaps)
    const usedIds = new Set(live.map(p => p.id));
    const merged = [
      ...live,
      ...FALLBACK_TICKERS.filter(f => !usedIds.has(f.id)),
    ].slice(0, 30);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ properties: merged, liveCount: live.length }),
    };
  } catch (err) {
    console.error("[get-market-properties]", err.message);
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ properties: FALLBACK_TICKERS, liveCount: 0 }),
    };
  }
};
