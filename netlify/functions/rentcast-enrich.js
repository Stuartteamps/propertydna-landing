/**
 * PropertyDNA — RentCast Deep Enrichment
 *
 * Calls all available RentCast endpoints in parallel for a given property.
 * Extracts APN (assessorID) from the property details response — this becomes
 * the canonical primary key for all downstream records.
 *
 * Upserts to property_master (APN as PK), appends sale/assessment/rental
 * events to property_history, stores every raw response in report_data_sources.
 *
 * Called fire-and-forget by save-report.js after each report is saved.
 * Can also be called directly:
 *   POST /.netlify/functions/rentcast-enrich
 *   Headers: x-internal-key: $INTERNAL_API_KEY
 *   Body: { address, city, state, zip, reportId, beds?, baths?, sqft? }
 */

const https = require("https");
const db = require("./_supabase");

const BASE = "api.rentcast.io";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

// ── HTTP helper ───────────────────────────────────────────────────────────────

function rentcastGet(path, key, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: BASE,
        path,
        method: "GET",
        headers: {
          "X-Api-Key": key,
          "Accept": "application/json",
          "User-Agent": "PropertyDNA/3.0 (thepropertydna.com)",
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try {
            const data = JSON.parse(raw);
            resolve({ statusCode: res.statusCode, data, raw });
          } catch {
            resolve({ statusCode: res.statusCode, data: null, raw });
          }
        });
      }
    );
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error(`RentCast timeout: ${path.slice(0, 60)}`)); });
    req.on("error", reject);
    req.end();
  });
}

function qs(params) {
  return "?" + Object.entries(params)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

function parseNum(v) {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

function parseDate(v) {
  if (!v) return null;
  try { return new Date(v).toISOString().slice(0, 10); } catch { return null; }
}

// ── Endpoint fetchers ─────────────────────────────────────────────────────────

async function fetchPropertyDetails(address, city, state, zip, key) {
  try {
    const path = "/v1/properties" + qs({ address, city, state, zipCode: zip, limit: 1 });
    const res = await rentcastGet(path, key);
    if (res.statusCode !== 200 || !res.data) return { status: "failed", statusCode: res.statusCode, raw: res.raw };
    // RentCast returns an array
    const prop = Array.isArray(res.data) ? res.data[0] : res.data;
    if (!prop) return { status: "failed", reason: "empty response" };

    // Extract the most recent tax assessment
    const assessments = prop.taxAssessments || {};
    const assessYears = Object.keys(assessments).map(Number).sort((a, b) => b - a);
    const latestAssessYear = assessYears[0] || null;
    const latestAssess = latestAssessYear ? assessments[latestAssessYear] : null;

    // Extract full sale history from history array
    const saleHistory = (prop.history || [])
      .filter(h => h.event === "Listed For Sale" || h.event === "Sold" || h.price)
      .map(h => ({
        date: parseDate(h.date),
        price: parseNum(h.price),
        event: h.event || "sale",
        listingId: h.listingId || null,
      }))
      .filter(h => h.date);

    return {
      status: "success",
      apn: prop.assessorID || prop.apn || null,
      rentcastId: prop.id || null,
      data: {
        id:               prop.id || null,
        assessorID:       prop.assessorID || null,
        formattedAddress: prop.formattedAddress || null,
        addressLine1:     prop.addressLine1 || null,
        city:             prop.city || null,
        state:            prop.state || null,
        zipCode:          prop.zipCode || null,
        county:           prop.county || null,
        latitude:         parseNum(prop.latitude),
        longitude:        parseNum(prop.longitude),
        propertyType:     prop.propertyType || null,
        bedrooms:         parseNum(prop.bedrooms),
        bathrooms:        parseNum(prop.bathrooms),
        squareFootage:    parseNum(prop.squareFootage),
        lotSize:          parseNum(prop.lotSize),
        yearBuilt:        parseNum(prop.yearBuilt),
        legalDescription: prop.legalDescription || null,
        ownerOccupied:    prop.ownerOccupied ?? null,
        // Assessment
        taxAssessmentYear:  latestAssessYear,
        taxAssessedValue:   latestAssess ? parseNum(latestAssess.value) : null,
        taxAnnualAmount:    prop.propertyTaxes?.[latestAssessYear]?.total
                            ? parseNum(prop.propertyTaxes[latestAssessYear].total) : null,
        // Sale history
        saleHistory,
        lastSaleDate:  saleHistory.find(s => s.event === "Sold")?.date || null,
        lastSalePrice: saleHistory.find(s => s.event === "Sold")?.price || null,
      },
      raw: prop,
    };
  } catch (e) {
    return { status: "failed", error: e.message };
  }
}

async function fetchAVM(address, city, state, zip, beds, baths, sqft, key) {
  try {
    const path = "/v1/avm/value" + qs({
      address, city, state, zipCode: zip,
      ...(beds  ? { bedrooms: beds }     : {}),
      ...(baths ? { bathrooms: baths }   : {}),
      ...(sqft  ? { squareFootage: sqft }: {}),
    });
    const res = await rentcastGet(path, key);
    if (res.statusCode !== 200 || !res.data) return { status: "failed", statusCode: res.statusCode };
    const d = res.data;
    return {
      status: "success",
      data: {
        price:        parseNum(d.price),
        priceRangeLow:  parseNum(d.priceRangeLow),
        priceRangeHigh: parseNum(d.priceRangeHigh),
        latitude:     parseNum(d.latitude),
        longitude:    parseNum(d.longitude),
        confidence:   d.confidence || null,
        listings:     (d.listings || []).slice(0, 5),
      },
      raw: d,
    };
  } catch (e) {
    return { status: "failed", error: e.message };
  }
}

async function fetchRentEstimate(address, city, state, zip, beds, baths, sqft, propertyType, key) {
  try {
    const path = "/v1/avm/rent/long-term" + qs({
      address, city, state, zipCode: zip,
      ...(beds         ? { bedrooms: beds }         : {}),
      ...(baths        ? { bathrooms: baths }        : {}),
      ...(sqft         ? { squareFootage: sqft }     : {}),
      ...(propertyType ? { propertyType }            : {}),
    });
    const res = await rentcastGet(path, key);
    if (res.statusCode !== 200 || !res.data) return { status: "failed", statusCode: res.statusCode };
    const d = res.data;
    const rent = parseNum(d.rent);
    const rentLow = parseNum(d.rentRangeLow);
    const rentHigh = parseNum(d.rentRangeHigh);
    return {
      status: "success",
      data: {
        rent,
        rentRangeLow:  rentLow,
        rentRangeHigh: rentHigh,
        confidence:    d.confidence || null,
        listings:      (d.listings || []).slice(0, 5),
      },
      raw: d,
    };
  } catch (e) {
    return { status: "failed", error: e.message };
  }
}

async function fetchRentalComps(address, city, state, zip, key) {
  try {
    const path = "/v1/properties/rental/long-term" + qs({
      address, city, state, zipCode: zip,
      radius: 0.5, limit: 10, daysOld: 180,
    });
    const res = await rentcastGet(path, key, 15000);
    if (res.statusCode !== 200 || !res.data) return { status: "failed", statusCode: res.statusCode };
    const comps = Array.isArray(res.data) ? res.data : (res.data.listings || []);
    const rents = comps.map(c => parseNum(c.price) || parseNum(c.rent)).filter(Boolean);
    const avgRent = rents.length ? Math.round(rents.reduce((a, b) => a + b, 0) / rents.length) : null;
    return {
      status: "success",
      data: {
        count:   comps.length,
        avgRent,
        comps:   comps.slice(0, 10).map(c => ({
          address:    c.formattedAddress || c.addressLine1 || null,
          rent:       parseNum(c.price) || parseNum(c.rent),
          beds:       parseNum(c.bedrooms),
          baths:      parseNum(c.bathrooms),
          sqft:       parseNum(c.squareFootage),
          daysOnMarket: parseNum(c.daysOnMarket),
          listedDate: parseDate(c.listedDate),
          distance:   parseNum(c.distance),
        })),
      },
      raw: comps.length,
    };
  } catch (e) {
    return { status: "failed", error: e.message };
  }
}

async function fetchSaleComps(address, city, state, zip, key) {
  try {
    const path = "/v1/properties/sale" + qs({
      address, city, state, zipCode: zip,
      radius: 0.5, limit: 10, daysOld: 180, status: "Sold",
    });
    const res = await rentcastGet(path, key, 15000);
    if (res.statusCode !== 200 || !res.data) return { status: "failed", statusCode: res.statusCode };
    const comps = Array.isArray(res.data) ? res.data : (res.data.listings || []);
    const prices = comps.map(c => parseNum(c.price) || parseNum(c.lastSalePrice)).filter(Boolean);
    const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;
    return {
      status: "success",
      data: {
        count:    comps.length,
        avgPrice,
        comps:    comps.slice(0, 10).map(c => ({
          address:   c.formattedAddress || c.addressLine1 || null,
          price:     parseNum(c.price) || parseNum(c.lastSalePrice),
          beds:      parseNum(c.bedrooms),
          baths:     parseNum(c.bathrooms),
          sqft:      parseNum(c.squareFootage),
          saleDate:  parseDate(c.lastSaleDate),
          distance:  parseNum(c.distance),
        })),
      },
      raw: comps.length,
    };
  } catch (e) {
    return { status: "failed", error: e.message };
  }
}

async function fetchMarket(zip, key) {
  try {
    const path = "/v1/markets" + qs({ zipCode: zip });
    const res = await rentcastGet(path, key);
    if (res.statusCode !== 200 || !res.data) return { status: "failed", statusCode: res.statusCode };
    const d = res.data;
    // Market data can be nested under averages/metrics
    const saleData   = d.saleData   || d;
    const rentalData = d.rentalData || d;
    const vacRate    = parseNum(d.vacancyRate || d.vacancy_rate);
    const capRate    = parseNum(d.averageCapRate || d.cap_rate);
    return {
      status: "success",
      data: {
        zipCode:              zip,
        medianSalePrice:      parseNum(saleData.averagePrice || saleData.medianSalePrice),
        medianRent:           parseNum(rentalData.averageRent || rentalData.medianRent),
        rentYoY:              parseNum(rentalData.rentChangeYoY || rentalData.rentYoy),
        priceYoY:             parseNum(saleData.priceChangeYoY || saleData.priceYoy),
        avgDaysOnMarket:      parseNum(saleData.averageDaysOnMarket),
        vacancyRate:          vacRate,
        averageCapRate:       capRate,
        activeSaleListings:   parseNum(d.activeSaleListings || saleData.activeSaleListings),
        activeRentalListings: parseNum(d.activeRentalListings || rentalData.activeRentalListings),
      },
      raw: d,
    };
  } catch (e) {
    return { status: "failed", error: e.message };
  }
}

// ── Store raw responses in report_data_sources ────────────────────────────────

async function storeRawResponses(reportId, responses) {
  if (!reportId) return;
  for (const [name, result] of Object.entries(responses)) {
    db.insert("report_data_sources", {
      report_id:    reportId,
      source_name:  `rentcast_${name}`,
      status:       result?.status || "failed",
      raw_response: result?.raw ? JSON.stringify(result.raw).slice(0, 50000) : null,
      fetched_at:   new Date().toISOString(),
    }).catch(() => {});
  }
}

// ── Write to property_history (append-only) ───────────────────────────────────

async function appendHistory(apn, type, date, data, source) {
  if (!apn) return;
  await db.insert("property_history", {
    apn,
    event_type: type,
    event_date: date || null,
    data:       data || {},
    source,
  }).catch(() => {}); // dedup index silently swallows duplicates
}

// ── Main enrichment function ──────────────────────────────────────────────────

async function rentcastEnrich({ address, city, state, zip, reportId, beds, baths, sqft, propertyType }) {
  const key = process.env.RENTCAST_API_KEY;
  if (!key) return { status: "unavailable", reason: "RENTCAST_API_KEY not set" };
  if (!address) return { status: "failed", reason: "address required" };

  const now = new Date().toISOString();

  // Fire all endpoints in parallel — none blocks the others
  const [propR, avmR, rentR, rentalCompsR, saleCompsR, marketR] = await Promise.allSettled([
    fetchPropertyDetails(address, city, state, zip, key),
    fetchAVM(address, city, state, zip, beds, baths, sqft, key),
    fetchRentEstimate(address, city, state, zip, beds, baths, sqft, propertyType, key),
    fetchRentalComps(address, city, state, zip, key),
    fetchSaleComps(address, city, state, zip, key),
    fetchMarket(zip, key),
  ]);

  const unwrap = r => r.status === "fulfilled" ? r.value : { status: "failed", error: r.reason?.message };
  const prop        = unwrap(propR);
  const avm         = unwrap(avmR);
  const rent        = unwrap(rentR);
  const rentalComps = unwrap(rentalCompsR);
  const saleComps   = unwrap(saleCompsR);
  const market      = unwrap(marketR);

  // Store all raw responses for our database
  await storeRawResponses(reportId, { property: prop, avm, rent_estimate: rent, rental_comps: rentalComps, sale_comps: saleComps, market });

  // Derive APN — the new universal property key
  const apn = prop?.apn || null;
  const rentcastId = prop?.rentcastId || null;
  const propData = prop?.data || {};

  // Compute cap rate and gross yield if we have the data
  const rentEst  = rent?.data?.rent || null;
  const avmValue = avm?.data?.price || null;
  const capRate  = rentEst && avmValue ? parseFloat(((rentEst * 12 / avmValue) * 100).toFixed(2)) : market?.data?.averageCapRate || null;
  const grossYield = capRate;

  // ── Upsert to property_master ──────────────────────────────────────────────
  if (apn) {
    const masterRow = {
      apn,
      rentcast_property_id: rentcastId,
      formatted_address:    propData.formattedAddress || null,
      address_line1:        propData.addressLine1 || address,
      city:                 propData.city || city || null,
      state:                propData.state || state || null,
      zip:                  propData.zipCode || zip || null,
      county_fips:          null, // populated downstream from FCC block lookup
      lat:                  propData.latitude,
      lng:                  propData.longitude,
      property_type:        propData.propertyType || propertyType || null,
      beds:                 propData.bedrooms,
      baths:                propData.bathrooms,
      sqft:                 propData.squareFootage,
      lot_sqft:             propData.lotSize,
      year_built:           propData.yearBuilt,
      legal_description:    propData.legalDescription || null,
      owner_occupied:       propData.ownerOccupied ?? null,
      // Valuation
      rentcast_value:       avm?.data?.price || null,
      rentcast_value_low:   avm?.data?.priceRangeLow || null,
      rentcast_value_high:  avm?.data?.priceRangeHigh || null,
      rentcast_value_conf:  avm?.data?.confidence || null,
      // Rental
      rentcast_rent_est:    rent?.data?.rent || null,
      rentcast_rent_low:    rent?.data?.rentRangeLow || null,
      rentcast_rent_high:   rent?.data?.rentRangeHigh || null,
      rentcast_rent_conf:   rent?.data?.confidence || null,
      rentcast_cap_rate:    capRate,
      rentcast_gross_yield: grossYield,
      // Market
      market_median_price:  market?.data?.medianSalePrice || null,
      market_median_rent:   market?.data?.medianRent || null,
      market_vacancy_rate:  market?.data?.vacancyRate || null,
      market_avg_dom:       market?.data?.avgDaysOnMarket || null,
      market_rent_yoy:      market?.data?.rentYoY || null,
      market_price_yoy:     market?.data?.priceYoY || null,
      // Tax
      tax_assessment_year:  propData.taxAssessmentYear || null,
      tax_assessed_value:   propData.taxAssessedValue || null,
      tax_annual_amount:    propData.taxAnnualAmount || null,
      // Comps summary
      rental_comps_count:   rentalComps?.data?.count || 0,
      sale_comps_count:     saleComps?.data?.count || 0,
      sale_comps_avg_price: saleComps?.data?.avgPrice || null,
      sale_history_count:   (propData.saleHistory || []).length,
      rentcast_fetched_at:  now,
      last_updated:         now,
    };

    db.upsert("property_master", masterRow, "apn")
      .catch(e => console.warn("[rentcast-enrich:pm upsert]", e.message));

    // Append sale history events to property_history
    for (const sale of (propData.saleHistory || [])) {
      if (sale.date && sale.price) {
        await appendHistory(apn, "sale", sale.date, { price: sale.price, event: sale.event, listingId: sale.listingId }, "rentcast");
      }
    }

    // Append latest tax assessment to property_history
    if (propData.taxAssessmentYear) {
      await appendHistory(apn, "assessment", `${propData.taxAssessmentYear}-01-01`, {
        year:           propData.taxAssessmentYear,
        assessedValue:  propData.taxAssessedValue,
        annualTax:      propData.taxAnnualAmount,
      }, "rentcast");
    }

    // Append enrichment snapshot
    await appendHistory(apn, "enrichment", now.slice(0, 10), {
      avm:         { price: avmValue, low: avm?.data?.priceRangeLow, high: avm?.data?.priceRangeHigh },
      rent:        { est: rentEst, low: rent?.data?.rentRangeLow, high: rent?.data?.rentRangeHigh },
      market:      market?.status === "success" ? { median: market.data.medianSalePrice, vacRate: market.data.vacancyRate } : null,
      rentalComps: rentalComps?.data?.count || 0,
      saleComps:   saleComps?.data?.count || 0,
    }, "rentcast");
  }

  // ── Update property_intelligence if we have an address match ──────────────
  // (best-effort — property may not be in DB yet if ingest hasn't run)
  const piUpdate = {
    ...(apn          ? { apn }                                        : {}),
    ...(rentcastId   ? { rentcast_property_id: rentcastId }           : {}),
    ...(avm?.data?.priceRangeLow   ? { rentcast_value_low:  avm.data.priceRangeLow }  : {}),
    ...(avm?.data?.priceRangeHigh  ? { rentcast_value_high: avm.data.priceRangeHigh } : {}),
    ...(avm?.data?.confidence      ? { rentcast_value_conf: avm.data.confidence }      : {}),
    ...(rent?.data?.rent           ? { rentcast_rent_estimate: rent.data.rent }        : {}),
    ...(rent?.data?.rentRangeLow   ? { rentcast_rent_low:  rent.data.rentRangeLow }   : {}),
    ...(rent?.data?.rentRangeHigh  ? { rentcast_rent_high: rent.data.rentRangeHigh }  : {}),
    ...(rent?.data?.confidence     ? { rentcast_rent_conf: rent.data.confidence }      : {}),
    ...(capRate !== null           ? { rentcast_cap_rate: capRate, rentcast_gross_yield: grossYield } : {}),
    ...(market?.data?.vacancyRate  ? { rentcast_vacancy_rate: market.data.vacancyRate } : {}),
    ...(rentalComps?.data?.count   ? { rental_comps_count: rentalComps.data.count, rental_comps_avg_rent: rentalComps.data.avgRent } : {}),
    ...(saleComps?.data?.count     ? { sale_comps_count: saleComps.data.count, sale_comps_avg_price: saleComps.data.avgPrice }       : {}),
    ...(propData.saleHistory       ? { sale_history_count: propData.saleHistory.length }  : {}),
    ...(propData.taxAssessedValue  ? { tax_assessed_value: propData.taxAssessedValue }     : {}),
    ...(propData.taxAnnualAmount   ? { tax_annual_amount: propData.taxAnnualAmount }       : {}),
    ...(propData.legalDescription  ? { legal_description: propData.legalDescription }     : {}),
    ...(market?.data?.rentYoY      ? { market_rent_yoy: market.data.rentYoY }             : {}),
    ...(market?.data?.priceYoY     ? { market_price_yoy: market.data.priceYoY }           : {}),
  };

  if (Object.keys(piUpdate).length > 0) {
    // Try to update by address (property_intelligence doesn't have apn yet in all rows)
    db.from("property_intelligence")
      .eq("address_hash", require("crypto").createHash("md5").update(
        [address, null, city, state, zip].map(s => (s || "").toLowerCase().trim().replace(/\s+/g, " ")).join("|")
      ).digest("hex"))
      .update(piUpdate)
      .catch(() => {});
  }

  return {
    status: "success",
    apn,
    rentcastId,
    sources: {
      property:     prop?.status,
      avm:          avm?.status,
      rentEstimate: rent?.status,
      rentalComps:  rentalComps?.status,
      saleComps:    saleComps?.status,
      market:       market?.status,
    },
    summary: {
      avmValue,
      avmLow:         avm?.data?.priceRangeLow || null,
      avmHigh:        avm?.data?.priceRangeHigh || null,
      rentEst,
      rentLow:        rent?.data?.rentRangeLow || null,
      rentHigh:       rent?.data?.rentRangeHigh || null,
      capRate,
      vacancyRate:    market?.data?.vacancyRate || null,
      rentalComps:    rentalComps?.data?.count || 0,
      saleComps:      saleComps?.data?.count || 0,
      saleHistoryLen: (propData.saleHistory || []).length,
      beds:           propData.bedrooms,
      baths:          propData.bathrooms,
      sqft:           propData.squareFootage,
      yearBuilt:      propData.yearBuilt,
    },
  };
}

// ── HTTP handler ──────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const internalKey = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (process.env.INTERNAL_API_KEY && internalKey !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { address, city, state, zip, reportId, beds, baths, sqft, propertyType } = body;
  if (!address) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "address required" }) };
  }

  try {
    const result = await rentcastEnrich({ address, city, state, zip, reportId, beds, baths, sqft, propertyType });
    return { statusCode: 200, headers: CORS, body: JSON.stringify(result) };
  } catch (err) {
    console.error("[rentcast-enrich]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

exports.rentcastEnrich = rentcastEnrich;
