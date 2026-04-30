-- ============================================================
-- PropertyDNA — Migration 010: Indexing Queue + Property Master Columns
--
-- 1. indexing_jobs — tracks city-level indexing progress
-- 2. energov_endpoint_log — monitors which EnerGov endpoints are live
-- 3. Expand property_master with all assessor + EnerGov columns
-- ============================================================

-- ── 1. Indexing jobs table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS indexing_jobs (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  city         text        NOT NULL UNIQUE,
  offset       integer     NOT NULL DEFAULT 0,
  total        integer,
  status       text        NOT NULL DEFAULT 'queued',  -- queued | in_progress | completed | paused
  started_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  completed_at timestamptz,
  notes        text
);

CREATE INDEX IF NOT EXISTS idx_indexing_jobs_city   ON indexing_jobs(city);
CREATE INDEX IF NOT EXISTS idx_indexing_jobs_status ON indexing_jobs(status);

-- Seed the city queue in processing order
INSERT INTO indexing_jobs (city, status) VALUES
  ('PALM SPRINGS',       'queued'),
  ('RANCHO MIRAGE',      'queued'),
  ('INDIAN WELLS',       'queued'),
  ('LA QUINTA',          'queued'),
  ('PALM DESERT',        'queued'),
  ('CATHEDRAL CITY',     'queued'),
  ('DESERT HOT SPRINGS', 'queued'),
  ('INDIO',              'queued'),
  ('COACHELLA',          'queued')
ON CONFLICT (city) DO NOTHING;

-- ── 2. EnerGov endpoint health log ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS energov_endpoint_log (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  city         text,
  host         text,
  address      text,
  succeeded    boolean,
  pattern_used integer,
  attempts     jsonb,
  permit_count integer     DEFAULT 0,
  logged_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_energov_log_city    ON energov_endpoint_log(city, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_energov_log_success ON energov_endpoint_log(succeeded, logged_at DESC);

-- ── 3. Expand property_master with all assessor + EnerGov data ────────────────

-- Assessor property characteristics
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS has_pool              boolean;
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS has_fairway           boolean;
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS is_waterfront         boolean;
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS quality_code          text;
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS stories               integer;
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS has_fireplace         boolean;
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS has_central_cooling   boolean;

-- Assessor valuation
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS assessor_land_value      numeric;
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS assessor_improvement_val numeric;
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS assessor_total_value     numeric;
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS assessor_last_updated    integer;

-- Proprietary DNA Permit Score (computed from assessor data)
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS pdna_renovation_ratio   numeric;
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS pdna_condition_score     integer;
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS pdna_reassessment_year  integer;
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS pdna_detected_features  jsonb;
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS pdna_data_quality       text;
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS pdna_scored_at          timestamptz;

-- EnerGov live permit data (cached when successfully fetched)
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS energov_permits         jsonb;
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS energov_adjustments     jsonb;
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS energov_fetched_at      timestamptz;
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS energov_pattern_used    integer;

-- Indexing metadata
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS indexed_at              timestamptz;
ALTER TABLE property_master ADD COLUMN IF NOT EXISTS index_source            text;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS pm_city_idx       ON property_master(city) WHERE city IS NOT NULL;
CREATE INDEX IF NOT EXISTS pm_zip_idx        ON property_master(zip)  WHERE zip  IS NOT NULL;
CREATE INDEX IF NOT EXISTS pm_pool_idx       ON property_master(has_pool) WHERE has_pool = true;
CREATE INDEX IF NOT EXISTS pm_fairway_idx    ON property_master(has_fairway) WHERE has_fairway = true;
CREATE INDEX IF NOT EXISTS pm_condition_idx  ON property_master(pdna_condition_score);
CREATE INDEX IF NOT EXISTS pm_renov_idx      ON property_master(pdna_renovation_ratio);
CREATE INDEX IF NOT EXISTS pm_indexed_at_idx ON property_master(indexed_at DESC);

-- ── 4. RLS policies ───────────────────────────────────────────────────────────

ALTER TABLE indexing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE energov_endpoint_log ENABLE ROW LEVEL SECURITY;

-- Service key (used by Netlify functions) bypasses RLS — no policies needed
-- Public read for property_master (needed for report enrichment)
DROP POLICY IF EXISTS pm_public_read ON property_master;
CREATE POLICY pm_public_read ON property_master FOR SELECT USING (true);
