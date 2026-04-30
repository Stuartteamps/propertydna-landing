-- Migration 008: Backfill view_token for legacy reports table rows
-- Allows legacy reports to be accessed via /report/view/{token} URL

-- Add view_token column to reports table if it doesn't exist
ALTER TABLE reports ADD COLUMN IF NOT EXISTS view_token uuid;

-- Generate view_token for all legacy reports that don't have one
UPDATE reports
SET view_token = gen_random_uuid()
WHERE view_token IS NULL;

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_reports_view_token ON reports(view_token);

-- Create index for email + created_at lookups (used by get-reports)
CREATE INDEX IF NOT EXISTS idx_reports_email_created ON reports(email, created_at DESC);

-- Also ensure property_reports has index for token lookups
CREATE INDEX IF NOT EXISTS idx_property_reports_view_token ON property_reports(view_token);
CREATE INDEX IF NOT EXISTS idx_property_reports_email ON property_reports(email, created_at DESC);
