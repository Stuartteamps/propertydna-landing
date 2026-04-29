-- ============================================================
-- PropertyDNA — Migration 004: Valuation Intelligence + IDX/MLS
-- Paste into Supabase SQL Editor
-- https://app.supabase.com/project/neccpdfhmfnvyjgyrysy/sql/new
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- A: PROPERTY LAYER
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS properties (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  address                   text        NOT NULL,
  city                      text,
  state                     text,
  zip                       text,
  apn                       text,
  parcel_id                 text,
  property_type_raw         text,
  property_type_normalized  text,
  beds                      numeric,
  baths                     numeric,
  sqft                      numeric,
  lot_sqft                  numeric,
  year_built                int,
  effective_year_built      int,
  hoa_monthly               numeric,
  latitude                  numeric,
  longitude                 numeric,
  last_sale_date            date,
  last_sale_price           numeric,
  current_estimated_value   numeric,
  confidence_score          numeric,
  idx_url                   text,
  mls_number                text,
  listing_source            text,
  listing_agent             text,
  listing_brokerage         text,
  mls_raw_data              jsonb       DEFAULT '{}',
  mls_enrichment_status     text        DEFAULT 'pending',
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS properties_address_idx ON properties(address);
CREATE INDEX IF NOT EXISTS properties_zip_idx     ON properties(zip);
CREATE INDEX IF NOT EXISTS properties_apn_idx     ON properties(apn);
CREATE INDEX IF NOT EXISTS properties_mls_idx     ON properties(mls_number);
CREATE INDEX IF NOT EXISTS properties_latlon_idx  ON properties(latitude, longitude);

-- ────────────────────────────────────────────────────────────
-- B: PROPERTY EVENTS
-- ────────────────────────────────────────────────────────────
-- Event types: sale, listing, price_change, permit, renovation,
--              addition, hoa_update, tax_update, rent_update,
--              valuation_update, market_adjustment

CREATE TABLE IF NOT EXISTS property_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   uuid        REFERENCES properties(id) ON DELETE CASCADE,
  event_type    text        NOT NULL,
  event_date    date,
  event_source  text,
  event_value   numeric,
  event_notes   text,
  raw_payload   jsonb,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS property_events_property_idx ON property_events(property_id);
CREATE INDEX IF NOT EXISTS property_events_type_idx     ON property_events(event_type);
CREATE INDEX IF NOT EXISTS property_events_date_idx     ON property_events(event_date DESC);

-- ────────────────────────────────────────────────────────────
-- C: LOCATION SCORES  (Enterprise tier)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS location_scores (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id                uuid        REFERENCES properties(id) ON DELETE CASCADE,
  neighborhood               text,
  subdivision                text,
  street_segment_id          text,
  same_side_street           boolean,
  gated_score                numeric,    -- 0–100
  golf_frontage_score        numeric,
  view_score                 numeric,
  road_noise_score           numeric,
  walkability_score          numeric,
  school_score               numeric,
  environmental_risk_score   numeric,
  luxury_neighborhood_score  numeric,
  micro_location_premium_pct numeric,    -- % above/below base
  created_at                 timestamptz DEFAULT now(),
  updated_at                 timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS location_scores_property_idx ON location_scores(property_id);

-- ────────────────────────────────────────────────────────────
-- D: MARKET SNAPSHOTS  (Pro tier)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_snapshots (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  geo_key               text        NOT NULL,   -- zip, neighborhood slug, city, subdivision
  geo_type              text        NOT NULL,   -- 'zip' | 'neighborhood' | 'city' | 'subdivision'
  snapshot_date         date        NOT NULL,
  median_price          numeric,
  avg_price_per_sqft    numeric,
  median_dom            int,                    -- days on market
  active_listings       int,
  pending_listings      int,
  sold_listings         int,
  absorption_rate       numeric,               -- months of supply
  rent_estimate         numeric,
  rent_trend_pct        numeric,
  ma_30_day             numeric,               -- 30-day moving avg median price
  ma_60_day             numeric,
  ma_90_day             numeric,
  ma_180_day            numeric,
  appreciation_rate_yoy numeric,               -- year-over-year %
  volatility_score      numeric,               -- 0–100
  demand_score          numeric,               -- 0–100
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS market_snapshots_geo_idx  ON market_snapshots(geo_key, geo_type);
CREATE INDEX IF NOT EXISTS market_snapshots_date_idx ON market_snapshots(snapshot_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS market_snapshots_unique_idx
  ON market_snapshots(geo_key, geo_type, snapshot_date);

-- ────────────────────────────────────────────────────────────
-- E: IDX/MLS COLUMNS on existing tables
-- ────────────────────────────────────────────────────────────

ALTER TABLE reports ADD COLUMN IF NOT EXISTS idx_url               text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS mls_number            text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS listing_source        text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS listing_agent         text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS listing_brokerage     text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS mls_raw_data          jsonb DEFAULT '{}';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS mls_enrichment_status text DEFAULT 'pending';

ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS idx_url               text;
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS mls_number            text;
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS listing_source        text;
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS listing_agent         text;
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS listing_brokerage     text;
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS mls_raw_data          jsonb DEFAULT '{}';
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS mls_enrichment_status text DEFAULT 'pending';

-- ────────────────────────────────────────────────────────────
-- F: TRIGGERS
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE TRIGGER properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER location_scores_updated_at
  BEFORE UPDATE ON location_scores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
-- G: ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

ALTER TABLE properties       ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_scores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_snapshots ENABLE ROW LEVEL SECURITY;

-- properties: anon read (needed for report display)
DROP POLICY IF EXISTS "properties_anon_select" ON properties;
CREATE POLICY "properties_anon_select" ON properties FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "properties_anon_write" ON properties;
CREATE POLICY "properties_anon_write"  ON properties FOR INSERT TO anon WITH CHECK (false);

-- property_events: anon read
DROP POLICY IF EXISTS "prop_events_anon_select" ON property_events;
CREATE POLICY "prop_events_anon_select" ON property_events FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "prop_events_anon_write" ON property_events;
CREATE POLICY "prop_events_anon_write"  ON property_events FOR INSERT TO anon WITH CHECK (false);

-- location_scores: anon read (enterprise tier display)
DROP POLICY IF EXISTS "loc_scores_anon_select" ON location_scores;
CREATE POLICY "loc_scores_anon_select" ON location_scores FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "loc_scores_anon_write" ON location_scores;
CREATE POLICY "loc_scores_anon_write"  ON location_scores FOR INSERT TO anon WITH CHECK (false);

-- market_snapshots: anon read (pro tier display)
DROP POLICY IF EXISTS "mkt_snap_anon_select" ON market_snapshots;
CREATE POLICY "mkt_snap_anon_select" ON market_snapshots FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "mkt_snap_anon_write" ON market_snapshots;
CREATE POLICY "mkt_snap_anon_write"  ON market_snapshots FOR INSERT TO anon WITH CHECK (false);
