-- ============================================================
-- PropertyDNA — Migration 009: APN Primary Key + Property Master
--
-- 1. Add APN + geo columns to property_reports and properties
-- 2. Create property_master (APN as PK, canonical record)
-- 3. Create property_history (append-only event log)
-- 4. Expand property_intelligence with full RentCast + new enrichment columns
-- ============================================================

-- ── 1. APN + geo on existing tables ──────────────────────────────────────────

ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS apn         text;
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS geo_polygon  jsonb;
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS h3_index     text;

ALTER TABLE properties ADD COLUMN IF NOT EXISTS apn         text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS geo_polygon  jsonb;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS h3_index     text;

CREATE INDEX IF NOT EXISTS prop_apn_idx ON properties(apn) WHERE apn IS NOT NULL;
CREATE INDEX IF NOT EXISTS pr_apn_idx   ON property_reports(apn) WHERE apn IS NOT NULL;

-- ── 2. property_master — canonical record keyed by APN ───────────────────────
-- APN is county-assigned and unique within a county.
-- county_fips disambiguates nationally (e.g. 06065 = Riverside County, CA).

CREATE TABLE IF NOT EXISTS property_master (
  apn                    text        PRIMARY KEY,
  county_fips            text,
  address                text,
  address_line1          text,
  city                   text,
  state                  text,
  zip                    text,
  lat                    numeric,
  lng                    numeric,
  geo_polygon            jsonb,
  h3_index_block         text,
  h3_index_neighborhood  text,

  -- RentCast identifiers
  rentcast_property_id   text,
  formatted_address      text,

  -- Property attributes (from RentCast /v1/properties)
  property_type          text,
  beds                   numeric,
  baths                  numeric,
  sqft                   numeric,
  lot_sqft               numeric,
  year_built             integer,
  legal_description      text,
  owner_occupied         boolean,

  -- Valuation (from RentCast /v1/avm/value)
  rentcast_value         numeric,
  rentcast_value_low     numeric,
  rentcast_value_high    numeric,
  rentcast_value_conf    text,

  -- Rental estimate (from RentCast /v1/avm/rent/long-term)
  rentcast_rent_est      numeric,
  rentcast_rent_low      numeric,
  rentcast_rent_high     numeric,
  rentcast_rent_conf     text,
  rentcast_cap_rate      numeric,
  rentcast_gross_yield   numeric,

  -- Market snapshot (from RentCast /v1/markets)
  market_median_price    numeric,
  market_median_rent     numeric,
  market_vacancy_rate    numeric,
  market_avg_dom         numeric,
  market_rent_yoy        numeric,
  market_price_yoy       numeric,

  -- Tax / assessment (from RentCast property details)
  tax_assessment_year    integer,
  tax_assessed_value     numeric,
  tax_annual_amount      numeric,

  -- Comps summary
  rental_comps_count     integer,
  sale_comps_count       integer,
  sale_comps_avg_price   numeric,
  sale_history_count     integer,

  -- Timestamps
  rentcast_fetched_at    timestamptz,
  created_at             timestamptz DEFAULT now(),
  last_updated           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pm_address_idx     ON property_master(address);
CREATE INDEX IF NOT EXISTS pm_zip_idx         ON property_master(zip);
CREATE INDEX IF NOT EXISTS pm_state_idx       ON property_master(state);
CREATE INDEX IF NOT EXISTS pm_county_idx      ON property_master(county_fips);
CREATE INDEX IF NOT EXISTS pm_rentcast_id_idx ON property_master(rentcast_property_id) WHERE rentcast_property_id IS NOT NULL;

-- ── 3. property_history — append-only event log keyed by APN ─────────────────
-- Never delete rows. Every sale, assessment, listing, permit, enrichment = one row.

CREATE TABLE IF NOT EXISTS property_history (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  apn         text        NOT NULL,
  event_type  text        NOT NULL,  -- 'sale'|'assessment'|'listing'|'rental'|'permit'|'enrichment'
  event_date  date,
  data        jsonb       NOT NULL DEFAULT '{}',
  source      text        NOT NULL,  -- 'rentcast'|'mls'|'county'|'user'|'pdna'
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ph_apn_idx     ON property_history(apn);
CREATE INDEX IF NOT EXISTS ph_type_idx    ON property_history(event_type);
CREATE INDEX IF NOT EXISTS ph_date_idx    ON property_history(event_date DESC);
CREATE INDEX IF NOT EXISTS ph_created_idx ON property_history(created_at DESC);

-- Prevent exact duplicate events (same apn + type + date + source)
CREATE UNIQUE INDEX IF NOT EXISTS ph_dedup_idx
  ON property_history(apn, event_type, event_date, source)
  WHERE event_date IS NOT NULL;

-- ── 4. Expand property_intelligence with full RentCast + new enrichment ───────

-- RentCast expanded
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS apn                    text;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS rentcast_property_id   text;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS rentcast_rent_low      numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS rentcast_rent_high     numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS rentcast_rent_conf     text;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS rentcast_value_low     numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS rentcast_value_high    numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS rentcast_value_conf    text;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS rentcast_cap_rate      numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS rentcast_gross_yield   numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS rentcast_vacancy_rate  numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS rental_comps_count     integer;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS rental_comps_avg_rent  numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS sale_comps_count       integer;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS sale_comps_avg_price   numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS sale_history_count     integer;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS tax_assessed_value     numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS tax_annual_amount      numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS legal_description      text;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS market_rent_yoy        numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS market_price_yoy       numeric;

-- Elevation + solar
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS elevation_m            numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS solar_score            numeric;  -- 0-100 derived from lat + orientation
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS solar_kwh_per_day     numeric;  -- estimated kWh/day

-- Proximity to noise sources
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS highway_distance_m     numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS railway_distance_m     numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS water_distance_m       numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS noise_score            numeric;  -- 0-100, higher = quieter

-- Seismic events (distinct from design-map seismic risk)
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS earthquake_events_1yr  integer;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS earthquake_max_mag     numeric;

-- Broadband
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS broadband_providers    integer;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS broadband_max_dl_mbps  numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS broadband_has_fiber    boolean;

-- NOAA weather events
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS noaa_hazard_events_1yr integer;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS noaa_precip_inches_yr  numeric;

-- ── 5. RLS on new tables ─────────────────────────────────────────────────────

ALTER TABLE property_master  ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_history ENABLE ROW LEVEL SECURITY;

-- Public read — powers report UI and market intelligence
DROP POLICY IF EXISTS "pm_anon_select" ON property_master;
CREATE POLICY "pm_anon_select" ON property_master  FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "pm_anon_write"  ON property_master;
CREATE POLICY "pm_anon_write"  ON property_master  FOR INSERT TO anon WITH CHECK (false);

DROP POLICY IF EXISTS "ph_anon_select" ON property_history;
CREATE POLICY "ph_anon_select" ON property_history FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "ph_anon_write"  ON property_history;
CREATE POLICY "ph_anon_write"  ON property_history FOR INSERT TO anon WITH CHECK (false);
