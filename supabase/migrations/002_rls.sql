-- ============================================================
-- PropertyDNA — Row Level Security Policies
-- Run AFTER 001_schema.sql
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_reports    ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads               ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_searches     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_activity  ENABLE ROW LEVEL SECURITY;

-- ── Service role bypasses all RLS ─────────────────────────────
-- (Supabase service_role key is already exempt from RLS by default)

-- ── profiles: anon can read own row by email ──────────────────
-- Used by Dashboard page (frontend uses anon key)
DROP POLICY IF EXISTS "profiles_anon_read_own"   ON profiles;
CREATE POLICY "profiles_anon_read_own" ON profiles
  FOR SELECT TO anon
  USING (true); -- email filtering done in application layer; no JWT available

-- No anon INSERT/UPDATE/DELETE on profiles (service role only)
DROP POLICY IF EXISTS "profiles_no_anon_write"   ON profiles;
CREATE POLICY "profiles_no_anon_write" ON profiles
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

-- ── property_reports: anon can read (dashboard uses email filter) ──
DROP POLICY IF EXISTS "reports_anon_read"         ON property_reports;
CREATE POLICY "reports_anon_read" ON property_reports
  FOR SELECT TO anon
  USING (true);

-- No anon write access to reports
DROP POLICY IF EXISTS "reports_no_anon_write"     ON property_reports;
CREATE POLICY "reports_no_anon_write" ON property_reports
  FOR INSERT TO anon
  WITH CHECK (false);

-- ── subscriptions: no frontend access at all ─────────────────
-- Dashboard checks subscription via Netlify function (service role)
DROP POLICY IF EXISTS "subs_no_anon_access"       ON subscriptions;
CREATE POLICY "subs_no_anon_access" ON subscriptions
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

-- ── payments: no frontend access ─────────────────────────────
DROP POLICY IF EXISTS "payments_no_anon_access"   ON payments;
CREATE POLICY "payments_no_anon_access" ON payments
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

-- ── leads: no frontend access ────────────────────────────────
DROP POLICY IF EXISTS "leads_no_anon_access"      ON leads;
CREATE POLICY "leads_no_anon_access" ON leads
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

-- ── stripe_events: no frontend access ────────────────────────
DROP POLICY IF EXISTS "stripe_events_no_anon"     ON stripe_events;
CREATE POLICY "stripe_events_no_anon" ON stripe_events
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

-- ── kpi_events: no frontend access ───────────────────────────
DROP POLICY IF EXISTS "kpi_no_anon"               ON kpi_events;
CREATE POLICY "kpi_no_anon" ON kpi_events
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

-- ── dashboard_activity: no frontend access ───────────────────
DROP POLICY IF EXISTS "dashboard_activity_no_anon" ON dashboard_activity;
CREATE POLICY "dashboard_activity_no_anon" ON dashboard_activity
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

-- ── report_searches: anon can insert (from frontend form) ────
DROP POLICY IF EXISTS "searches_anon_insert"      ON report_searches;
CREATE POLICY "searches_anon_insert" ON report_searches
  FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "searches_no_anon_read"     ON report_searches;
CREATE POLICY "searches_no_anon_read" ON report_searches
  FOR SELECT TO anon
  USING (false);
