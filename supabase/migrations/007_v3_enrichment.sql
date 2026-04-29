-- ============================================================
-- PropertyDNA — Migration 007: v3 Comprehensive Data Pipeline
--
-- Adds enrichment storage for 20+ data sources:
--   • report_data_sources   — raw API response audit trail (per report)
--   • property_intelligence — v3 enrichment columns
--   • property_reports      — enrichment_data JSONB + category score columns
--
-- Paste into:
-- https://app.supabase.com/project/neccpdfhmfnvyjgyrysy/sql/new
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- A: REPORT DATA SOURCES
-- Per-report audit trail of every external API call.
-- Every raw response stored here for our own database building.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS report_data_sources (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id    uuid        REFERENCES property_reports(id) ON DELETE CASCADE,
  source_name  text        NOT NULL,   -- 'census' | 'fred' | 'hud' | 'fema_flood_v3' | etc.
  status       text        NOT NULL DEFAULT 'pending',  -- success | failed | unavailable
  raw_response text,                   -- truncated raw JSON (max 50 KB)
  fetched_at   timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rds_report_idx  ON report_data_sources(report_id);
CREATE INDEX IF NOT EXISTS rds_source_idx  ON report_data_sources(source_name);
CREATE INDEX IF NOT EXISTS rds_status_idx  ON report_data_sources(status);
CREATE INDEX IF NOT EXISTS rds_fetched_idx ON report_data_sources(fetched_at DESC);

-- ────────────────────────────────────────────────────────────
-- B: PROPERTY INTELLIGENCE — v3 enrichment columns
-- Added one-by-one so migration is safe to re-run (IF NOT EXISTS)
-- ────────────────────────────────────────────────────────────

-- Walk Score / OSM location intelligence
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS walk_score               numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS transit_score            numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS bike_score               numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS schools_nearby           integer;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS parks_nearby             integer;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS transit_stops_nearby     integer;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS grocery_stores_nearby    integer;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS hospitals_nearby         integer;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS amenity_proximity_score  numeric;

-- Census ACS 5-year estimates
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS census_median_income      numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS census_median_home_value  numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS census_total_population   integer;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS census_median_gross_rent  numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS census_block_fips         text;

-- FRED (mortgage rates, national HPI)
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS fred_mortgage_rate  numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS fred_hpi_yoy        numeric;

-- HUD Fair Market Rents
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS hud_fmr_2bed  numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS hud_fmr_3bed  numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS hud_metro      text;

-- FEMA Flood Zone (detailed v3 — separate from existing hazard_flood_score)
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS fema_flood_zone_v3  text;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS fema_flood_sfha     boolean;

-- EPA EJSCREEN
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS epa_ej_index_pctile  numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS epa_pm25_pctile      numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS epa_superfund_pctile numeric;

-- USGS Seismic
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS usgs_pga           numeric;   -- peak ground acceleration
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS usgs_seismic_risk  text;      -- Minimal|Low-Moderate|Moderate|High

-- AirNow AQI
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS airnow_aqi           numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS airnow_aqi_category  text;

-- BLS Unemployment
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS bls_state_unemployment  numeric;

-- v3 composite category scores (0–100)
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS v3_location_score     numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS v3_market_score       numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS v3_risk_score         numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS v3_rental_score       numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS v3_trajectory_score   numeric;
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS v3_enriched_at        timestamptz;

-- ────────────────────────────────────────────────────────────
-- C: PROPERTY REPORTS — enrichment_data + category score columns
-- ────────────────────────────────────────────────────────────

-- Full enrichment object (populated by enrich-property.js fire-and-forget)
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS enrichment_data  jsonb;

-- Denormalized category scores for fast dashboard queries
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS v3_dna_score           numeric;
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS v3_dna_grade           text;
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS v3_location_score      numeric;
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS v3_market_score        numeric;
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS v3_risk_score          numeric;
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS v3_rental_score        numeric;
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS v3_trajectory_score    numeric;
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS v3_condition_score     numeric;
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS v3_prestige_score      numeric;
ALTER TABLE property_reports ADD COLUMN IF NOT EXISTS v3_confidence_overall  numeric;

CREATE INDEX IF NOT EXISTS property_reports_v3_score_idx ON property_reports(v3_dna_score DESC);

-- ────────────────────────────────────────────────────────────
-- D: RLS for new tables
-- ────────────────────────────────────────────────────────────

ALTER TABLE report_data_sources ENABLE ROW LEVEL SECURITY;

-- No anonymous access to raw API responses
DROP POLICY IF EXISTS "rds_anon_select" ON report_data_sources;
CREATE POLICY "rds_anon_select"
  ON report_data_sources FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "rds_anon_insert" ON report_data_sources;
CREATE POLICY "rds_anon_insert"
  ON report_data_sources FOR INSERT TO anon WITH CHECK (false);
