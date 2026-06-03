-- ============================================================
-- PropertyDNA — Open House Leads
-- One row per QR/web open-house sign-in. Drives the 8-touch
-- Tom Ferry-style follow-up cadence run by
-- netlify/functions/open-house-followup.js (hourly cron).
-- ============================================================

CREATE TABLE IF NOT EXISTS open_house_leads (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identity
  email              text        NOT NULL,
  phone              text,
  first_name         text,
  last_name          text,

  -- Property + agent
  property_slug      text,
  property_address   text,
  community          text,
  agent              text        DEFAULT 'daniel',
  campaign           text,
  lead_source        text        DEFAULT 'qr_open_house',

  -- Intent
  working_with_agent text,
  buyer_timeline     text,
  interest           text,
  message            text,

  -- Tracking
  utm_source         text,
  utm_medium         text,
  utm_campaign       text,
  page_url           text,
  user_agent         text,
  referrer           text,

  -- Cadence state (Tom Ferry 8-touch)
  -- step 0 = instant send done; cron starts at step 1 (T+24h SMS)
  follow_up_step     integer     DEFAULT 0,
  follow_up_sent_at  timestamptz,
  last_event         text,
  status             text        DEFAULT 'active',   -- active | unsubscribed | converted | bounced

  -- Replies / engagement
  sms_replied_at     timestamptz,
  email_opened_at    timestamptz,
  email_clicked_at   timestamptz,
  unsubscribed_at    timestamptz,

  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oh_leads_email_idx     ON open_house_leads(email);
CREATE INDEX IF NOT EXISTS oh_leads_property_idx  ON open_house_leads(property_slug);
CREATE INDEX IF NOT EXISTS oh_leads_step_idx      ON open_house_leads(follow_up_step, status);
CREATE INDEX IF NOT EXISTS oh_leads_created_idx   ON open_house_leads(created_at DESC);

CREATE OR REPLACE TRIGGER open_house_leads_updated_at
  BEFORE UPDATE ON open_house_leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: anon can INSERT (for /open-house form) but cannot read others.
ALTER TABLE open_house_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oh_leads_anon_insert" ON open_house_leads;
CREATE POLICY "oh_leads_anon_insert"
  ON open_house_leads FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "oh_leads_anon_select" ON open_house_leads;
CREATE POLICY "oh_leads_anon_select"
  ON open_house_leads FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "oh_leads_service_all" ON open_house_leads;
CREATE POLICY "oh_leads_service_all"
  ON open_house_leads FOR ALL TO service_role USING (true) WITH CHECK (true);
