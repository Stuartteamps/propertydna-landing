-- ============================================================================
-- Migration 017: Public read access on luxury provenance tables
-- Enables anon SELECT on architects, notable_owners, architect_commissions,
-- provenance_events, and luxury_inventory view so the public dossier page
-- can fetch via the anon key.
-- ============================================================================

ALTER TABLE architects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notable_owners         ENABLE ROW LEVEL SECURITY;
ALTER TABLE architect_commissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE provenance_events      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "luxury_architects_public_read"      ON architects;
DROP POLICY IF EXISTS "luxury_notable_owners_public_read"  ON notable_owners;
DROP POLICY IF EXISTS "luxury_arch_comm_public_read"       ON architect_commissions;
DROP POLICY IF EXISTS "luxury_events_public_read"          ON provenance_events;

CREATE POLICY "luxury_architects_public_read"
  ON architects FOR SELECT TO anon, authenticated USING (TRUE);

CREATE POLICY "luxury_notable_owners_public_read"
  ON notable_owners FOR SELECT TO anon, authenticated USING (TRUE);

CREATE POLICY "luxury_arch_comm_public_read"
  ON architect_commissions FOR SELECT TO anon, authenticated USING (TRUE);

CREATE POLICY "luxury_events_public_read"
  ON provenance_events FOR SELECT TO anon, authenticated USING (TRUE);

GRANT SELECT ON architects, notable_owners, architect_commissions, provenance_events TO anon;
GRANT SELECT ON luxury_inventory TO anon;

NOTIFY pgrst, 'reload schema';
