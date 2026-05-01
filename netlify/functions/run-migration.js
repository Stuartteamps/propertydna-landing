// One-time migration runner — call POST with x-internal-key to apply 011_campaigns
const db = require('./_supabase');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

const MIGRATION = `
CREATE TABLE IF NOT EXISTS campaigns (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,
  status        TEXT DEFAULT 'draft',
  subject       TEXT,
  template      TEXT DEFAULT 'agent',
  total_contacts   INTEGER DEFAULT 0,
  sent_count       INTEGER DEFAULT 0,
  opened_count     INTEGER DEFAULT 0,
  clicked_count    INTEGER DEFAULT 0,
  converted_count  INTEGER DEFAULT 0,
  bounced_count    INTEGER DEFAULT 0,
  unsubscribed_count INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  launched_at   TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_by    TEXT
);

CREATE TABLE IF NOT EXISTS campaign_contacts (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id   UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  first_name    TEXT,
  last_name     TEXT,
  email         TEXT NOT NULL,
  phone         TEXT,
  address       TEXT,
  city          TEXT,
  state         TEXT DEFAULT 'CA',
  zip           TEXT,
  brokerage     TEXT,
  license       TEXT,
  property_type TEXT,
  neighborhood_score  INTEGER,
  score_label   TEXT,
  status        TEXT DEFAULT 'pending',
  sent_at       TIMESTAMPTZ,
  opened_at     TIMESTAMPTZ,
  clicked_at    TIMESTAMPTZ,
  resend_id     TEXT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_unsubscribes (
  email      TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_campaign  ON campaign_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cc_email     ON campaign_contacts(email);
CREATE INDEX IF NOT EXISTS idx_cc_status    ON campaign_contacts(campaign_id, status);
`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const key = event.headers['x-internal-key'];
  if (key !== process.env.INTERNAL_API_KEY) return { statusCode: 401, headers: CORS, body: '{"error":"unauthorized"}' };

  try {
    const { error } = await db.supabase.rpc('exec', { sql: MIGRATION }).single();
    if (error && !error.message?.includes('already exists')) {
      // Try running statements individually
      const stmts = MIGRATION.split(';').map(s => s.trim()).filter(Boolean);
      const results = [];
      for (const stmt of stmts) {
        const r = await db.supabase.rpc('exec', { sql: stmt }).catch(e => ({ error: e }));
        results.push({ ok: !r.error, stmt: stmt.slice(0, 40) });
      }
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ results }) };
    }
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
