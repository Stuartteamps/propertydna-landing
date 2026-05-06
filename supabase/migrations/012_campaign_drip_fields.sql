-- Add drip tracking fields to campaign_contacts
ALTER TABLE campaign_contacts
  ADD COLUMN IF NOT EXISTS follow_up_step    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS follow_up_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_event        TEXT,
  ADD COLUMN IF NOT EXISTS sent_at           TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_cc_follow_up ON campaign_contacts(follow_up_step, status, sent_at);
