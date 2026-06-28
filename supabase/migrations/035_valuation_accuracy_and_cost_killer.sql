-- 035_valuation_accuracy_and_cost_killer.sql
-- ADDITIVE / NON-DESTRUCTIVE. Three internal tables that unblock:
--   1. valuation_accuracy_log — ground-truth accuracy tracking (the prerequisite
--      for measuring the accuracy target AND for safely shadow-killing RentCast).
--   2. comp_sets — persisted comp records (community-match + weight) so we can
--      rank community-first and reuse comps instead of re-fetching from RentCast.
--   3. public_data_cache — cache for the free public-data APIs (FRED/BLS/NOAA/...).
-- RLS is enabled with no public policy -> service-role only (Netlify functions).
-- No existing table, column, or row is modified. Fully reversible (DROP TABLE).

-- 1. Valuation accuracy log (append-only) ------------------------------------
CREATE TABLE IF NOT EXISTS valuation_accuracy_log (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id                 UUID REFERENCES property_reports(id),
  address                   TEXT,
  run_date                  TIMESTAMPTZ DEFAULT now(),
  -- valuation engine outputs
  adj_mid                   BIGINT,
  adj_low                   BIGINT,
  adj_high                  BIGINT,
  raw_mid                   BIGINT,     -- AVM before adjustments
  smart_mid                 BIGINT,     -- after sale/comp anchor
  confidence                NUMERIC(4,2),
  accuracy_percent_internal NUMERIC(5,1),
  avm_delta_pct             NUMERIC(6,2),
  property_type             TEXT,
  community_tier            TEXT,       -- S/A/B
  luxury_tier               BOOLEAN,
  valuation_method          TEXT,
  -- ground truth (backfilled from property_history sale events)
  ground_truth_price        BIGINT,
  ground_truth_date         DATE,
  -- computed accuracy
  ape NUMERIC(6,2) GENERATED ALWAYS AS (
    CASE WHEN ground_truth_price > 0 AND adj_mid IS NOT NULL
         THEN ABS(adj_mid::NUMERIC - ground_truth_price) / ground_truth_price * 100
         ELSE NULL END) STORED,
  within_5pct BOOLEAN GENERATED ALWAYS AS (
    CASE WHEN ground_truth_price > 0 AND adj_mid IS NOT NULL
         THEN ABS(adj_mid::NUMERIC - ground_truth_price) / ground_truth_price < 0.05
         ELSE NULL END) STORED,
  within_10pct BOOLEAN GENERATED ALWAYS AS (
    CASE WHEN ground_truth_price > 0 AND adj_mid IS NOT NULL
         THEN ABS(adj_mid::NUMERIC - ground_truth_price) / ground_truth_price < 0.10
         ELSE NULL END) STORED
);
CREATE INDEX IF NOT EXISTS idx_val_acc_report ON valuation_accuracy_log (report_id);
CREATE INDEX IF NOT EXISTS idx_val_acc_tier   ON valuation_accuracy_log (community_tier, property_type);

CREATE OR REPLACE VIEW valuation_accuracy_summary AS
SELECT
  property_type,
  community_tier,
  COUNT(*)                                          AS sample_count,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ape)  AS mdape,
  ROUND(AVG(CASE WHEN within_5pct  THEN 1.0 ELSE 0.0 END) * 100, 1) AS pct_within_5,
  ROUND(AVG(CASE WHEN within_10pct THEN 1.0 ELSE 0.0 END) * 100, 1) AS pct_within_10,
  ROUND(AVG(ape), 2)                                AS mean_ape,
  MIN(ape)                                          AS min_ape,
  MAX(ape)                                          AS max_ape
FROM valuation_accuracy_log
WHERE ape IS NOT NULL
GROUP BY property_type, community_tier
ORDER BY mdape DESC;

-- 2. Persisted comp sets -----------------------------------------------------
CREATE TABLE IF NOT EXISTS comp_sets (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  apn               text        REFERENCES property_master(apn) ON DELETE CASCADE,
  address           text        NOT NULL,
  valuation_run_id  uuid,
  comp_type         text        NOT NULL CHECK (comp_type IN ('sale','rental','listing')),
  comp_apn          text,
  comp_address      text        NOT NULL,
  comp_city         text,
  comp_zip          text,
  comp_lat          numeric,
  comp_lng          numeric,
  comp_price        numeric     NOT NULL,
  comp_sqft         numeric,
  comp_beds         numeric,
  comp_baths        numeric,
  comp_year_built   integer,
  comp_ppsf         numeric     GENERATED ALWAYS AS (
    CASE WHEN comp_sqft > 0 THEN comp_price / comp_sqft ELSE NULL END) STORED,
  comp_sale_date    date,
  comp_dom          integer,
  distance_miles    numeric,
  community_match   boolean     DEFAULT false,
  tier_match        text,
  similarity_score  numeric,
  weight            numeric     DEFAULT 1.0,
  source            text        NOT NULL DEFAULT 'rentcast',
  raw_data          jsonb       DEFAULT '{}'::jsonb,
  selected_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comp_sets_apn ON comp_sets (apn);
CREATE INDEX IF NOT EXISTS idx_comp_sets_run ON comp_sets (valuation_run_id);

-- 3. Public-data cache -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public_data_cache (
  cache_key   text PRIMARY KEY,
  source      text NOT NULL,
  data        jsonb NOT NULL,
  fetched_at  timestamptz DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pdc_expires ON public_data_cache (expires_at);

-- RLS: internal/service-only -------------------------------------------------
ALTER TABLE valuation_accuracy_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE comp_sets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_data_cache      ENABLE ROW LEVEL SECURITY;
