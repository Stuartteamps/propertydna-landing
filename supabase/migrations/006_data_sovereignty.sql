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
