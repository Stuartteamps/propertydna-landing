-- ============================================================
-- PropertyDNA — Schema  (paste and run in Supabase SQL Editor)
-- ============================================================

-- ── profiles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email               text        UNIQUE NOT NULL,
  full_name           text,
  phone               text,
  stripe_customer_id  text        UNIQUE,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- ── subscriptions ─────────────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS subscriptions_email_idx     ON subscriptions(email);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx    ON subscriptions(status);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_idx    ON subscriptions(stripe_subscription_id);

-- ── payments ──────────────────────────────────────────────────
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

-- ── property_reports ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS property_reports (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id       uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  email            text        NOT NULL,
  address          text        NOT NULL,
  city             text,
  state            text,
  zip              text,
  full_address     text,
  role             text        DEFAULT 'Buyer',
  report_url       text,
  report_pdf_url   text,
  report_data      jsonb,
  payment_id       uuid        REFERENCES payments(id) ON DELETE SET NULL,
  subscription_id  uuid        REFERENCES subscriptions(id) ON DELETE SET NULL,
  stripe_session_id text,
  status           text        NOT NULL DEFAULT 'pending',
  generation_error text,
  n8n_request_id   text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS property_reports_email_idx   ON property_reports(email);
CREATE INDEX IF NOT EXISTS property_reports_status_idx  ON property_reports(status);
CREATE INDEX IF NOT EXISTS property_reports_session_idx ON property_reports(stripe_session_id);

-- ── leads ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_type         text        NOT NULL,
  email               text        NOT NULL,
  first_name          text,
  last_name           text,
  full_name           text,
  phone               text,
  message             text,
  interest            text,
  buyer_timeline      text,
  seller_timeline     text,
  price_range         text,
  bedrooms            text,
  property_type       text,
  property_address    text,
  community           text,
  working_with_agent  text,
  agent               text        DEFAULT 'daniel_stuart',
  utm_source          text,
  qr_source           text,
  page_url            text,
  raw_payload         jsonb,
  created_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leads_email_idx   ON leads(email);
CREATE INDEX IF NOT EXISTS leads_funnel_idx  ON leads(funnel_type);
CREATE INDEX IF NOT EXISTS leads_created_idx ON leads(created_at DESC);

-- ── report_searches ───────────────────────────────────────────
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

-- ── stripe_events ─────────────────────────────────────────────
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

-- ── kpi_events ────────────────────────────────────────────────
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

-- ── dashboard_activity ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dashboard_activity (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email      text        NOT NULL,
  action     text        NOT NULL,
  report_id  uuid        REFERENCES property_reports(id) ON DELETE SET NULL,
  metadata   jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dashboard_activity_email_idx ON dashboard_activity(email);

-- ── updated_at trigger ────────────────────────────────────────
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
