// ─────────────────────────────────────────────────────────────────────────────
// get-value-series — REAL value/index time-series + moving averages + market
// ticker momentum for a geo (zip / city), powering the Fidelity-style charts.
//
// Data layers (best → fallback), each degrades gracefully and NEVER throws:
//   1. market_ticker      — daily OHLC per geo_key (ideal; empty today)
//   2. properties         — real transactions: last_sale_price / last_sale_date
//                           per zip (e.g. 513 sales in 92262, 2013–2025)
//   3. property_history    — 9.5M assessment rows; data->>totalValue grouped by
//                           data->>reassessYear (real assessed-value-by-vintage)
//   4. market_snapshots   — median_price by snapshot_date (mostly null today)
//
// Moving averages are COMPUTED here from the resulting monthly series via
// trailing date-windowed simple moving averages (default 90-day + 365-day).
//
// Ticker momentum = ZIP vs City vs Metro (zip3) median-price % change, the
// real-estate analog of DJIA / NASDAQ / S&P.
//
// If no real data is found we return { ok:true, source:'empty', series:[] } so
// the client falls back to its calculated series — the UI never breaks.
// ─────────────────────────────────────────────────────────────────────────────

const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const SUPA_URL =
  process.env.SUPABASE_URL || 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const SUPA_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_KEY ||
  '';

/** Zero-dep Supabase REST GET. Returns [] on any error (never throws). */
function sbGet(pathAndQuery) {
  return new Promise((resolve) => {
    if (!SUPA_KEY) return resolve([]);
    const url = new URL(SUPA_URL + '/rest/v1/' + pathAndQuery);
    https
      .get(
        {
          hostname: url.hostname,
          path: url.pathname + url.search,
          headers: {
            apikey: SUPA_KEY,
            Authorization: `Bearer ${SUPA_KEY}`,
            Accept: 'application/json',
          },
          timeout: 8000,
        },
        (res) => {
          let raw = '';
          res.on('data', (d) => (raw += d));
          res.on('end', () => {
            try {
              const j = JSON.parse(raw);
              resolve(Array.isArray(j) ? j : []);
            } catch {
              resolve([]);
            }
          });
        },
      )
      .on('error', () => resolve([]))
      .on('timeout', function () {
        this.destroy();
        resolve([]);
      });
  });
}

// ── math helpers ────────────────────────────────────────────────────────────

function median(nums) {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = 86400000;

/** YYYY-MM key for a Date. */
function monthKey(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Build a robust MONTHLY index from raw transaction {date, value} observations
 * via a TRAILING ROLLING MEDIAN. For each month step we take the median of every
 * sale within a trailing window (widening from `windowDays` up to 2y until it has
 * >= 3 sales). This is the standard construction for a real-estate price index:
 * it de-noises thin single-sale months while staying 100% real. Returns ordered
 * [{ t, value, date }].
 */
function buildRollingSeries(obs, windowDays = 180) {
  const clean = obs
    .map((o) => ({ d: new Date(o.date), v: Number(o.value) }))
    .filter((o) => o.d instanceof Date && !isNaN(o.d) && Number.isFinite(o.v) && o.v > 0)
    .sort((a, b) => a.d - b.d);
  if (clean.length < 4) return [];

  const start = new Date(Date.UTC(clean[0].d.getUTCFullYear(), clean[0].d.getUTCMonth(), 1));
  const last = clean[clean.length - 1].d;
  const end = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1));
  const totalMonths = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());

  const out = [];
  let carry = null;
  for (let i = 0; i <= totalMonths; i++) {
    const dt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    // Window END = end of this month; widen the lookback until >= 3 sales (cap 2y).
    const winEnd = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0);
    let val = null;
    for (let w = windowDays; w <= 730; w += 120) {
      const lo = winEnd - w * DAY;
      const vals = clean.filter((o) => o.d.getTime() >= lo && o.d.getTime() <= winEnd).map((o) => o.v);
      if (vals.length >= 3) {
        val = median(vals);
        break;
      }
    }
    if (val == null) val = carry; // early months before enough data — carry forward
    if (val == null) continue;
    carry = val;
    out.push({
      t: `${MONTHS[dt.getUTCMonth()]} '${String(dt.getUTCFullYear()).slice(2)}`,
      value: Math.round(val),
      date: dt.toISOString(),
    });
  }
  const MAX = 120;
  return out.length > MAX ? out.slice(out.length - MAX) : out;
}

/**
 * Build a gap-filled MONTHLY median series from PRE-AGGREGATED anchors (e.g.
 * annual assessment medians). Empty months are linearly interpolated between
 * anchors so the line + moving averages stay smooth. Returns ordered
 * [{ t, value, date }] (ISO date at month start).
 */
function buildMonthlySeries(obs) {
  const clean = obs
    .map((o) => ({ d: new Date(o.date), v: Number(o.value) }))
    .filter((o) => o.d instanceof Date && !isNaN(o.d) && Number.isFinite(o.v) && o.v > 0)
    .sort((a, b) => a.d - b.d);
  if (clean.length < 2) return [];

  // Median per month.
  const byMonth = new Map();
  for (const o of clean) {
    const k = monthKey(o.d);
    (byMonth.get(k) || byMonth.set(k, []).get(k)).push(o.v);
  }
  const anchors = []; // { idx, value } where idx = month offset from start
  const start = new Date(Date.UTC(clean[0].d.getUTCFullYear(), clean[0].d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(clean[clean.length - 1].d.getUTCFullYear(), clean[clean.length - 1].d.getUTCMonth(), 1));
  const totalMonths = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());

  for (let i = 0; i <= totalMonths; i++) {
    const dt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const vals = byMonth.get(monthKey(dt));
    if (vals && vals.length) anchors.push({ idx: i, value: median(vals) });
  }
  if (anchors.length < 2) return [];

  // Cap excessive spans so the chart stays readable (keep most-recent ~120 months).
  const MAX_MONTHS = 120;
  const series = [];
  for (let i = 0; i <= totalMonths; i++) {
    // Linear-interpolate between surrounding anchors.
    let value;
    const exact = anchors.find((a) => a.idx === i);
    if (exact) {
      value = exact.value;
    } else {
      let lo = null;
      let hi = null;
      for (const a of anchors) {
        if (a.idx <= i) lo = a;
        if (a.idx >= i && hi === null) hi = a;
      }
      if (lo && hi && hi.idx !== lo.idx) {
        const f = (i - lo.idx) / (hi.idx - lo.idx);
        value = lo.value + (hi.value - lo.value) * f;
      } else {
        value = (lo || hi).value;
      }
    }
    const dt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    series.push({
      t: `${MONTHS[dt.getUTCMonth()]} '${String(dt.getUTCFullYear()).slice(2)}`,
      value: Math.round(value),
      date: dt.toISOString(),
    });
  }
  return series.length > MAX_MONTHS ? series.slice(series.length - MAX_MONTHS) : series;
}

/**
 * Trailing date-windowed Simple Moving Average over an ordered series.
 * For each point, averages every point whose date is within `windowDays` back.
 */
function movingAverage(series, windowDays) {
  return series.map((p, i) => {
    const cut = new Date(p.date).getTime() - windowDays * DAY;
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0; j--) {
      if (new Date(series[j].date).getTime() < cut) break;
      sum += series[j].value;
      n++;
    }
    return { t: p.t, value: n ? Math.round(sum / n) : p.value, date: p.date };
  });
}

/** % change between first and last series points. */
function seriesChangePct(series) {
  if (series.length < 2) return 0;
  const a = series[0].value;
  const b = series[series.length - 1].value;
  return a > 0 ? Math.round(((b - a) / a) * 1000) / 10 : 0;
}

/** Most-recent vs prior-period median % change — used for ticker momentum. */
function momentumPct(obs) {
  const clean = obs
    .map((o) => ({ d: new Date(o.date).getTime(), v: Number(o.value) }))
    .filter((o) => Number.isFinite(o.d) && Number.isFinite(o.v) && o.v > 0)
    .sort((a, b) => a.d - b.d);
  if (clean.length < 4) return { value: clean.length ? median(clean.map((c) => c.v)) : null, changePct: 0 };
  const mid = Math.floor(clean.length / 2);
  const older = median(clean.slice(0, mid).map((c) => c.v));
  const recent = median(clean.slice(mid).map((c) => c.v));
  const changePct = older > 0 ? Math.round(((recent - older) / older) * 1000) / 10 : 0;
  return { value: Math.round(recent), changePct };
}

// ── data fetchers ───────────────────────────────────────────────────────────

/** Real transactions for a zip → [{ date, value, ppsf }]. */
async function fetchSales({ zip, city }) {
  const cols = 'last_sale_price,last_sale_date,sqft';
  let rows = [];
  if (zip) {
    rows = await sbGet(
      `properties?select=${cols}&zip=eq.${encodeURIComponent(zip)}` +
        `&last_sale_price=not.is.null&last_sale_date=not.is.null&order=last_sale_date.asc&limit=2000`,
    );
  }
  if ((!rows || rows.length < 8) && city) {
    const cityRows = await sbGet(
      `properties?select=${cols}&city=eq.${encodeURIComponent(city)}` +
        `&last_sale_price=not.is.null&last_sale_date=not.is.null&order=last_sale_date.asc&limit=2000`,
    );
    if (cityRows.length > rows.length) rows = cityRows;
  }
  return rows.map((r) => ({
    date: r.last_sale_date,
    value: Number(r.last_sale_price),
    ppsf: r.sqft > 0 ? Number(r.last_sale_price) / Number(r.sqft) : null,
  }));
}

/**
 * Assessment fallback: median assessed totalValue by reassessYear for a zip.
 * Real, large-sample value-by-vintage signal from the 9.5M-row property_history.
 */
async function fetchAssessmentSeries(zip) {
  if (!zip) return [];
  const rows = await sbGet(
    `property_history?select=data->>totalValue,data->>reassessYear` +
      `&data->>postalCode=eq.${encodeURIComponent(zip)}&event_type=eq.assessment&limit=4000`,
  );
  // Group by reassessYear → median totalValue.
  const byYear = new Map();
  for (const r of rows) {
    const yr = parseInt(r.reassessYear, 10);
    const val = parseFloat(r.totalValue);
    if (yr > 1990 && yr <= new Date().getUTCFullYear() && val > 1000) {
      (byYear.get(yr) || byYear.set(yr, []).get(yr)).push(val);
    }
  }
  return [...byYear.entries()]
    .map(([yr, vals]) => ({ date: `${yr}-07-01T00:00:00Z`, value: median(vals) }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/** market_ticker (ideal real OHLC) → observations. Empty today; future-proof. */
async function fetchTicker(zip) {
  if (!zip) return [];
  const rows = await sbGet(
    `market_ticker?select=tick_date,close_price,median_sqft_price` +
      `&geo_key=eq.${encodeURIComponent(zip)}&order=tick_date.asc&limit=2000`,
  );
  return rows
    .filter((r) => r.close_price > 0)
    .map((r) => ({ date: r.tick_date, value: Number(r.close_price) }));
}

// ── handler ─────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  const p = event.queryStringParameters || {};
  const zip = (p.zip || p.geo || '').trim();
  const city = (p.city || '').trim();
  const state = (p.state || '').trim();
  const shortWin = Math.max(7, parseInt(p.shortWindowDays || '90', 10));
  const longWin = Math.max(shortWin + 30, parseInt(p.longWindowDays || '365', 10));

  const empty = {
    ok: true,
    source: 'empty',
    geo_key: zip || city || null,
    geo_type: zip ? 'zip' : 'city',
    city,
    state,
    series: [],
    baseline: null,
    movingAverages: { short: null, long: null },
    changePct: 0,
    ticker: [],
    sampleSize: 0,
  };

  try {
    // Prefer real ticker, then real sales, then assessments.
    const [ticker, sales] = await Promise.all([fetchTicker(zip), fetchSales({ zip, city })]);

    let source = '';
    let obs = [];
    if (ticker.length >= 8) {
      obs = ticker;
      source = 'market_ticker';
    } else if (sales.length >= 8) {
      obs = sales;
      source = 'sales';
    } else {
      const assess = await fetchAssessmentSeries(zip);
      if (assess.length >= 3) {
        obs = assess;
        source = 'assessments';
      } else if (sales.length >= 2) {
        obs = sales;
        source = 'sales';
      }
    }

    if (!obs.length) return { statusCode: 200, headers: CORS, body: JSON.stringify(empty) };

    // Raw transactions (sales / daily ticker) → rolling-median index.
    // Pre-aggregated annual anchors (assessments) → interpolated monthly line.
    const series = source === 'assessments' ? buildMonthlySeries(obs) : buildRollingSeries(obs);
    if (series.length < 2) return { statusCode: 200, headers: CORS, body: JSON.stringify(empty) };

    const maShort = movingAverage(series, shortWin);
    const maLong = movingAverage(series, longWin);

    // Ticker momentum: ZIP vs City vs Metro (zip3). Each from its own real sales.
    const tickerStrip = [];
    const zipMom = momentumPct(sales.length ? sales : obs);
    if (zip) {
      tickerStrip.push({
        key: zip,
        label: `ZIP ${zip}`,
        value: zipMom.value,
        changePct: zipMom.changePct,
        dir: zipMom.changePct > 0.15 ? 'up' : zipMom.changePct < -0.15 ? 'down' : 'flat',
      });
    }
    if (city) {
      const cityRows = await sbGet(
        `properties?select=last_sale_price,last_sale_date&city=eq.${encodeURIComponent(city)}` +
          `&last_sale_price=not.is.null&last_sale_date=not.is.null&order=last_sale_date.asc&limit=2000`,
      );
      const cityMom = momentumPct(cityRows.map((r) => ({ date: r.last_sale_date, value: Number(r.last_sale_price) })));
      if (cityMom.value) {
        tickerStrip.push({
          key: city.toLowerCase().replace(/\s+/g, '-'),
          label: city,
          value: cityMom.value,
          changePct: cityMom.changePct,
          dir: cityMom.changePct > 0.15 ? 'up' : cityMom.changePct < -0.15 ? 'down' : 'flat',
        });
      }
    }
    if (zip && zip.length >= 3) {
      const zip3 = zip.slice(0, 3);
      const metroRows = await sbGet(
        `properties?select=last_sale_price,last_sale_date&zip=like.${zip3}*` +
          `&last_sale_price=not.is.null&last_sale_date=not.is.null&order=last_sale_date.asc&limit=2000`,
      );
      const metroMom = momentumPct(metroRows.map((r) => ({ date: r.last_sale_date, value: Number(r.last_sale_price) })));
      if (metroMom.value) {
        tickerStrip.push({
          key: `metro-${zip3}`,
          label: `Metro ${zip3}xx`,
          value: metroMom.value,
          changePct: metroMom.changePct,
          dir: metroMom.changePct > 0.15 ? 'up' : metroMom.changePct < -0.15 ? 'down' : 'flat',
        });
      }
    }

    const body = {
      ok: true,
      source,
      geo_key: zip || city || null,
      geo_type: zip ? 'zip' : 'city',
      city,
      state,
      sampleSize: obs.length,
      baseline: series[0].value,
      changePct: seriesChangePct(series),
      series,
      movingAverages: {
        short: { windowDays: shortWin, label: maLabel(shortWin), points: maShort },
        long: { windowDays: longWin, label: maLabel(longWin), points: maLong },
      },
      ticker: tickerStrip,
    };

    return { statusCode: 200, headers: CORS, body: JSON.stringify(body) };
  } catch (err) {
    // Never crash the UI — return the empty shape on any unexpected failure.
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ...empty, source: 'error', error: String(err && err.message) }),
    };
  }
};

function maLabel(days) {
  if (days >= 360) return `${Math.round(days / 365)}-Year Avg`;
  if (days >= 28) return `${Math.round(days / 30)}-Month Avg`;
  return `${days}-Day Avg`;
}
