-- ============================================================================
-- Migration 013: Luxury Provenance Intelligence
-- ============================================================================
-- Adds luxury tier classification, architect attribution, and provenance
-- documentation for the $5M+ luxury home segment.
--
-- Strategic positioning: Barrett-Jackson dossier methodology applied to
-- architecturally significant residential real estate.
-- ============================================================================

-- ── 1. Luxury markers on property_master ───────────────────────────────────
ALTER TABLE property_master
  ADD COLUMN IF NOT EXISTS luxury_tier              TEXT,
  ADD COLUMN IF NOT EXISTS luxury_value_basis       NUMERIC,
  ADD COLUMN IF NOT EXISTS architect_id             UUID,
  ADD COLUMN IF NOT EXISTS architect_attribution    TEXT,
  ADD COLUMN IF NOT EXISTS architect_verified       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS architectural_significance_score NUMERIC,
  ADD COLUMN IF NOT EXISTS provenance_score         NUMERIC,
  ADD COLUMN IF NOT EXISTS has_provenance_dossier   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS scarcity_index           NUMERIC;

-- Luxury tier is computed from assessed/market value:
--   standard     : < $2M
--   premium      : $2M - $5M
--   luxury       : $5M - $10M
--   super_luxury : $10M - $30M
--   ultra_luxury : $30M - $50M
--   trophy       : > $50M
COMMENT ON COLUMN property_master.luxury_tier IS
  'standard | premium | luxury | super_luxury | ultra_luxury | trophy';

CREATE INDEX IF NOT EXISTS idx_property_master_luxury_tier
  ON property_master(luxury_tier) WHERE luxury_tier IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_property_master_architect
  ON property_master(architect_id) WHERE architect_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_property_master_dossier
  ON property_master(has_provenance_dossier) WHERE has_provenance_dossier = TRUE;

-- ── 2. Architects catalog ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS architects (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT NOT NULL UNIQUE,
  birth_year               INTEGER,
  death_year               INTEGER,
  primary_style            TEXT,
  primary_market           TEXT,
  bio                      TEXT,
  notable_works            JSONB DEFAULT '[]'::jsonb,
  verified_commissions     INTEGER DEFAULT 0,
  trade_frequency_years    NUMERIC,
  signature_features       JSONB DEFAULT '[]'::jsonb,
  archive_sources          JSONB DEFAULT '[]'::jsonb,
  reputation_tier          TEXT DEFAULT 'documented',
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN architects.reputation_tier IS
  'iconic | major | documented | regional';
COMMENT ON COLUMN architects.trade_frequency_years IS
  'Average years between sales of comparable architect-attributed works';

-- Foreign key from property_master to architects
ALTER TABLE property_master
  ADD CONSTRAINT IF NOT EXISTS fk_property_master_architect
  FOREIGN KEY (architect_id) REFERENCES architects(id) ON DELETE SET NULL;

-- ── 3. Notable owners (celebrity provenance) ──────────────────────────────
CREATE TABLE IF NOT EXISTS notable_owners (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apn                      TEXT NOT NULL REFERENCES property_master(apn) ON DELETE CASCADE,
  owner_name               TEXT NOT NULL,
  owner_role               TEXT,
  ownership_start          DATE,
  ownership_end            DATE,
  verification_status      TEXT NOT NULL DEFAULT 'unverified',
  verification_sources     JSONB DEFAULT '[]'::jsonb,
  notable_events           JSONB DEFAULT '[]'::jsonb,
  primary_source_count     INTEGER DEFAULT 0,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN notable_owners.verification_status IS
  'verified | partial | claimed_unverified | refuted';
COMMENT ON COLUMN notable_owners.owner_role IS
  'actor | musician | politician | businessperson | athlete | royalty | other';

CREATE INDEX IF NOT EXISTS idx_notable_owners_apn ON notable_owners(apn);
CREATE INDEX IF NOT EXISTS idx_notable_owners_status ON notable_owners(verification_status);

-- ── 4. Provenance events (films, press, historic events) ──────────────────
CREATE TABLE IF NOT EXISTS provenance_events (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apn                      TEXT NOT NULL REFERENCES property_master(apn) ON DELETE CASCADE,
  event_type               TEXT NOT NULL,
  event_date               DATE,
  event_year               INTEGER,
  title                    TEXT,
  description              TEXT,
  source_publication       TEXT,
  source_url               TEXT,
  verification_status      TEXT DEFAULT 'unverified',
  metadata                 JSONB DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN provenance_events.event_type IS
  'film_shot | press_feature | historic_visit | architectural_award | restoration | photographed_for';

CREATE INDEX IF NOT EXISTS idx_provenance_events_apn ON provenance_events(apn);
CREATE INDEX IF NOT EXISTS idx_provenance_events_type ON provenance_events(event_type);

-- ── 5. Architect commissions (attribution links) ──────────────────────────
CREATE TABLE IF NOT EXISTS architect_commissions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apn                      TEXT REFERENCES property_master(apn) ON DELETE CASCADE,
  architect_id             UUID NOT NULL REFERENCES architects(id) ON DELETE CASCADE,
  commission_year          INTEGER,
  attribution_strength     TEXT NOT NULL DEFAULT 'unverified',
  primary_source_drawings  BOOLEAN DEFAULT FALSE,
  primary_source_permit    BOOLEAN DEFAULT FALSE,
  primary_source_press     BOOLEAN DEFAULT FALSE,
  source_archives          JSONB DEFAULT '[]'::jsonb,
  notes                    TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN architect_commissions.attribution_strength IS
  'verified | strong | partial | claimed | refuted';

CREATE INDEX IF NOT EXISTS idx_architect_commissions_apn ON architect_commissions(apn);
CREATE INDEX IF NOT EXISTS idx_architect_commissions_architect ON architect_commissions(architect_id);

-- ── 6. Computed view: luxury inventory with full dossier flag ────────────
CREATE OR REPLACE VIEW luxury_inventory AS
SELECT
  pm.apn,
  pm.address,
  pm.city,
  pm.state,
  pm.luxury_tier,
  pm.luxury_value_basis,
  pm.architect_attribution,
  pm.architect_verified,
  pm.architectural_significance_score,
  pm.provenance_score,
  pm.has_provenance_dossier,
  a.name AS architect_name,
  a.reputation_tier AS architect_tier,
  (SELECT COUNT(*) FROM notable_owners no WHERE no.apn = pm.apn AND no.verification_status = 'verified') AS verified_celebrity_owners,
  (SELECT COUNT(*) FROM provenance_events pe WHERE pe.apn = pm.apn) AS provenance_event_count,
  pm.year_built,
  pm.sqft,
  pm.lot_sqft,
  pm.tax_assessed_value
FROM property_master pm
LEFT JOIN architects a ON pm.architect_id = a.id
WHERE pm.luxury_tier IS NOT NULL
  AND pm.luxury_tier IN ('luxury','super_luxury','ultra_luxury','trophy');

-- ============================================================================
-- End migration 013
-- ============================================================================
