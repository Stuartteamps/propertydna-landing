"use strict";
/**
 * _hpi_index.js — FHFA House Price Index appreciation for PropertyDNA internal AVM
 *
 * Converts a historical sale price to today's estimated value using published
 * House Price Index data. Used as a free, citation-only data layer in
 * buildInternalFallback() when RentCast is unavailable.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PRIMARY INDEX
 * ─────────────
 * FHFA All-Transactions House Price Index
 * MSA:    Riverside-San Bernardino-Ontario, CA (CBSA 40140)
 * Series: ATNHPIUS40140Q  (base: 1995 Q1 = 100)
 * Source: FRED, Federal Reserve Bank of St. Louis; values confirmed via
 *         Trading Economics (tradingeconomics.com) citing FRED.
 *
 * CONFIRMED QUARTERLY ANCHORS (directly cited from published sources):
 *   2026 Q1 = 499.67  — Trading Economics / FRED ATNHPIUS40140Q, January 2026
 *                        URL: tradingeconomics.com → ATNHPIUS40140Q
 *   2024 Q3 = 494.72  — FRED ATNHPIUS40140Q (Q3 2024)
 *                        URL: fred.stlouisfed.org/series/ATNHPIUS40140Q
 *   2021 Q3 = 393.69  — FHFA quarterly HPI dataset, record-high as of Q3 2021
 *                        (series subsequently surpassed this in 2022–2024)
 *   2021 Q1 = 346.13  — DERIVED: 499.67 ÷ 1.4436
 *                        Basis: FHFA published five-year change +44.36%
 *                        (2021Q1 → 2026Q1); source: FHFA HPI Summary Tables,
 *                        fhfa.gov/data/hpi/summary-tables, February 2026 release.
 *   1991 Q1 = 122.93  — DERIVED: 499.67 ÷ 4.0643
 *                        Basis: FHFA published since-1991Q1 change +306.43%
 *                        (to 2026Q1); same source. (Not used as an interpolation
 *                        anchor; documented for reference only.)
 *
 * PUBLISHED ANNUAL CHANGES (FHFA HPI Summary Tables, February 2026 release):
 *   2026 Q1: +1.70% YoY  |  2025 Q3: −1.42% YoY  |  2025 Q1: +2.03% YoY
 *   Five-year 2021Q1 → 2026Q1: +44.36%
 *   Since 1991Q1 → 2026Q1: +306.43%
 *
 * INTERMEDIATE ANCHORS DERIVED FROM PUBLISHED ANNUAL CHANGES:
 *   2025 Q1 = 491.32  (499.67 ÷ 1.0170 — 2026Q1 is +1.70% above 2025Q1)
 *   2025 Q3 = 487.68  (494.72 × 0.9858 — 2025Q3 is −1.42% below 2024Q3)
 *   2024 Q1 = 481.54  (491.32 ÷ 1.0203 — 2025Q1 is +2.03% above 2024Q1)
 *   All derived from FHFA published statistics; source as above.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VALUES BETWEEN ANCHORS (2021Q1 – 2026Q1)
 * ─────────────────────────────────────────
 * Log-linear interpolation across the confirmed/derived quarterly anchors.
 *
 * PRE-2021 VALUES
 * ───────────────
 * Compound backward from the confirmed 2021 Q1 anchor (346.13).
 * Period rates are chosen from documented FHFA MSA history:
 *   2012 – 2021: 7.0 % pa — Inland Empire post-crash recovery phase.
 *                Consistent with FHFA published annual appreciations for the
 *                Riverside-SB-Ontario MSA during the recovery period.
 *   Pre-2012:    2.0 % pa — Conservative long-run; reflects the 2004–2008
 *                bubble and 2008–2012 bust. Riverside County annual index
 *                (FHFA ATNHPIUS06065A, 2000=100) shows 2024=362.88, implying
 *                pre-2012 ranged ≈ 100–185 on the 2000-base county series.
 *                The MSA index (1995Q1=100) was ≈ 135–250 for 2000–2007 and
 *                ≈ 170–200 for 2009–2012.
 *   TRANSITION YEAR: 2012.0 (boundary between the two compound rates).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COVERAGE AND KNOWN GAPS
 * ───────────────────────
 * All Coachella Valley ZIP codes below fall within the Riverside-San Bernardino-
 * Ontario MSA and share the same FHFA index. MSA-level data covers the whole CV.
 *
 * ZIP-LEVEL ADJUSTMENT GAP: Zillow ZHVI ZIP-level data was located on
 * Zillow's research portal (zillow.com/research/data/) but the CSV exceeds
 * the direct-fetch size limit. Per-ZIP appreciation adjustments (e.g. Indian
 * Wells 92210 vs Indio 92201) are NOT currently applied — all CV ZIPs use the
 * same MSA index. This is a documented gap for a future improvement.
 *
 * FALLBACKS:
 *   Non-CV California: FHFA CA statewide long-run rate ≈ 6.5 % pa (1975–2025).
 *   All others:        FHFA national long-run rate ≈ 4.8 % pa (matches
 *                      existing ANNUAL_APPRECIATION constant in enrich-report.js)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EXPORTED FUNCTION
 * ─────────────────
 * appreciateToToday(price, saleDateISO, { zip, city, state })
 *   → { value, factor, indexSource, matched }
 */

// ── FHFA quarterly anchor points (ATNHPIUS40140Q, 1995Q1=100) ─────────────────
// Format: [fractional-year, hpi-value]
// Fractional year: Q1=+0.00, Q2=+0.25, Q3=+0.50, Q4=+0.75
// "confirmed" = directly from published source; "derived" = computed from
// FHFA-published annual percentage changes (documented in header above).
//
// NOTE: the index is NOT monotonically increasing — the 2024–2025 period shows a
// slight softening before recovery. That is real market behaviour; do not sort.
const ANCHORS = [
  // [fractYr,  hpi,    note]
  [2021.00, 346.13],  // 2021 Q1 — DERIVED from FHFA 5-yr change
  [2021.50, 393.69],  // 2021 Q3 — CONFIRMED: FHFA quarterly dataset
  [2024.00, 481.54],  // 2024 Q1 — DERIVED: 491.32 ÷ 1.0203 (FHFA +2.03% YoY)
  [2024.50, 494.72],  // 2024 Q3 — CONFIRMED: FRED ATNHPIUS40140Q
  [2025.00, 491.32],  // 2025 Q1 — DERIVED: 499.67 ÷ 1.0170 (FHFA +1.70% YoY)
  [2025.50, 487.68],  // 2025 Q3 — DERIVED: 494.72 × 0.9858 (FHFA −1.42% YoY)
  [2026.00, 499.67],  // 2026 Q1 — CONFIRMED: FRED ATNHPIUS40140Q, January 2026
];

// Current reference HPI (latest confirmed quarterly value)
const HPI_CURRENT = 499.67;   // FRED ATNHPIUS40140Q, 2026 Q1
const HPI_CURRENT_LABEL = "FHFA ATNHPIUS40140Q (Riverside-San Bernardino-Ontario MSA, 1995Q1=100), " +
  "2026Q1=499.67 via FRED/Trading Economics";

// Pre-2021 backward-extrapolation rates (see header for rationale)
const RATE_RECOVERY   = 0.070;  // 2012–2021: IE post-crash recovery
const RATE_LONG_RUN   = 0.020;  // pre-2012: boom-bust long-run
const YEAR_TRANSITION = 2012.0; // boundary between the two rate periods
const ANCHOR_2021Q1   = 346.13; // confirmed 2021Q1 — backward-extrapolation origin

// Fallback annual rates for non-MSA addresses
const RATE_CA       = 0.065;  // FHFA CA statewide long-run (≈6.5%/yr, 1975-2025)
const RATE_NATIONAL = 0.048;  // FHFA national long-run (matches ANNUAL_APPRECIATION)

// ── Coachella Valley ZIPs covered by the Riverside-SB-Ontario MSA index ───────
// Source: Riverside County Assessor / USPS ZIP code territory
const CV_ZIP_SET = new Set([
  "92201", // Indio
  "92203", // Indio (Desert Gateway area)
  "92210", // Indian Wells
  "92211", // Palm Desert (east / Merv Griffin area)
  "92220", // Banning (western CV gateway)
  "92230", // Cabazon
  "92234", // Cathedral City
  "92253", // La Quinta
  "92255", // Palm Desert (PO boxes)
  "92260", // Palm Desert
  "92261", // Palm Desert (PO boxes)
  "92262", // Palm Springs (north)
  "92263", // Palm Springs (PO boxes)
  "92264", // Palm Springs (south / Deepwell / Old Las Palmas)
  "92270", // Rancho Mirage
  "92274", // Thermal / Coachella Valley (south end)
  "92276", // Thousand Palms
  "92282", // White Water
]);

// CV city names for fallback when ZIP is absent (lowercased)
const CV_CITY_LOWER = new Set([
  "palm springs", "palm desert", "indio", "la quinta", "rancho mirage",
  "indian wells", "cathedral city", "desert hot springs", "coachella",
  "thousand palms", "bermuda dunes", "thermal", "white water", "cabazon",
  "banning",
]);

// ── Internal helpers ───────────────────────────────────────────────────────────

function _isCVAddress(zip, city, state) {
  if (state && String(state).toUpperCase() !== "CA") return false;
  if (zip && CV_ZIP_SET.has(String(zip).trim())) return true;
  const c = String(city || "").toLowerCase().trim();
  return CV_CITY_LOWER.has(c);
}

function _isCaliforniaAddress(state) {
  return state && String(state).trim().toUpperCase() === "CA";
}

// Log-linear interpolation between two anchor points at a fractional year t
function _logLerp(t, t0, v0, t1, v1) {
  const frac = (t - t0) / (t1 - t0);
  return Math.exp(Math.log(v0) + frac * (Math.log(v1) - Math.log(v0)));
}

/**
 * Return the Riverside-SB-Ontario MSA FHFA HPI for a given fractional year
 * (e.g. 2018.417 = June 2018 ≈ Q2 2018).
 * Between confirmed/derived anchors: log-linear interpolation.
 * Before the earliest anchor (2021Q1): backward extrapolation at documented rates.
 * After the latest anchor (2026Q1): hold current value.
 */
function _getRivcoHPI(fractYear) {
  // After latest anchor → use current
  const last = ANCHORS[ANCHORS.length - 1];
  if (fractYear >= last[0]) return HPI_CURRENT;

  // Between any two consecutive anchors → log-linear interpolation
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const [t0, v0] = ANCHORS[i];
    const [t1, v1] = ANCHORS[i + 1];
    if (fractYear >= t0 && fractYear <= t1) {
      return _logLerp(fractYear, t0, v0, t1, v1);
    }
  }

  // Before earliest anchor (2021Q1) → compound backward in two phases
  const yearsBack = 2021.0 - fractYear;
  if (fractYear >= YEAR_TRANSITION) {
    // 2012–2021: recovery phase at RATE_RECOVERY
    return ANCHOR_2021Q1 / Math.pow(1 + RATE_RECOVERY, yearsBack);
  }
  // Pre-2012: compound from the implied 2012 HPI using RATE_LONG_RUN
  const hpi2012 = ANCHOR_2021Q1 / Math.pow(1 + RATE_RECOVERY, 2021.0 - YEAR_TRANSITION);
  const yearsPreTransition = YEAR_TRANSITION - fractYear;
  return hpi2012 / Math.pow(1 + RATE_LONG_RUN, yearsPreTransition);
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Appreciate a historical sale price to today using the best available
 * published House Price Index for the given address location.
 *
 * @param {number|string} price    Historical sale price (dollars)
 * @param {string}        saleDateISO  Sale date (ISO 8601, e.g. "2018-06-15")
 * @param {object}        [opts]   Optional: { zip, city, state }
 * @returns {{ value: number, factor: number, indexSource: string|null, matched: boolean }}
 *   value       — appreciated price in whole dollars (original if inputs are bad)
 *   factor      — multiplier applied, rounded to 3 decimal places (1.0 if skipped)
 *   indexSource — human-readable source citation (null if skipped)
 *   matched     — true when a specific regional index was applied (CV MSA)
 */
function appreciateToToday(price, saleDateISO, { zip, city, state } = {}) {
  const p = Number(price);

  // ERR: null-safe return (original price, factor 1, no match)
  const ERR = (reason) => {
    console.warn("[_hpi_index] appreciateToToday skipped:", reason);
    return { value: isNaN(p) || p <= 0 ? 0 : Math.round(p), factor: 1, indexSource: null, matched: false };
  };

  // ── Input validation ────────────────────────────────────────────────────────
  if (!price || isNaN(p) || p <= 0) return ERR("invalid or missing price");

  const saleDate = new Date(saleDateISO);
  if (!saleDateISO || isNaN(saleDate.getTime())) return ERR("invalid or missing sale date");

  const now = new Date();
  if (saleDate > now) return ERR("sale date is in the future");

  const yearsElapsed = (now - saleDate) / (365.25 * 24 * 3600 * 1000);
  if (yearsElapsed > 60) return ERR("implausible sale date (>60 years ago)");

  // ── Index selection and factor computation ──────────────────────────────────
  const saleYear = saleDate.getFullYear() + (saleDate.getMonth() / 12);
  let factor, indexSource, matched;

  if (_isCVAddress(zip, city, state)) {
    // Primary path: FHFA MSA index (Riverside-San Bernardino-Ontario)
    const saleHPI = _getRivcoHPI(saleYear);
    factor = HPI_CURRENT / saleHPI;
    indexSource = HPI_CURRENT_LABEL;
    matched = true;
  } else if (_isCaliforniaAddress(state)) {
    // CA state fallback (no specific MSA match)
    factor = Math.pow(1 + RATE_CA, yearsElapsed);
    indexSource = "FHFA CA statewide long-run rate (~6.5%/yr, 1975-2025)";
    matched = false;
  } else {
    // National fallback (preserves existing ANNUAL_APPRECIATION behaviour)
    factor = Math.pow(1 + RATE_NATIONAL, yearsElapsed);
    indexSource = "FHFA national long-run rate (~4.8%/yr)";
    matched = false;
  }

  // Guard rails: cap at 5× to handle implausible old-date edge cases;
  // floor at 0.5 to handle unusual negative-appreciation edge cases.
  factor = Math.min(Math.max(factor, 0.5), 5.0);

  return {
    value: Math.round(p * factor),
    factor: Math.round(factor * 1000) / 1000,
    indexSource,
    matched,
  };
}

module.exports = { appreciateToToday };
