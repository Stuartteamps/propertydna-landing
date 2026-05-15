-- ============================================================================
-- Migration 020: Dossier Requests (lead capture from luxury pages)
-- ============================================================================

CREATE TABLE IF NOT EXISTS dossier_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apn             TEXT REFERENCES property_master(apn) ON DELETE SET NULL,
  source_page     TEXT NOT NULL,
  property_address TEXT,
  full_name       TEXT,
  email           TEXT NOT NULL,
  phone           TEXT,
  role            TEXT,
  message         TEXT,
  pedigree_tier   TEXT,
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  status          TEXT DEFAULT 'new',
  notified        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN dossier_requests.role IS 'owner | agent | buyer | broker | press | other';
COMMENT ON COLUMN dossier_requests.status IS 'new | contacted | qualified | closed_won | closed_lost';

CREATE INDEX IF NOT EXISTS idx_dossier_requests_status ON dossier_requests(status);
CREATE INDEX IF NOT EXISTS idx_dossier_requests_apn ON dossier_requests(apn);
CREATE INDEX IF NOT EXISTS idx_dossier_requests_created ON dossier_requests(created_at DESC);

ALTER TABLE dossier_requests ENABLE ROW LEVEL SECURITY;

-- Anon can INSERT (lead capture) but not read
DROP POLICY IF EXISTS "dossier_requests_anon_insert" ON dossier_requests;
CREATE POLICY "dossier_requests_anon_insert"
  ON dossier_requests FOR INSERT TO anon, authenticated WITH CHECK (TRUE);

GRANT INSERT ON dossier_requests TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
