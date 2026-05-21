-- ============================================================================
-- Migration 021: Ops activity log + daily digest tracking
-- ============================================================================
-- Central log every autonomous agent writes to. Dan's daily digest reads from
-- this; /admin/ops dashboard renders the live feed.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ops_activity_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent            TEXT NOT NULL,
  event_type       TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'ok',
  summary          TEXT,
  metadata         JSONB DEFAULT '{}'::jsonb,
  affected_rows    INTEGER,
  duration_ms      INTEGER,
  error_message    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN ops_activity_log.agent IS
  'reddit | buffer | cc-refresh | dossier-promoter | dossier-seeder | outreach | indexer | dossier-request | other';
COMMENT ON COLUMN ops_activity_log.status IS
  'ok | warning | error | skipped';
COMMENT ON COLUMN ops_activity_log.event_type IS
  'post_sent | promotion_applied | dossier_added | lead_received | refresh_completed | etc';

CREATE INDEX IF NOT EXISTS idx_ops_log_created    ON ops_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_log_agent      ON ops_activity_log(agent);
CREATE INDEX IF NOT EXISTS idx_ops_log_status     ON ops_activity_log(status);

ALTER TABLE ops_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ops_log_owner_read" ON ops_activity_log;
CREATE POLICY "ops_log_owner_read" ON ops_activity_log FOR SELECT
  TO authenticated USING (auth.email() = 'stuartteamps@gmail.com');

GRANT SELECT ON ops_activity_log TO authenticated;

-- Daily digest send tracking — so we don't double-send if cron retries
CREATE TABLE IF NOT EXISTS daily_digest_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_date  DATE NOT NULL UNIQUE,
  sent_at      TIMESTAMPTZ DEFAULT NOW(),
  metrics      JSONB DEFAULT '{}'::jsonb,
  delivery_id  TEXT
);

NOTIFY pgrst, 'reload schema';
