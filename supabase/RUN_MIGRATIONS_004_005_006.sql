-- ============================================================
-- PropertyDNA — Run Migrations 004 + 005 + 006 in one pass
-- Paste this entire file into:
-- https://app.supabase.com/project/neccpdfhmfnvyjgyrysy/sql/new
-- ============================================================

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

-- ============================================================
-- PropertyDNA — Migration 005: Unit number, property type, hazard fields
-- Paste into Supabase SQL Editor
-- ============================================================

-- Unit number + property type on property_reports
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS unit          text;
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS property_type text;

-- Unit number + property type on reports (legacy table)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS unit          text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS property_type text;

-- FEMA NRI hazard fields on property_reports
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS hazard_score          numeric;  -- composite 0–100
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS hazard_risk_rating    text;     -- 'Very High' | 'High' | 'Relatively High' | etc.
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS hazard_flood_score    numeric;
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS hazard_wildfire_score numeric;
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS hazard_earthquake_score numeric;
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS hazard_wind_score     numeric;
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS hazard_raw            jsonb DEFAULT '{}';

-- NWS active hazard alerts
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS nws_hazard_alerts     jsonb DEFAULT '[]';

-- Insurance estimate fields (from hazard scoring, not a quote)
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS insurance_risk_tier   text;     -- 'Standard' | 'Elevated' | 'High Risk' | 'Very High Risk'
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS insurance_notes       text;

-- ============================================================
-- PropertyDNA — Migration 006: Data Sovereignty Layer
--
-- Every report generated feeds permanent property intelligence
-- into these tables. PropertyDNA becomes the source of truth.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- A: DATA SOURCES LEDGER
-- Tracks where each piece of data came from and when last refreshed.
-- This is how PropertyDNA knows its own data vs third-party.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS property_data_sources (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     uuid        REFERENCES properties(id) ON DELETE CASCADE,
  field_name      text        NOT NULL,   -- 'beds', 'sqft', 'last_sale_price', etc.
  source_name     text        NOT NULL,   -- 'rentcast', 'fema', 'census', 'mls', 'user', 'pdna'
  source_key      text,                   -- API key/endpoint used
  raw_value       text,                   -- raw value from source
  confidence      numeric,               -- 0–1
  fetched_at      timestamptz DEFAULT now(),
  expires_at      timestamptz,           -- null = permanent
  created_at      timestamptz DEFAULT gen_random_uuid()
);

CREATE INDEX IF NOT EXISTS pds_property_idx ON property_data_sources(property_id);
CREATE INDEX IF NOT EXISTS pds_field_idx    ON property_data_sources(field_name);
CREATE INDEX IF NOT EXISTS pds_source_idx   ON property_data_sources(source_name);

-- ────────────────────────────────────────────────────────────
-- B: NEIGHBORHOOD INDEX
-- PropertyDNA's own neighborhood intelligence layer.
-- Built from aggregating all reports in a given area.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS neighborhood_index (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  geo_key                 text        NOT NULL UNIQUE, -- zip | city-neighborhood slug
  geo_type                text        NOT NULL,        -- 'zip' | 'neighborhood' | 'subdivision'
  display_name            text,
  state                   text,
  city                    text,

  -- Desirability composite (PropertyDNA proprietary score)
  desirability_score      numeric,    -- 0–100
  desirability_grade      text,       -- 'A+' | 'A' | 'B+' ... 'D'

  -- Market health (built from market_snapshots)
  median_price            numeric,
  median_price_sqft       numeric,
  appreciation_1yr        numeric,    -- %
  appreciation_3yr        numeric,
  appreciation_5yr        numeric,
  volatility_score        numeric,    -- 0–100
  demand_score            numeric,    -- 0–100
  absorption_rate         numeric,    -- months

  -- Micro-location factors
  school_score            numeric,
  crime_score             numeric,    -- lower = safer
  walkability_score       numeric,
  luxury_tier             boolean     DEFAULT false,
  resort_community        boolean     DEFAULT false,
  gated_prevalence        numeric,    -- % of homes in gated communities
  hoa_prevalence          numeric,    -- % with HOA
  median_hoa_monthly      numeric,

  -- Property mix
  total_properties_tracked int        DEFAULT 0,
  pct_single_family       numeric,
  pct_condo               numeric,
  pct_owner_occupied      numeric,
  pct_rental              numeric,

  -- Trend signal (computed from market_snapshots MA crossovers)
  trend_signal            text,       -- 'bullish' | 'bearish' | 'neutral'
  trend_30d_change_pct    numeric,
  trend_90d_change_pct    numeric,

  -- Metadata
  last_computed_at        timestamptz DEFAULT now(),
  report_count            int         DEFAULT 0,   -- how many reports have hit this geo
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS neighborhood_geo_idx   ON neighborhood_index(geo_key);
CREATE INDEX IF NOT EXISTS neighborhood_state_idx  ON neighborhood_index(state);
CREATE INDEX IF NOT EXISTS neighborhood_score_idx  ON neighborhood_index(desirability_score DESC);

-- ────────────────────────────────────────────────────────────
-- C: PROPERTY INTELLIGENCE CACHE
-- Every time a property is looked up, cache the result.
-- Subsequent reports hit this first — no API call needed.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS property_intelligence (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id             uuid        REFERENCES properties(id) ON DELETE CASCADE,
  address_hash            text        UNIQUE NOT NULL, -- MD5 of normalized address for fast lookup

  -- Valuation (PropertyDNA AVM — our own number)
  pdna_value_low          numeric,
  pdna_value_mid          numeric,
  pdna_value_high         numeric,
  pdna_confidence         numeric,    -- 0–1
  pdna_grade              text,       -- 'A+' | 'A' | 'B+' | 'B' | 'C'

  -- External AVM consensus (stored, not re-fetched)
  rentcast_value          numeric,
  rentcast_rent_estimate  numeric,
  rentcast_fetched_at     timestamptz,

  -- DNA adjustment result
  dna_adjustment_pct      numeric,    -- total % applied
  dna_drivers             jsonb,      -- [{key, label, pct}]
  dna_features            jsonb,      -- feature flags detected

  -- Hazard intelligence (from FEMA NRI)
  hazard_composite_score  numeric,
  hazard_rating           text,
  hazard_wildfire_score   numeric,
  hazard_flood_score      numeric,
  hazard_earthquake_score numeric,
  hazard_wind_score       numeric,
  insurance_risk_tier     text,

  -- Permit summary (from Socrata + BuildZoom)
  permit_count            int         DEFAULT 0,
  permit_last_date        date,
  permit_value_total      numeric,
  permit_types            text[],     -- ['kitchen', 'roof', 'addition', 'hvac', ...]

  -- Effective age (adjusted by permits/renovations)
  effective_year_built    int,
  condition_score         numeric,    -- 0–100

  -- Metadata
  data_completeness_pct   numeric,    -- 0–100: how many fields are populated
  source_count            int         DEFAULT 1,   -- how many sources contributed
  last_refreshed_at       timestamptz DEFAULT now(),
  refresh_count           int         DEFAULT 1,   -- how many times this has been re-run
  created_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pi_property_idx  ON property_intelligence(property_id);
CREATE INDEX IF NOT EXISTS pi_hash_idx      ON property_intelligence(address_hash);
CREATE INDEX IF NOT EXISTS pi_value_idx     ON property_intelligence(pdna_value_mid);
CREATE INDEX IF NOT EXISTS pi_grade_idx     ON property_intelligence(pdna_grade);

-- ────────────────────────────────────────────────────────────
-- D: PERMIT REGISTRY
-- Our own permit database — built from Socrata + BuildZoom
-- + user-submitted permits. Grows with every report.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS permit_registry (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     uuid        REFERENCES properties(id) ON DELETE CASCADE,
  address         text,
  city            text,
  state           text,
  zip             text,
  permit_number   text,
  permit_type     text,       -- 'addition' | 'remodel' | 'roof' | 'hvac' | 'pool' | 'adu' | 'electrical' | etc.
  permit_category text,       -- 'value_add' | 'maintenance' | 'compliance' | 'new_construction'
  description     text,
  issued_date     date,
  finaled_date    date,
  status          text,       -- 'issued' | 'finaled' | 'expired' | 'voided'
  estimated_value numeric,    -- permit value (declared)
  pdna_value_add  numeric,    -- PropertyDNA estimated value impact
  jurisdiction    text,       -- city/county that issued it
  source          text,       -- 'socrata' | 'buildzoom' | 'user_submitted' | 'n8n'
  raw_data        jsonb       DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pr_property_idx  ON permit_registry(property_id);
CREATE INDEX IF NOT EXISTS pr_address_idx   ON permit_registry(address);
CREATE INDEX IF NOT EXISTS pr_zip_idx       ON permit_registry(zip);
CREATE INDEX IF NOT EXISTS pr_type_idx      ON permit_registry(permit_type);
CREATE INDEX IF NOT EXISTS pr_date_idx      ON permit_registry(issued_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS pr_unique_idx
  ON permit_registry(address, permit_number, jurisdiction)
  WHERE permit_number IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- E: MARKET TICKER
-- Bloomberg-style per-neighborhood price history.
-- Every market_snapshot becomes a tick in the chart.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_ticker (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  geo_key         text        NOT NULL,
  geo_type        text        NOT NULL,
  tick_date       date        NOT NULL,
  open_price      numeric,    -- first sale price recorded that period
  high_price      numeric,    -- highest sale
  low_price       numeric,    -- lowest sale
  close_price     numeric,    -- median (like closing price on a stock)
  volume          int,        -- number of transactions
  median_sqft_price numeric,
  active_listings int,
  new_listings    int,
  price_reductions int,
  source          text        DEFAULT 'pdna',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mt_geo_idx  ON market_ticker(geo_key, geo_type);
CREATE INDEX IF NOT EXISTS mt_date_idx ON market_ticker(tick_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS mt_unique_idx
  ON market_ticker(geo_key, geo_type, tick_date);

-- ────────────────────────────────────────────────────────────
-- F: EXTERNAL API LOG
-- Every external API call logged — so we know exactly what
-- data we have and when it was last fresh.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_call_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        text        NOT NULL,  -- 'rentcast' | 'fema' | 'census' | 'nws' | 'socrata'
  endpoint        text,
  address         text,
  geo_key         text,
  status_code     int,
  success         boolean,
  response_ms     int,
  cached_hit      boolean     DEFAULT false,
  report_id       uuid        REFERENCES property_reports(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS acl_provider_idx ON api_call_log(provider);
CREATE INDEX IF NOT EXISTS acl_address_idx  ON api_call_log(address);
CREATE INDEX IF NOT EXISTS acl_date_idx     ON api_call_log(created_at DESC);

-- ────────────────────────────────────────────────────────────
-- G: TRIGGERS
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE TRIGGER neighborhood_index_updated_at
  BEFORE UPDATE ON neighborhood_index
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
-- H: ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

ALTER TABLE property_data_sources    ENABLE ROW LEVEL SECURITY;
ALTER TABLE neighborhood_index       ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_intelligence    ENABLE ROW LEVEL SECURITY;
ALTER TABLE permit_registry          ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_ticker            ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_call_log             ENABLE ROW LEVEL SECURITY;

-- Public read on intelligence + neighborhood + permits (powers the report UI)
DROP POLICY IF EXISTS "pi_anon_select"   ON property_intelligence;
CREATE POLICY "pi_anon_select"           ON property_intelligence FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "ni_anon_select"   ON neighborhood_index;
CREATE POLICY "ni_anon_select"           ON neighborhood_index    FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "pr_anon_select"   ON permit_registry;
CREATE POLICY "pr_anon_select"           ON permit_registry       FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "mt_anon_select"   ON market_ticker;
CREATE POLICY "mt_anon_select"           ON market_ticker         FOR SELECT TO anon USING (true);

-- No anon writes — service_role only
DROP POLICY IF EXISTS "pi_anon_insert"   ON property_intelligence;
CREATE POLICY "pi_anon_insert"           ON property_intelligence FOR INSERT TO anon WITH CHECK (false);
DROP POLICY IF EXISTS "ni_anon_insert"   ON neighborhood_index;
CREATE POLICY "ni_anon_insert"           ON neighborhood_index    FOR INSERT TO anon WITH CHECK (false);
DROP POLICY IF EXISTS "pr_anon_insert"   ON permit_registry;
CREATE POLICY "pr_anon_insert"           ON permit_registry       FOR INSERT TO anon WITH CHECK (false);
DROP POLICY IF EXISTS "pds_anon_select"  ON property_data_sources;
CREATE POLICY "pds_anon_select"          ON property_data_sources FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS "acl_anon_select"  ON api_call_log;
CREATE POLICY "acl_anon_select"          ON api_call_log          FOR SELECT TO anon USING (false);
