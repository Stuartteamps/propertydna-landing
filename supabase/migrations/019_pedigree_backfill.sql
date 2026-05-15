-- ============================================================================
-- Migration 019: Pedigree Tier Backfill (Coachella Valley)
-- ============================================================================
-- Classifies every Coachella Valley property by pedigree tier in one pass.
-- ============================================================================

-- ── Step 1: Assign neighborhoods by street pattern + city ──────────────────
UPDATE property_master SET pedigree_neighborhood = 'Smoke Tree Ranch'
WHERE city ILIKE 'palm springs'
  AND (address ILIKE '%smoke tree%' OR address ILIKE '%toledo%');

UPDATE property_master SET pedigree_neighborhood = 'Movie Colony'
WHERE city ILIKE 'palm springs'
  AND pedigree_neighborhood IS NULL
  AND (address ILIKE '%alejo%' OR address ILIKE '%tamarisk%' OR address ILIKE '%hermosa%'
       OR address ILIKE '%avenida caballeros%' OR address ILIKE '%paseo%'
       OR address ILIKE '%patencio%' OR address ILIKE '%cahuilla%' OR address ILIKE '%vista chino%');

UPDATE property_master SET pedigree_neighborhood = 'Old Las Palmas'
WHERE city ILIKE 'palm springs'
  AND pedigree_neighborhood IS NULL
  AND (address ILIKE '%belardo%' OR address ILIKE '%via lola%' OR address ILIKE '%via miraleste%'
       OR address ILIKE '%camino real%' OR address ILIKE '%stevens%' OR address ILIKE '%n indian canyon%');

UPDATE property_master SET pedigree_neighborhood = 'Vista Las Palmas'
WHERE city ILIKE 'palm springs'
  AND pedigree_neighborhood IS NULL
  AND (address ILIKE '%avenida olancha%' OR address ILIKE '%camino sur%'
       OR address ILIKE '%avenida palmera%' OR address ILIKE '%avenida sevilla%'
       OR address ILIKE '%abrigo%' OR address ILIKE '%escoba%' OR address ILIKE '%farrell%');

UPDATE property_master SET pedigree_neighborhood = 'The Mesa'
WHERE city ILIKE 'palm springs'
  AND pedigree_neighborhood IS NULL
  AND (address ILIKE '%camino norte%' OR address ILIKE '%la mirada%'
       OR address ILIKE '%skyway%' OR address ILIKE '%crestview%' OR address ILIKE '%mesa rd%'
       OR address ILIKE '%palmas%' OR address ILIKE '%paseo el mirador%');

UPDATE property_master SET pedigree_neighborhood = 'Indian Canyons'
WHERE city ILIKE 'palm springs'
  AND pedigree_neighborhood IS NULL
  AND (address ILIKE '%andreas hills%' OR address ILIKE '%andreas canyon%'
       OR address ILIKE '%ridge mountain%' OR address ILIKE '%indian canyon dr%'
       OR address ILIKE '%cherokee%' OR address ILIKE '%murray canyon%');

UPDATE property_master SET pedigree_neighborhood = 'Tahquitz River Estates'
WHERE city ILIKE 'palm springs'
  AND pedigree_neighborhood IS NULL
  AND (address ILIKE '%tahquitz%' OR address ILIKE '%calle palo%'
       OR address ILIKE '%mesquite%' OR address ILIKE '%baristo%');

UPDATE property_master SET pedigree_neighborhood = 'Racquet Club Estates'
WHERE city ILIKE 'palm springs'
  AND pedigree_neighborhood IS NULL
  AND (address ILIKE '%racquet club%' OR address ILIKE '%caballeros%'
       OR address ILIKE '%avenida granada%' OR address ILIKE '%avenida cordoba%');

UPDATE property_master SET pedigree_neighborhood = 'Twin Palms'
WHERE city ILIKE 'palm springs'
  AND pedigree_neighborhood IS NULL
  AND (address ILIKE '%twin palms%' OR address ILIKE '%apache%' OR address ILIKE '%navajo%');

-- Rancho Mirage celebrity strip
UPDATE property_master SET pedigree_neighborhood = 'Thunderbird Heights'
WHERE city ILIKE 'rancho mirage'
  AND pedigree_neighborhood IS NULL
  AND (address ILIKE '%thunderbird%' OR address ILIKE '%frank sinatra%');

UPDATE property_master SET pedigree_neighborhood = 'Tamarisk Country Club'
WHERE city ILIKE 'rancho mirage'
  AND pedigree_neighborhood IS NULL
  AND address ILIKE '%tamarisk%';

UPDATE property_master SET pedigree_neighborhood = 'Mission Hills'
WHERE city ILIKE 'rancho mirage'
  AND pedigree_neighborhood IS NULL
  AND address ILIKE '%mission hills%';

-- ── Step 2: Tier A — already has a provenance dossier ──────────────────────
UPDATE property_master
SET pedigree_tier = 'A',
    pedigree_factors = pedigree_factors || jsonb_build_object(
      'reason', 'verified_provenance_dossier',
      'has_architect', architect_verified,
      'provenance_score', provenance_score
    )
WHERE has_provenance_dossier = TRUE;

-- ── Step 3: Tier B — named luxury neighborhood + MCM era + premium value ──
UPDATE property_master
SET pedigree_tier = 'B',
    pedigree_factors = pedigree_factors || jsonb_build_object(
      'reason', 'named_neighborhood_mcm_era_premium_value',
      'neighborhood', pedigree_neighborhood,
      'mcm_era', year_built BETWEEN 1947 AND 1975
    )
WHERE pedigree_tier IS NULL
  AND pedigree_neighborhood IN ('Movie Colony','Old Las Palmas','Las Palmas',
                                 'Vista Las Palmas','The Mesa','Indian Canyons',
                                 'Smoke Tree Ranch','Thunderbird Heights')
  AND year_built BETWEEN 1947 AND 1985
  AND luxury_tier IN ('premium','luxury','super_luxury','ultra_luxury','trophy');

-- ── Step 4: Tier C — named neighborhood (any era) OR MCM era + decent value ─
UPDATE property_master
SET pedigree_tier = 'C',
    pedigree_factors = pedigree_factors || jsonb_build_object(
      'reason', 'named_neighborhood_or_mcm_era',
      'neighborhood', pedigree_neighborhood
    )
WHERE pedigree_tier IS NULL
  AND (
    pedigree_neighborhood IS NOT NULL
    OR (year_built BETWEEN 1947 AND 1975 AND city ILIKE 'palm springs' AND luxury_tier IN ('premium','luxury','super_luxury','ultra_luxury','trophy'))
  );

-- ── Step 5: Tier D — MCM-era PS or premium+ value anywhere in CV ──────────
UPDATE property_master
SET pedigree_tier = 'D',
    pedigree_factors = pedigree_factors || jsonb_build_object(
      'reason', 'mcm_era_or_premium_value'
    )
WHERE pedigree_tier IS NULL
  AND (
    (year_built BETWEEN 1947 AND 1985 AND city ILIKE 'palm springs')
    OR luxury_tier IN ('luxury','super_luxury','ultra_luxury','trophy')
  );

-- ── Step 6: Summary ───────────────────────────────────────────────────────
SELECT
  COALESCE(pedigree_tier, 'ungraded') AS tier,
  COUNT(*) AS properties,
  COUNT(*) FILTER (WHERE pedigree_neighborhood IS NOT NULL) AS in_named_neighborhood
FROM property_master
WHERE city ILIKE ANY (ARRAY['palm springs','rancho mirage','palm desert','indian wells','la quinta','cathedral city'])
GROUP BY 1
ORDER BY
  CASE COALESCE(pedigree_tier, 'ungraded')
    WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 WHEN 'D' THEN 4 ELSE 5
  END;

-- Neighborhood breakdown
SELECT pedigree_neighborhood, COUNT(*) AS properties
FROM property_master
WHERE pedigree_neighborhood IS NOT NULL
GROUP BY 1
ORDER BY 2 DESC;
