-- ============================================================
-- PropertyDNA — Email Delivery + DNA Valuation Tables
-- Run AFTER 003_storage.sql
-- ============================================================

-- ── Add secure view_token to property_reports ────────────────
ALTER TABLE property_reports
  ADD COLUMN IF NOT EXISTS view_token text UNIQUE;

CREATE INDEX IF NOT EXISTS property_reports_token_idx
  ON property_reports(view_token);

-- ── email_delivery_events ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_delivery_events (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      timestamptz DEFAULT now(),
  report_id       uuid        REFERENCES property_reports(id) ON DELETE SET NULL,
  recipient_email text        NOT NULL,
  sender_email    text,
  subject         text,
  status          text        NOT NULL DEFAULT 'sent',
  provider        text,
  error_code      text,
  error_message   text,
  bounce_type     text,
  metadata        jsonb       DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS email_delivery_email_idx  ON email_delivery_events(recipient_email);
CREATE INDEX IF NOT EXISTS email_delivery_status_idx ON email_delivery_events(status);
CREATE INDEX IF NOT EXISTS email_delivery_report_idx ON email_delivery_events(report_id);
CREATE INDEX IF NOT EXISTS email_delivery_created_idx ON email_delivery_events(created_at DESC);

-- ── valuation_feature_adjustments ────────────────────────────
CREATE TABLE IF NOT EXISTS valuation_feature_adjustments (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_key text    NOT NULL UNIQUE,
  label       text    NOT NULL,
  pct_low     numeric NOT NULL DEFAULT 0,
  pct_mid     numeric NOT NULL DEFAULT 0,
  pct_high    numeric NOT NULL DEFAULT 0,
  applies_to  text    DEFAULT 'both',
  notes       text,
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

INSERT INTO valuation_feature_adjustments
  (feature_key, label, pct_low, pct_mid, pct_high, applies_to, notes)
VALUES
  ('waterfront',               'Waterfront',                   8,  12, 20, 'both',   'Direct waterfront access premium'),
  ('lakefront',                'Lakefront',                    6,  10, 18, 'both',   'Lake-facing lot premium'),
  ('golf_course',              'Golf Course View/Adjacent',    3,   5,  9, 'both',   'Golf community premium'),
  ('mountain_view',            'Mountain View',                2,   4,  7, 'both',   'Premium mountain or scenic view'),
  ('premium_community',        'Premium Gated Community',      3,   6, 10, 'both',   'Branded luxury community'),
  ('fully_remodeled',          'Fully Remodeled',              5,   8, 14, 'both',   'Turnkey renovation premium'),
  ('updated',                  'Updated (Partial)',             2,   4,  7, 'both',   'Partial update vs original'),
  ('original_condition',       'Original / Dated Condition',  -8,  -5, -2, 'both',   'Below-market deduction for dated condition'),
  ('pool',                     'Pool',                         2,   4,  7, 'both',   'Private pool premium'),
  ('no_pool_desert_penalty',   'No Pool (Desert Market)',     -4,  -2,  0, 'both',   'Lack of pool in AZ/NV/FL desert markets'),
  ('corner_lot',               'Corner Lot',                  -2,   0,  2, 'both',   'Mixed premium/discount depending on market'),
  ('oversized_lot',            'Oversized Lot',                2,   5, 10, 'both',   'Significantly larger than average lot'),
  ('gated_community',          'Gated Community',              2,   4,  7, 'both',   'Security-gated access premium'),
  ('short_term_rental_friendly','STR Friendly Zone',           3,   6, 12, 'buyer',  'Short-term rental zoning premium')
ON CONFLICT (feature_key) DO NOTHING;

-- ── community_multipliers ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_multipliers (
  id             uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  community_name text    NOT NULL,
  zip_code       text,
  city           text,
  state          text,
  multiplier     numeric NOT NULL DEFAULT 1.0,
  tier           text    DEFAULT 'standard',
  notes          text,
  active         boolean DEFAULT true,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_multipliers_zip_idx ON community_multipliers(zip_code);

-- ── property_feature_profiles ─────────────────────────────────
CREATE TABLE IF NOT EXISTS property_feature_profiles (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id   uuid    REFERENCES property_reports(id) ON DELETE CASCADE,
  address     text,
  features    jsonb   DEFAULT '{}',
  raw_low     numeric,
  raw_mid     numeric,
  raw_high    numeric,
  adj_low     numeric,
  adj_mid     numeric,
  adj_high    numeric,
  confidence  numeric DEFAULT 0.7,
  drivers     jsonb   DEFAULT '[]',
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feature_profiles_report_idx ON property_feature_profiles(report_id);

-- ── RLS for new tables ────────────────────────────────────────
ALTER TABLE email_delivery_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE valuation_feature_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_multipliers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_feature_profiles    ENABLE ROW LEVEL SECURITY;

-- email_delivery_events: no anon access
DROP POLICY IF EXISTS "email_delivery_anon_select" ON email_delivery_events;
CREATE POLICY "email_delivery_anon_select"
  ON email_delivery_events FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS "email_delivery_anon_insert" ON email_delivery_events;
CREATE POLICY "email_delivery_anon_insert"
  ON email_delivery_events FOR INSERT TO anon WITH CHECK (false);

-- valuation_feature_adjustments: anon read-only (used by frontend if needed)
DROP POLICY IF EXISTS "vfa_anon_select" ON valuation_feature_adjustments;
CREATE POLICY "vfa_anon_select"
  ON valuation_feature_adjustments FOR SELECT TO anon USING (active = true);
DROP POLICY IF EXISTS "vfa_anon_insert" ON valuation_feature_adjustments;
CREATE POLICY "vfa_anon_insert"
  ON valuation_feature_adjustments FOR INSERT TO anon WITH CHECK (false);

-- community_multipliers: anon read-only
DROP POLICY IF EXISTS "cm_anon_select" ON community_multipliers;
CREATE POLICY "cm_anon_select"
  ON community_multipliers FOR SELECT TO anon USING (active = true);
DROP POLICY IF EXISTS "cm_anon_insert" ON community_multipliers;
CREATE POLICY "cm_anon_insert"
  ON community_multipliers FOR INSERT TO anon WITH CHECK (false);

-- property_feature_profiles: no anon access
DROP POLICY IF EXISTS "pfp_anon_select" ON property_feature_profiles;
CREATE POLICY "pfp_anon_select"
  ON property_feature_profiles FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS "pfp_anon_insert" ON property_feature_profiles;
CREATE POLICY "pfp_anon_insert"
  ON property_feature_profiles FOR INSERT TO anon WITH CHECK (false);
