-- ============================================================================
-- Migration 018: Pedigree Classification for All Coachella Valley Inventory
-- ============================================================================
-- Classifies every property by pedigree tier:
--   A — Verified provenance dossier (architect attribution OR celebrity owner)
--   B — Named luxury neighborhood + MCM-era + premium value
--   C — Named luxury neighborhood OR MCM-era + decent value
--   D — Any property in MCM-era PS (1945-1985)
--   ungraded — everything else
-- ============================================================================

ALTER TABLE property_master
  ADD COLUMN IF NOT EXISTS pedigree_tier        TEXT,
  ADD COLUMN IF NOT EXISTS pedigree_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS pedigree_factors      JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_property_master_pedigree
  ON property_master(pedigree_tier) WHERE pedigree_tier IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_property_master_pedigree_neighborhood
  ON property_master(pedigree_neighborhood) WHERE pedigree_neighborhood IS NOT NULL;

COMMENT ON COLUMN property_master.pedigree_tier IS
  'A | B | C | D | ungraded — classification of architectural/cultural pedigree';
COMMENT ON COLUMN property_master.pedigree_neighborhood IS
  'Named luxury neighborhood — Movie Colony, Old Las Palmas, Las Palmas, Vista Las Palmas, The Mesa, Indian Canyons, Smoke Tree Ranch, Andreas Hills, Tahquitz River Estates';

-- Public read access for the pedigree fields
GRANT SELECT ON property_master TO anon;
NOTIFY pgrst, 'reload schema';
