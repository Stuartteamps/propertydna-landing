-- 017_skip_trace_priority_view.sql
-- Skip-trace priority ranking view across all indexed markets.
-- Used to feed PropStream/Tracerfy/CC with the highest-ROI records first.
--
-- Tiers (lower number = higher priority):
--   1 = absentee + $1M+ value
--   2 = absentee + $500k-$1M
--   3 = renovation candidate (eff_yr > act_yr + 10)
--   4 = long-tenure absentee (held 10+ years)
--   5 = multi-property owner (LLC/trust patterns)
--   6 = high-value owner-occupied $750k+
--   7 = all other absentee
--   8 = remaining residential
--
-- Run via: psql / Supabase SQL Editor

CREATE OR REPLACE VIEW v_skip_trace_priority AS
WITH latest_history AS (
  -- Take the most recent property_history row per APN (assessor data)
  SELECT DISTINCT ON (apn)
    apn,
    source,
    event_date,
    data,
    (data->>'ownerName') AS owner_name,
    COALESCE(data->>'coOwner', '') AS co_owner,
    COALESCE(data->>'ownerAddr', data->>'mailingAddr', '') AS mailing_addr,
    COALESCE(data->>'ownerCity', data->>'mailingCity', '') AS mailing_city,
    COALESCE(data->>'ownerState', data->>'mailingState', '') AS mailing_state,
    COALESCE(data->>'ownerZip', data->>'mailingZip', '') AS mailing_zip,
    COALESCE(
      (data->>'justValue')::numeric,
      (data->>'marketValue')::numeric,
      (data->>'assessedValue')::numeric,
      (data->>'assessedTotal')::numeric,
      (data->>'marketTotal')::numeric,
      0
    ) AS market_value,
    COALESCE(
      (data->>'actYearBuilt')::int,
      (data->>'yrBlt')::int,
      (data->>'yearBuilt')::int,
      (data->>'actualYearBuilt')::int,
      0
    ) AS actual_year_built,
    COALESCE(
      (data->>'effYearBuilt')::int,
      (data->>'effectiveYearBuilt')::int,
      (data->>'effectiveYrBuilt')::int,
      0
    ) AS effective_year_built,
    COALESCE((data->>'salePrice')::numeric, (data->>'sale1Price')::numeric, 0) AS last_sale_price,
    COALESCE(data->>'saleDate', data->>'sale1Year') AS last_sale_date,
    (data->>'absentee')::boolean AS absentee
  FROM property_history
  WHERE data->>'ownerName' IS NOT NULL
    AND length(data->>'ownerName') > 2
  ORDER BY apn, event_date DESC, created_at DESC
),
owner_property_count AS (
  -- Count properties per owner name (multi-property investor signal)
  SELECT
    owner_name,
    mailing_state,
    COUNT(*) AS properties_owned
  FROM latest_history
  WHERE owner_name IS NOT NULL
  GROUP BY owner_name, mailing_state
),
enriched AS (
  SELECT
    lh.apn,
    pm.address, pm.city, pm.state, pm.zip, pm.county_fips,
    pm.year_built, pm.sqft, pm.tax_assessed_value,
    lh.source, lh.owner_name, lh.co_owner,
    lh.mailing_addr, lh.mailing_city, lh.mailing_state, lh.mailing_zip,
    lh.market_value, lh.last_sale_price, lh.last_sale_date,
    lh.actual_year_built, lh.effective_year_built,
    -- Compute years held (if we have sale date)
    CASE
      WHEN lh.last_sale_date ~ '^[0-9]{4}' THEN
        EXTRACT(YEAR FROM CURRENT_DATE)::int - LEFT(lh.last_sale_date, 4)::int
      ELSE NULL
    END AS years_held,
    -- Absentee detection: mailing state ≠ property state (or explicit flag)
    CASE
      WHEN lh.absentee IS TRUE THEN TRUE
      WHEN lh.mailing_state != '' AND lh.mailing_state != pm.state THEN TRUE
      ELSE FALSE
    END AS is_absentee,
    -- Renovation signal: effective year built >10 years newer than actual
    CASE
      WHEN lh.effective_year_built > 1800
       AND lh.actual_year_built > 1800
       AND lh.effective_year_built > lh.actual_year_built + 10
      THEN TRUE ELSE FALSE
    END AS renovation_recognized,
    -- Entity owner signal (LLC, Trust, etc.)
    CASE
      WHEN lh.owner_name ~* '\m(LLC|INC|CORP|TRUST|FUND|LP|LIMITED|PARTNERSHIP|ESTATE|HOLDINGS|REALTY)\M'
      THEN TRUE ELSE FALSE
    END AS is_entity_owner,
    opc.properties_owned
  FROM latest_history lh
  JOIN property_master pm ON pm.apn = lh.apn
  LEFT JOIN owner_property_count opc
    ON opc.owner_name = lh.owner_name AND opc.mailing_state = lh.mailing_state
)
SELECT
  apn, address, city, state, zip, county_fips, source,
  owner_name, co_owner,
  mailing_addr, mailing_city, mailing_state, mailing_zip,
  market_value, tax_assessed_value,
  last_sale_price, last_sale_date, years_held,
  actual_year_built, effective_year_built,
  is_absentee, renovation_recognized, is_entity_owner, properties_owned,

  -- Priority tier (1 = highest ROI for skip-trace spend)
  CASE
    WHEN is_absentee AND market_value >= 1000000                       THEN 1  -- absentee luxury
    WHEN is_absentee AND market_value >= 500000                        THEN 2  -- absentee high
    WHEN renovation_recognized AND market_value >= 750000              THEN 3  -- recent reno + value
    WHEN is_absentee AND years_held >= 10                              THEN 4  -- long-tenure absentee
    WHEN properties_owned >= 3                                         THEN 5  -- multi-property investor
    WHEN market_value >= 750000 AND NOT is_absentee                    THEN 6  -- owner-occupied luxury
    WHEN is_absentee                                                   THEN 7  -- other absentee
    ELSE 8                                                                       -- everything else
  END AS priority_tier,

  -- Tier label for human readability
  CASE
    WHEN is_absentee AND market_value >= 1000000              THEN 'T1: Absentee Luxury ($1M+)'
    WHEN is_absentee AND market_value >= 500000               THEN 'T2: Absentee High Value ($500k-$1M)'
    WHEN renovation_recognized AND market_value >= 750000     THEN 'T3: Renovated Premium'
    WHEN is_absentee AND years_held >= 10                     THEN 'T4: Long-Tenure Absentee'
    WHEN properties_owned >= 3                                THEN 'T5: Multi-Property Investor'
    WHEN market_value >= 750000 AND NOT is_absentee           THEN 'T6: Owner-Occupied Luxury'
    WHEN is_absentee                                          THEN 'T7: Other Absentee'
    ELSE                                                           'T8: Residential'
  END AS tier_label

FROM enriched;

-- Helpful index for filtering this view
CREATE INDEX IF NOT EXISTS idx_property_history_owner_name
  ON property_history ((data->>'ownerName')) WHERE data->>'ownerName' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_property_history_market_value
  ON property_history (((data->>'justValue')::numeric))
  WHERE (data->>'justValue') IS NOT NULL;

-- Stats helper: tier breakdown
CREATE OR REPLACE VIEW v_skip_trace_tier_summary AS
SELECT
  priority_tier, tier_label,
  COUNT(*) AS record_count,
  COUNT(DISTINCT state) AS states_covered,
  ROUND(AVG(market_value)::numeric, 0) AS avg_market_value,
  ROUND(SUM(market_value)::numeric, 0) AS total_market_value
FROM v_skip_trace_priority
GROUP BY priority_tier, tier_label
ORDER BY priority_tier;

-- Granted access
GRANT SELECT ON v_skip_trace_priority TO anon, authenticated, service_role;
GRANT SELECT ON v_skip_trace_tier_summary TO anon, authenticated, service_role;
