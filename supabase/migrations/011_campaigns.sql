-- Campaign management: email/SMS blast system
-- Supports agent lists, buyer lists, homeowner lists

CREATE TABLE IF NOT EXISTS campaigns (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('agent','buyer','homeowner','general')),
  status        TEXT DEFAULT 'draft' CHECK (status IN ('draft','sending','paused','complete','cancelled')),
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
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','opened','clicked','converted','bounced','unsubscribed','skipped')),
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
CREATE INDEX IF NOT EXISTS idx_cc_zip       ON campaign_contacts(zip);

-- RLS: service role only (admin functions)
ALTER TABLE campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_contacts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_unsubscribes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_campaigns"         ON campaigns            FOR ALL USING (true);
CREATE POLICY "service_all_campaign_contacts" ON campaign_contacts    FOR ALL USING (true);
CREATE POLICY "service_all_unsubscribes"      ON campaign_unsubscribes FOR ALL USING (true);
