-- ============================================================
-- PropertyDNA — Property Sovereignty Engine
-- Run AFTER 004_email_and_dna.sql
-- Creates the canonical property database that grows with every
-- report generated. Over time this becomes PropertyDNA's own
-- source of truth — not reliant on any single external API.
-- ============================================================

-- ── properties ───────────────────────────────────────────────
-- Canonical property record. One row per physical address.
CREATE TABLE IF NOT EXISTS properties (
  id                         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  address                    text        NOT NULL,
  unit                       text,
  city                       text,
  state                      text,
  zip                        text,
  county                     text,
  country                    text        DEFAULT 'US',
  property_type_normalized   text,
  beds                       numeric,
  baths                      numeric,
  sqft                       numeric,
  lot_sqft                   numeric,
  year_built                 integer,
  effective_year_built       integer,
  latitude                   numeric,
  longitude                  numeric,
  last_sale_date             date,
  last_sale_price            numeric,
  current_estimated_value    numeric,
  confidence_score           numeric,
  mls_number                 text,
  idx_url                    text,
  listing_source             text,
  listing_agent              text,
  listing_brokerage          text,
  created_at                 timestamptz DEFAULT now(),
  updated_at                 timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS properties_address_zip_idx ON properties(address, zip);
CREATE INDEX IF NOT EXISTS properties_zip_idx         ON properties(zip);
CREATE INDEX IF NOT EXISTS properties_city_state_idx  ON properties(city, state);
CREATE INDEX IF NOT EXISTS properties_latlon_idx      ON properties(latitude, longitude);

-- ── property_intelligence ─────────────────────────────────────
-- Enriched intelligence layer per property, refreshed on every report.
CREATE TABLE IF NOT EXISTS property_intelligence (
  id                       uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id              uuid        REFERENCES properties(id) ON DELETE CASCADE,
  address_hash             text        NOT NULL UNIQUE,
  pdna_value_low           numeric,
  pdna_value_mid           numeric,
  pdna_value_high          numeric,
  pdna_confidence          numeric,
  pdna_grade               text,
  rentcast_value           numeric,
  rentcast_rent_estimate   numeric,
  rentcast_fetched_at      timestamptz,
  dna_adjustment_pct       numeric,
  dna_drivers              jsonb,
  dna_features             jsonb,
  hazard_composite_score   numeric,
  hazard_rating            text,
  hazard_wildfire_score    numeric,
  hazard_flood_score       numeric,
  hazard_earthquake_score  numeric,
  hazard_wind_score        numeric,
  insurance_risk_tier      text,
  permit_count             integer     DEFAULT 0,
  data_completeness_pct    integer,
  refresh_count            integer     DEFAULT 1,
  last_refreshed_at        timestamptz DEFAULT now(),
  created_at               timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pi_property_idx   ON property_intelligence(property_id);
CREATE INDEX IF NOT EXISTS pi_hash_idx       ON property_intelligence(address_hash);

-- Trigger: increment refresh_count on each update (replaces db._increment call)
CREATE OR REPLACE FUNCTION pi_increment_refresh()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.refresh_count = COALESCE(OLD.refresh_count, 0) + 1;
  NEW.last_refreshed_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER pi_refresh_trigger
  BEFORE UPDATE ON property_intelligence
  FOR EACH ROW EXECUTE FUNCTION pi_increment_refresh();

-- ── property_events ───────────────────────────────────────────
-- Timeline of every event attached to a property: sales, permits, renovations.
CREATE TABLE IF NOT EXISTS property_events (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id   uuid        REFERENCES properties(id) ON DELETE CASCADE,
  event_type    text        NOT NULL,   -- sale | permit | renovation | listing | note
  event_date    date,
  event_source  text,
  event_value   numeric,
  event_notes   text,
  raw_payload   jsonb,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pe_property_idx ON property_events(property_id);
CREATE INDEX IF NOT EXISTS pe_type_idx     ON property_events(event_type);
CREATE INDEX IF NOT EXISTS pe_date_idx     ON property_events(event_date DESC);

-- ── permit_registry ───────────────────────────────────────────
-- Normalized permit records with PropertyDNA value-add scoring.
CREATE TABLE IF NOT EXISTS permit_registry (
  id               uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id      uuid    REFERENCES properties(id) ON DELETE CASCADE,
  address          text    NOT NULL,
  city             text,
  state            text,
  zip              text,
  permit_number    text,
  permit_type      text,
  permit_category  text,   -- value_add | maintenance | new_construction | compliance
  description      text,
  issued_date      date,
  status           text    DEFAULT 'finaled',
  estimated_value  numeric,
  pdna_value_add   numeric,
  jurisdiction     text,
  source           text    DEFAULT 'buildzoom',
  raw_data         jsonb,
  created_at       timestamptz DEFAULT now(),
  UNIQUE (property_id, permit_number, jurisdiction)
);
CREATE INDEX IF NOT EXISTS pr_property_idx  ON permit_registry(property_id);
CREATE INDEX IF NOT EXISTS pr_zip_idx       ON permit_registry(zip);
CREATE INDEX IF NOT EXISTS pr_category_idx  ON permit_registry(permit_category);

-- ── market_snapshots ──────────────────────────────────────────
-- Daily market data snapshots by ZIP / city / MSA.
CREATE TABLE IF NOT EXISTS market_snapshots (
  id                    uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  geo_key               text    NOT NULL,   -- zip, city slug, or metro code
  geo_type              text    NOT NULL,   -- zip | city | metro
  snapshot_date         date    NOT NULL,
  median_price          numeric,
  avg_price_per_sqft    numeric,
  median_dom            numeric,
  active_listings       integer,
  pending_listings      integer,
  sold_listings         integer,
  absorption_rate       numeric,
  rent_estimate         numeric,
  appreciation_rate_yoy numeric,
  volatility_score      numeric,
  demand_score          numeric,
  created_at            timestamptz DEFAULT now(),
  UNIQUE (geo_key, geo_type, snapshot_date)
);
CREATE INDEX IF NOT EXISTS ms_geo_date_idx ON market_snapshots(geo_key, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS ms_geo_type_idx ON market_snapshots(geo_type);

-- ── market_ticker ─────────────────────────────────────────────
-- OHLC-style market price ticks — one per geo per day.
CREATE TABLE IF NOT EXISTS market_ticker (
  id                 uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  geo_key            text    NOT NULL,
  geo_type           text    NOT NULL,
  tick_date          date    NOT NULL,
  open_price         numeric,
  high_price         numeric,
  low_price          numeric,
  close_price        numeric,
  volume             integer DEFAULT 0,
  median_sqft_price  numeric,
  active_listings    integer,
  source             text    DEFAULT 'rentcast',
  created_at         timestamptz DEFAULT now(),
  UNIQUE (geo_key, geo_type, tick_date)
);
CREATE INDEX IF NOT EXISTS mt_geo_date_idx ON market_ticker(geo_key, tick_date DESC);

-- ── neighborhood_index ────────────────────────────────────────
-- Rolled-up neighborhood quality scores updated on each report.
CREATE TABLE IF NOT EXISTS neighborhood_index (
  id                       uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  geo_key                  text    NOT NULL UNIQUE,
  geo_type                 text    DEFAULT 'zip',
  state                    text,
  city                     text,
  desirability_score       numeric,
  desirability_grade       text,
  median_price             numeric,
  median_price_sqft        numeric,
  absorption_rate          numeric,
  demand_score             numeric,
  volatility_score         numeric,
  report_count             integer DEFAULT 0,
  total_properties_tracked integer DEFAULT 0,
  last_computed_at         timestamptz,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ni_geo_idx   ON neighborhood_index(geo_key);
CREATE INDEX IF NOT EXISTS ni_grade_idx ON neighborhood_index(desirability_grade);

-- ── api_call_log ──────────────────────────────────────────────
-- Tracks every external API call for cost analysis and caching.
CREATE TABLE IF NOT EXISTS api_call_log (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  provider    text    NOT NULL,
  address     text,
  geo_key     text,
  success     boolean DEFAULT true,
  cached_hit  boolean DEFAULT false,
  latency_ms  integer,
  report_id   uuid,
  error_msg   text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acl_provider_idx ON api_call_log(provider);
CREATE INDEX IF NOT EXISTS acl_created_idx  ON api_call_log(created_at DESC);
CREATE INDEX IF NOT EXISTS acl_report_idx   ON api_call_log(report_id);

-- ── updated_at triggers ───────────────────────────────────────
CREATE OR REPLACE TRIGGER properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER neighborhood_index_updated_at
  BEFORE UPDATE ON neighborhood_index
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE properties            ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE permit_registry       ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_snapshots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_ticker         ENABLE ROW LEVEL SECURITY;
ALTER TABLE neighborhood_index    ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_call_log          ENABLE ROW LEVEL SECURITY;

-- properties: anon read-only (needed for report view pages)
DROP POLICY IF EXISTS "properties_anon_select" ON properties;
CREATE POLICY "properties_anon_select"
  ON properties FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "properties_anon_insert" ON properties;
CREATE POLICY "properties_anon_insert"
  ON properties FOR INSERT TO anon WITH CHECK (false);

-- market_snapshots: anon read (powers public heat maps)
DROP POLICY IF EXISTS "ms_anon_select" ON market_snapshots;
CREATE POLICY "ms_anon_select"
  ON market_snapshots FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "ms_anon_insert" ON market_snapshots;
CREATE POLICY "ms_anon_insert"
  ON market_snapshots FOR INSERT TO anon WITH CHECK (false);

-- market_ticker: anon read (powers public heat maps)
DROP POLICY IF EXISTS "mt_anon_select" ON market_ticker;
CREATE POLICY "mt_anon_select"
  ON market_ticker FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "mt_anon_insert" ON market_ticker;
CREATE POLICY "mt_anon_insert"
  ON market_ticker FOR INSERT TO anon WITH CHECK (false);

-- neighborhood_index: anon read (powers public heat maps)
DROP POLICY IF EXISTS "ni_anon_select" ON neighborhood_index;
CREATE POLICY "ni_anon_select"
  ON neighborhood_index FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "ni_anon_insert" ON neighborhood_index;
CREATE POLICY "ni_anon_insert"
  ON neighborhood_index FOR INSERT TO anon WITH CHECK (false);

-- Everything else: no anon access
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['property_intelligence','property_events','permit_registry','api_call_log']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_anon_select" ON %s', t, t);
    EXECUTE format('CREATE POLICY "%s_anon_select" ON %s FOR SELECT TO anon USING (false)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_anon_insert" ON %s', t, t);
    EXECUTE format('CREATE POLICY "%s_anon_insert" ON %s FOR INSERT TO anon WITH CHECK (false)', t, t);
  END LOOP;
END $$;
