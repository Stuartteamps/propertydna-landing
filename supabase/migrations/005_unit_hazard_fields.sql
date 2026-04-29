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
