-- ============================================================
-- PropertyDNA — PASTE THIS ENTIRE FILE INTO SUPABASE SQL EDITOR
-- https://app.supabase.com/project/neccpdfhmfnvyjgyrysy/sql/new
-- ============================================================

-- Clear any conflicting pre-existing policies (safe — service role bypasses RLS anyway)
DROP POLICY IF EXISTS "Allow public insert reports"     ON reports;
DROP POLICY IF EXISTS "Allow public select reports"     ON reports;
DROP POLICY IF EXISTS "Allow public update reports"     ON reports;
DROP POLICY IF EXISTS "Allow public delete reports"     ON reports;
DROP POLICY IF EXISTS "Enable insert for all users"     ON reports;
DROP POLICY IF EXISTS "Enable read access for all users" ON reports;
DROP POLICY IF EXISTS "Enable all for authenticated"    ON reports;


-- ──────────────────────────────────────────────────────────────
-- PART 1: TABLES
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email               text        UNIQUE NOT NULL,
  full_name           text,
  phone               text,
  stripe_customer_id  text        UNIQUE,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                      uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id              uuid        REFERENCES profiles(id) ON DELETE CASCADE,
  email                   text        NOT NULL,
  stripe_subscription_id  text        UNIQUE,
  stripe_customer_id      text,
  stripe_price_id         text,
  plan_name               text        NOT NULL DEFAULT 'monthly',
  status                  text        NOT NULL DEFAULT 'inactive',
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean     DEFAULT false,
  canceled_at             timestamptz,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_email_idx  ON subscriptions(email);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_idx ON subscriptions(stripe_subscription_id);

CREATE TABLE IF NOT EXISTS payments (
  id                       uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id               uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  email                    text        NOT NULL,
  stripe_payment_intent_id text        UNIQUE,
  stripe_session_id        text        UNIQUE,
  stripe_customer_id       text,
  stripe_price_id          text,
  amount                   integer     NOT NULL DEFAULT 0,
  currency                 text        NOT NULL DEFAULT 'usd',
  status                   text        NOT NULL DEFAULT 'pending',
  mode                     text        NOT NULL DEFAULT 'per_report',
  plan_name                text,
  created_at               timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_email_idx   ON payments(email);
CREATE INDEX IF NOT EXISTS payments_status_idx  ON payments(status);
CREATE INDEX IF NOT EXISTS payments_session_idx ON payments(stripe_session_id);

CREATE TABLE IF NOT EXISTS property_reports (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id        uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  email             text        NOT NULL,
  address           text        NOT NULL,
  city              text,
  state             text,
  zip               text,
  full_address      text,
  role              text        DEFAULT 'Buyer',
  report_url        text,
  report_pdf_url    text,
  report_data       jsonb,
  payment_id        uuid        REFERENCES payments(id) ON DELETE SET NULL,
  subscription_id   uuid        REFERENCES subscriptions(id) ON DELETE SET NULL,
  stripe_session_id text,
  status            text        NOT NULL DEFAULT 'pending',
  generation_error  text,
  n8n_request_id    text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS property_reports_email_idx   ON property_reports(email);
CREATE INDEX IF NOT EXISTS property_reports_status_idx  ON property_reports(status);
CREATE INDEX IF NOT EXISTS property_reports_session_idx ON property_reports(stripe_session_id);

CREATE TABLE IF NOT EXISTS leads (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_type        text        NOT NULL,
  email              text        NOT NULL,
  first_name         text,
  last_name          text,
  full_name          text,
  phone              text,
  message            text,
  interest           text,
  buyer_timeline     text,
  seller_timeline    text,
  price_range        text,
  bedrooms           text,
  property_type      text,
  property_address   text,
  community          text,
  working_with_agent text,
  agent              text        DEFAULT 'daniel_stuart',
  utm_source         text,
  qr_source          text,
  page_url           text,
  raw_payload        jsonb,
  created_at         timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leads_email_idx   ON leads(email);
CREATE INDEX IF NOT EXISTS leads_funnel_idx  ON leads(funnel_type);
CREATE INDEX IF NOT EXISTS leads_created_idx ON leads(created_at DESC);

CREATE TABLE IF NOT EXISTS report_searches (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email      text,
  address    text,
  city       text,
  state      text,
  zip        text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_searches_zip_idx  ON report_searches(zip);
CREATE INDEX IF NOT EXISTS report_searches_city_idx ON report_searches(city);

CREATE TABLE IF NOT EXISTS stripe_events (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id  text        UNIQUE NOT NULL,
  event_type       text        NOT NULL,
  data             jsonb       NOT NULL,
  processed        boolean     DEFAULT false,
  error            text,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stripe_events_type_idx ON stripe_events(event_type);
CREATE INDEX IF NOT EXISTS stripe_events_proc_idx ON stripe_events(processed);

CREATE TABLE IF NOT EXISTS kpi_events (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text        NOT NULL,
  email      text,
  value      numeric     DEFAULT 1,
  metadata   jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kpi_events_type_idx    ON kpi_events(event_type);
CREATE INDEX IF NOT EXISTS kpi_events_created_idx ON kpi_events(created_at DESC);

CREATE TABLE IF NOT EXISTS dashboard_activity (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email      text        NOT NULL,
  action     text        NOT NULL,
  report_id  uuid        REFERENCES property_reports(id) ON DELETE SET NULL,
  metadata   jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dashboard_activity_email_idx ON dashboard_activity(email);


-- ──────────────────────────────────────────────────────────────
-- PART 2: TRIGGERS
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER property_reports_updated_at
  BEFORE UPDATE ON property_reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ──────────────────────────────────────────────────────────────
-- PART 3: ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────────

ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_reports   ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_searches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_activity ENABLE ROW LEVEL SECURITY;

-- property_reports: anon SELECT only (dashboard filters by email in app)
DROP POLICY IF EXISTS "reports_anon_select" ON property_reports;
CREATE POLICY "reports_anon_select" ON property_reports FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "reports_anon_insert" ON property_reports;
CREATE POLICY "reports_anon_insert" ON property_reports FOR INSERT TO anon WITH CHECK (false);
DROP POLICY IF EXISTS "reports_anon_update" ON property_reports;
CREATE POLICY "reports_anon_update" ON property_reports FOR UPDATE TO anon USING (false);
DROP POLICY IF EXISTS "reports_anon_delete" ON property_reports;
CREATE POLICY "reports_anon_delete" ON property_reports FOR DELETE TO anon USING (false);

-- profiles: anon read-only
DROP POLICY IF EXISTS "profiles_anon_select" ON profiles;
CREATE POLICY "profiles_anon_select" ON profiles FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "profiles_anon_insert" ON profiles;
CREATE POLICY "profiles_anon_insert" ON profiles FOR INSERT TO anon WITH CHECK (false);
DROP POLICY IF EXISTS "profiles_anon_update" ON profiles;
CREATE POLICY "profiles_anon_update" ON profiles FOR UPDATE TO anon USING (false);

-- report_searches: anon insert only
DROP POLICY IF EXISTS "searches_anon_insert" ON report_searches;
CREATE POLICY "searches_anon_insert" ON report_searches FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "searches_anon_select" ON report_searches;
CREATE POLICY "searches_anon_select" ON report_searches FOR SELECT TO anon USING (false);

-- subscriptions: no anon access
DROP POLICY IF EXISTS "subs_anon_select" ON subscriptions;
CREATE POLICY "subs_anon_select" ON subscriptions FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS "subs_anon_insert" ON subscriptions;
CREATE POLICY "subs_anon_insert" ON subscriptions FOR INSERT TO anon WITH CHECK (false);

-- payments: no anon access
DROP POLICY IF EXISTS "payments_anon_select" ON payments;
CREATE POLICY "payments_anon_select" ON payments FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS "payments_anon_insert" ON payments;
CREATE POLICY "payments_anon_insert" ON payments FOR INSERT TO anon WITH CHECK (false);

-- leads: no anon access
DROP POLICY IF EXISTS "leads_anon_select" ON leads;
CREATE POLICY "leads_anon_select" ON leads FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS "leads_anon_insert" ON leads;
CREATE POLICY "leads_anon_insert" ON leads FOR INSERT TO anon WITH CHECK (false);

-- stripe_events: no anon access
DROP POLICY IF EXISTS "stripe_events_anon_select" ON stripe_events;
CREATE POLICY "stripe_events_anon_select" ON stripe_events FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS "stripe_events_anon_insert" ON stripe_events;
CREATE POLICY "stripe_events_anon_insert" ON stripe_events FOR INSERT TO anon WITH CHECK (false);

-- kpi_events: no anon access
DROP POLICY IF EXISTS "kpi_anon_select" ON kpi_events;
CREATE POLICY "kpi_anon_select" ON kpi_events FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS "kpi_anon_insert" ON kpi_events;
CREATE POLICY "kpi_anon_insert" ON kpi_events FOR INSERT TO anon WITH CHECK (false);

-- dashboard_activity: no anon access
DROP POLICY IF EXISTS "activity_anon_select" ON dashboard_activity;
CREATE POLICY "activity_anon_select" ON dashboard_activity FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS "activity_anon_insert" ON dashboard_activity;
CREATE POLICY "activity_anon_insert" ON dashboard_activity FOR INSERT TO anon WITH CHECK (false);


-- ──────────────────────────────────────────────────────────────
-- PART 4: STORAGE POLICIES (buckets already created)
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "report_pdfs_insert"          ON storage.objects;
DROP POLICY IF EXISTS "report_pdfs_select_service"  ON storage.objects;
DROP POLICY IF EXISTS "report_pdfs_select_anon"     ON storage.objects;
DROP POLICY IF EXISTS "report_json_all_service"     ON storage.objects;
DROP POLICY IF EXISTS "prop_images_select_anon"     ON storage.objects;
DROP POLICY IF EXISTS "prop_images_insert_service"  ON storage.objects;
DROP POLICY IF EXISTS "user_uploads_all_service"    ON storage.objects;
DROP POLICY IF EXISTS "exports_all_service"         ON storage.objects;

CREATE POLICY "report_pdfs_insert"
  ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id = 'report-pdfs');
CREATE POLICY "report_pdfs_select_service"
  ON storage.objects FOR SELECT TO service_role USING (bucket_id = 'report-pdfs');
CREATE POLICY "report_pdfs_select_anon"
  ON storage.objects FOR SELECT TO anon USING (bucket_id = 'report-pdfs');
CREATE POLICY "report_json_all_service"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'report-json') WITH CHECK (bucket_id = 'report-json');
CREATE POLICY "prop_images_select_anon"
  ON storage.objects FOR SELECT TO anon USING (bucket_id = 'property-images');
CREATE POLICY "prop_images_insert_service"
  ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id = 'property-images');
CREATE POLICY "user_uploads_all_service"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'user-uploads') WITH CHECK (bucket_id = 'user-uploads');
CREATE POLICY "exports_all_service"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'exports') WITH CHECK (bucket_id = 'exports');
