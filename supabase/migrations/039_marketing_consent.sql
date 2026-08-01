-- 039 — Marketing consent toggle
-- Separate from campaign_unsubscribes (permanent CAN-SPAM list).
-- This table is the on/off switch Dan can flip per contact.
-- Absence of a row = opted in. opted_in = false = suppress all marketing.

CREATE TABLE IF NOT EXISTS marketing_consent (
  email         TEXT PRIMARY KEY,
  opted_in      BOOLEAN NOT NULL DEFAULT TRUE,
  reason        TEXT,                            -- 'user_request' | 'admin' | 'bounce' | 'resubscribe'
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  opted_out_at  TIMESTAMPTZ,
  opted_in_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_marketing_consent_opted_in ON marketing_consent(opted_in);

-- RLS: service role only
ALTER TABLE marketing_consent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all_marketing_consent" ON marketing_consent FOR ALL USING (true);

-- Helper view: all suppressed emails (permanent + toggleable)
CREATE OR REPLACE VIEW marketing_suppressed AS
  SELECT email, 'permanent' AS source FROM campaign_unsubscribes
  UNION
  SELECT email, 'toggled'   AS source FROM marketing_consent WHERE opted_in = false;
