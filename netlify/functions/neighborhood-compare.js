/**
 * neighborhood-compare — returns how a property ranks within its micro-neighborhood
 * vs the broader city, using Assessor CREST data from property_history.
 *
 * Neighborhood definition: same APN book+page (first 6 digits of APN).
 * In Riverside County's assessor system, book+page parcels are physically
 * contiguous — the same block or subdivision. This is finer than zip code
 * but broader than "the house next door," giving a meaningful peer group.
 *
 * GET /.netlify/functions/neighborhood-compare?apn=504012001
 */

const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Palm Springs named neighborhood lookup by APN book
// Source: Riverside County Assessor geographic organization
const PS_NEIGHBORHOODS = {
  "501": "Vista Las Palmas",
  "502": "Old Las Palmas",
  "503": "Los Compadres",
  "504": "Movie Colony",
  "505": "El Mirador",
  "506": "Central Palm Springs",
  "507": "Baristo",
  "508": "Ramon Road Corridor",
  "509": "Tahquitz River Estates",
  "510": "Sunrise Park",
  "511": "Sunrise",
  "512": "Canyon Estates",
  "513": "Ruth Hardy Park",
  "514": "Racquet Club Estates",
  "515": "Desert Park Estates",
  "516": "Palm Springs Heights",
  "517": "Araby",
  "518": "Gene Autry Trail Corridor",
  "669": "Deepwell Estates",
  "670": "Deepwell Ranch",
  "671": "Palm Springs Villas",
  "677": "South Palm Springs",
  "678": "Cathedral Canyon",
  "679": "Twin Palms",
  "680": "Canyon South",
  "009": "South Palm Springs Historic",
};

function neighborhoodLabel(apn, city) {
  const book = apn.substring(0, 3);
  const bookInt = parseInt(book, 10).toString();
  if (city === "PALM SPRINGS" && PS_NEIGHBORHOODS[bookInt]) {
    return PS_NEIGHBORHOODS[bookInt];
  }
  // Fallback: "City Book XXX" gives agents something meaningful
  return `${toTitleCase(city)} District ${parseInt(book, 10)}`;
}

function toTitleCase(str) {
  return (str || "").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function percentileRank(values, target) {
  if (!values.length || target == null) return null;
  const below = values.filter(v => v < target).length;
  return Math.round((below / values.length) * 100);
}

function avg(arr) {
  const nums = arr.filter(v => v != null && !isNaN(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

function median(arr) {
  const nums = arr.filter(v => v != null && !isNaN(v)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function round2(v) {
  return v != null ? Math.round(v * 100) / 100 : null;
}

function landRatio(land, improv) {
  const total = (land || 0) + (improv || 0);
  return total > 0 ? land / total : null;
}

function scoreLabel(pct) {
  if (pct == null) return "Insufficient data";
  if (pct >= 85) return "Exceptional — top 15% of neighborhood";
  if (pct >= 70) return "Above average";
  if (pct >= 45) return "At neighborhood standard";
  if (pct >= 25) return "Below neighborhood average";
  return "Significantly below neighborhood";
}

function delta(val, ref) {
  if (val == null || ref == null || ref === 0) return null;
  return Math.round(((val - ref) / ref) * 100);
}

// Zip code prefix by city — for city-wide PostgREST LIKE filter on data->>'postalCode'
// PostgREST json operator requires the ->> form, not nested path
const CITY_ZIP_PREFIXES = {
  "PALM SPRINGS":      "9226*",   // 92262, 92264, 92263
  "PALM DESERT":       "92260*",  // 92260, 92261
  "RANCHO MIRAGE":     "92270*",
  "INDIAN WELLS":      "92210*",
  "LA QUINTA":         "92253*",
  "INDIO":             "92201*",  // 92201, 92203
  "CATHEDRAL CITY":    "92234*",
  "DESERT HOT SPRINGS":"92240*",
  "COACHELLA":         "92236*",
  "HEMET":             "92543*",
  "BANNING":           "92220*",
  "BEAUMONT":          "92223*",
};

function cityZipPrefix(city) {
  return CITY_ZIP_PREFIXES[city] || "9*"; // fallback won't match much — returns sparse data
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };

  const apn = (event.queryStringParameters?.apn || "").replace(/[^0-9]/g, "");
  if (!apn || apn.length < 6) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Valid APN required (9 digits)" }) };
  }

  const neighborhoodKey = apn.substring(0, 6); // book+page

  try {
    // ── 1. Target property + city lookup — run in parallel ───────────────────
    const [histRows, masterRows] = await Promise.all([
      db.from("property_history")
        .select("apn, data")
        .eq("apn", apn)
        .eq("source", "rivco_assessor_crest")
        .limit(1)
        .get()
        .catch(() => []),
      db.from("property_master")
        .select("city, zip, address, sqft, year_built, lot_sqft")
        .eq("apn", apn)
        .limit(1)
        .get()
        .catch(() => []),
    ]);

    const targetHistory = Array.isArray(histRows) ? histRows[0] : null;
    const td = targetHistory?.data || {};
    const master = Array.isArray(masterRows) ? masterRows[0] : {};
    const city = master?.city || "UNKNOWN";

    // ── 3. Neighborhood peers — same book+page ────────────────────────────────
    // PostgREST like operator uses * as wildcard (not SQL %).
    // Same APN book+page = physically contiguous parcels — the actual block.
    const neighborRows = await db.from("property_history")
      .select("apn, data")
      .like("apn", `${neighborhoodKey}*`)
      .eq("source", "rivco_assessor_crest")
      .limit(500)
      .get()
      .catch(() => []);

    const peers = Array.isArray(neighborRows) ? neighborRows : [];

    // ── 4. Minimum data gate — refuse comparison if peers are insufficient ────
    // 97%+ accuracy requires a real peer group. Under 5 peers = meaningless stats.
    const validPeerCount = peers.filter(p =>
      p.data?.renovationRatio != null || p.data?.conditionScore != null
    ).length;

    if (!targetHistory || validPeerCount < 5) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          apn,
          address: master?.address || null,
          city: toTitleCase(city),
          neighborhoodKey,
          neighborhoodLabel: neighborhoodLabel(apn, city),
          insufficientData: true,
          validPeerCount,
          message: validPeerCount < 5
            ? `Only ${validPeerCount} neighbors with assessor data — need 5+ for reliable comparison`
            : "No CREST assessor record for this parcel",
        }),
      };
    }

    // ── 5. City-level aggregate — pull via property_master city join ──────────
    // Get up to 500 APNs for this city from property_master, then fetch their
    // CREST history. property_master.city is indexed and queryable directly.
    // We spread the APN range (offset 5000) to avoid sampling just one neighborhood.
    const [cityApnsBatch1, cityApnsBatch2] = await Promise.all([
      db.from("property_master").select("apn").eq("city", city).limit(250).get(),
      db.from("property_master").select("apn").eq("city", city).limit(250).offset(5000).get(),
    ]);
    const cityApns = [
      ...(Array.isArray(cityApnsBatch1) ? cityApnsBatch1 : []),
      ...(Array.isArray(cityApnsBatch2) ? cityApnsBatch2 : []),
    ].map(r => r.apn).filter(Boolean);

    const cityHistSample = cityApns.length > 0
      ? await db.from("property_history")
          .select("apn, data")
          .in("apn", cityApns.slice(0, 400))
          .eq("source", "rivco_assessor_crest")
          .limit(400)
          .get()
          .catch(() => [])
      : [];

    // ── 6. Extract metrics ────────────────────────────────────────────────────
    function extractMetrics(rows) {
      return rows.map(r => {
        const d = r.data || {};
        return {
          apn: r.apn,
          renovationRatio:  d.renovationRatio  != null ? parseFloat(d.renovationRatio) : null,
          conditionScore:   d.conditionScore    != null ? parseFloat(d.conditionScore)  : null,
          yearBuilt:        d.yearBuilt         != null ? parseInt(d.yearBuilt)         : null,
          landValue:        d.landValue         != null ? parseFloat(d.landValue)       : null,
          improvValue:      d.improvValue       != null ? parseFloat(d.improvValue)     : null,
          totalValue:       d.totalValue        != null ? parseFloat(d.totalValue)      : null,
          landRatio: landRatio(
            d.landValue != null ? parseFloat(d.landValue) : null,
            d.improvValue != null ? parseFloat(d.improvValue) : null
          ),
        };
      });
    }

    const peerMetrics   = extractMetrics(peers);
    const cityMetrics   = extractMetrics(Array.isArray(cityHistSample) ? cityHistSample : []);

    const self = {
      renovationRatio: td.renovationRatio != null ? parseFloat(td.renovationRatio) : null,
      conditionScore:  td.conditionScore  != null ? parseFloat(td.conditionScore)  : null,
      yearBuilt:       td.yearBuilt       != null ? parseInt(td.yearBuilt)         : null,
      landValue:       td.landValue       != null ? parseFloat(td.landValue)       : null,
      improvValue:     td.improvValue     != null ? parseFloat(td.improvValue)     : null,
      totalValue:      td.totalValue      != null ? parseFloat(td.totalValue)      : null,
      landRatio: landRatio(
        td.landValue != null ? parseFloat(td.landValue) : null,
        td.improvValue != null ? parseFloat(td.improvValue) : null
      ),
    };

    // ── 6. Compute neighborhood stats ─────────────────────────────────────────
    const nRenovRatios   = peerMetrics.map(p => p.renovationRatio).filter(v => v != null);
    const nCondScores    = peerMetrics.map(p => p.conditionScore).filter(v => v != null);
    const nYearBuilts    = peerMetrics.map(p => p.yearBuilt).filter(v => v != null);
    const nLandRatios    = peerMetrics.map(p => p.landRatio).filter(v => v != null);
    const nTotalValues   = peerMetrics.map(p => p.totalValue).filter(v => v != null);

    const neighborhoodStats = {
      parcelCount:          peerMetrics.length,
      avgRenovationRatio:   round2(avg(nRenovRatios)),
      medianRenovationRatio: round2(median(nRenovRatios)),
      avgConditionScore:    round2(avg(nCondScores)),
      avgYearBuilt:         Math.round(avg(nYearBuilts) || 0) || null,
      avgLandRatio:         round2(avg(nLandRatios)),
      medianTotalValue:     Math.round(median(nTotalValues) || 0) || null,
      minYearBuilt:         Math.min(...nYearBuilts) || null,
      maxYearBuilt:         Math.max(...nYearBuilts) || null,
    };

    // ── 7. Compute city stats ─────────────────────────────────────────────────
    const cRenovRatios = cityMetrics.map(p => p.renovationRatio).filter(v => v != null);
    const cCondScores  = cityMetrics.map(p => p.conditionScore).filter(v => v != null);
    const cLandRatios  = cityMetrics.map(p => p.landRatio).filter(v => v != null);
    const cTotalValues = cityMetrics.map(p => p.totalValue).filter(v => v != null);

    const cityStats = {
      sampleSize:           cityMetrics.length,
      avgRenovationRatio:   round2(avg(cRenovRatios)),
      avgConditionScore:    round2(avg(cCondScores)),
      avgLandRatio:         round2(avg(cLandRatios)),
      medianTotalValue:     Math.round(median(cTotalValues) || 0) || null,
    };

    // ── 8. Percentile ranks ───────────────────────────────────────────────────
    const neighborhoodRanks = {
      renovationRatio: percentileRank(nRenovRatios, self.renovationRatio),
      conditionScore:  percentileRank(nCondScores,  self.conditionScore),
      landRatio:       percentileRank(nLandRatios,  self.landRatio),
    };

    // Overall neighborhood percentile = avg of available ranks
    const availRanks = Object.values(neighborhoodRanks).filter(v => v != null);
    const overallNeighborhoodPct = availRanks.length
      ? Math.round(availRanks.reduce((a, b) => a + b, 0) / availRanks.length)
      : null;

    // ── 9. Deltas vs neighborhood ─────────────────────────────────────────────
    const deltas = {
      renovationRatio: delta(self.renovationRatio, neighborhoodStats.avgRenovationRatio),
      conditionScore:  delta(self.conditionScore,  neighborhoodStats.avgConditionScore),
      landRatio:       delta(self.landRatio,        neighborhoodStats.avgLandRatio),
      totalValue:      delta(self.totalValue,        neighborhoodStats.medianTotalValue),
    };

    // ── 10. Response ──────────────────────────────────────────────────────────
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        apn,
        address:        master?.address || null,
        city:           toTitleCase(city),
        cityRaw:        city,
        zip:            master?.zip || td.postalCode || null,
        neighborhoodKey,
        neighborhoodLabel: neighborhoodLabel(apn, city),

        property: {
          renovationRatio: self.renovationRatio,
          conditionScore:  self.conditionScore,
          yearBuilt:       self.yearBuilt || master?.year_built || null,
          landValue:       self.landValue,
          improvValue:     self.improvValue,
          totalValue:      self.totalValue,
          landRatio:       round2(self.landRatio),
          detectedFeatures: td.detectedFeatures || [],
          dataQuality:     td.dataQuality || "unknown",
        },

        neighborhood: neighborhoodStats,
        cityStats,

        ranks: {
          overall:          overallNeighborhoodPct,
          overallLabel:     scoreLabel(overallNeighborhoodPct),
          renovationRatio:  neighborhoodRanks.renovationRatio,
          conditionScore:   neighborhoodRanks.conditionScore,
          landRatio:        neighborhoodRanks.landRatio,
        },

        deltas,

        // Standout peers: top 3 best-condition neighbors
        standoutNeighbors: peerMetrics
          .filter(p => p.apn !== apn && p.conditionScore != null)
          .sort((a, b) => (b.conditionScore || 0) - (a.conditionScore || 0))
          .slice(0, 3)
          .map(p => ({ apn: p.apn, conditionScore: p.conditionScore, renovationRatio: p.renovationRatio, yearBuilt: p.yearBuilt })),
      }),
    };

  } catch (err) {
    console.error("[neighborhood-compare]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
