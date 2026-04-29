/**
 * Minimal Supabase REST client for Netlify functions.
 * Uses native Node https — zero dependencies.
 */
const https = require("https");

const SUPA_URL = process.env.SUPABASE_URL || "https://neccpdfhmfnvyjgyrysy.supabase.co";
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

function _req(method, path, body, key, extraHeaders = {}) {
  const url = new URL(SUPA_URL + path);
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers: {
          apikey: key || SUPA_KEY,
          Authorization: `Bearer ${key || SUPA_KEY}`,
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          ...extraHeaders,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          let data;
          try { data = raw ? JSON.parse(raw) : null; } catch { data = { _raw: raw }; }
          if (res.statusCode >= 400) {
            reject(Object.assign(new Error(`Supabase ${res.statusCode}: ${raw.slice(0, 200)}`), { status: res.statusCode, data }));
          } else {
            resolve(data);
          }
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const db = {
  /** Chainable query builder */
  from(table) {
    return {
      _table: table,
      _filters: [],
      _select: "*",
      _order: null,
      _limit: null,

      select(cols) { this._select = cols; return this; },
      eq(col, val) { this._filters.push(`${col}=eq.${encodeURIComponent(val)}`); return this; },
      neq(col, val) { this._filters.push(`${col}=neq.${encodeURIComponent(val)}`); return this; },
      in(col, vals) { this._filters.push(`${col}=in.(${vals.map(encodeURIComponent).join(",")})`); return this; },
      order(col, { ascending = true } = {}) { this._order = `${col}.${ascending ? "asc" : "desc"}`; return this; },
      limit(n) { this._limit = n; return this; },

      async get() {
        let qs = `select=${encodeURIComponent(this._select)}`;
        for (const f of this._filters) qs += `&${f}`;
        if (this._order) qs += `&order=${this._order}`;
        if (this._limit) qs += `&limit=${this._limit}`;
        return _req("GET", `/rest/v1/${this._table}?${qs}`, null, null, {});
      },

      async insert(row) {
        return _req("POST", `/rest/v1/${this._table}`, row, null, {
          Prefer: "return=representation",
        });
      },

      async upsert(row, { onConflict } = {}) {
        const qs = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : "";
        return _req("POST", `/rest/v1/${this._table}${qs}`, row, null, {
          Prefer: "resolution=merge-duplicates,return=representation",
        });
      },

      async update(data) {
        let qs = "?";
        for (const f of this._filters) qs += `${f}&`;
        qs = qs.replace(/&$/, "");
        return _req("PATCH", `/rest/v1/${this._table}${qs}`, data, null, {
          Prefer: "return=representation",
        });
      },

      async delete() {
        let qs = "?";
        for (const f of this._filters) qs += `${f}&`;
        qs = qs.replace(/&$/, "");
        return _req("DELETE", `/rest/v1/${this._table}${qs}`, null, null, {});
      },
    };
  },

  /** Shorthand: insert a single row */
  async insert(table, row) {
    return _req("POST", `/rest/v1/${table}`, row, null, {
      Prefer: "return=representation",
    });
  },

  /** Shorthand: upsert a single row (merge on conflict) */
  async upsert(table, row, onConflict) {
    const qs = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : "";
    return _req("POST", `/rest/v1/${table}${qs}`, row, null, {
      Prefer: "resolution=merge-duplicates,return=representation",
    });
  },

  /** Shorthand: update rows matching filters */
  async update(table, filters, data) {
    const qs = "?" + Object.entries(filters).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join("&");
    return _req("PATCH", `/rest/v1/${table}${qs}`, data, null, {
      Prefer: "return=representation",
    });
  },

  /** KPI helper — fire and forget */
  kpi(eventType, email, metadata = {}, value = 1) {
    if (!SUPA_KEY) return;
    _req("POST", "/rest/v1/kpi_events", { event_type: eventType, email: email || null, value, metadata }, null, {
      Prefer: "return=minimal",
    }).catch((e) => console.warn("[kpi]", e.message));
  },
};

module.exports = db;
