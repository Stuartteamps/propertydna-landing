-- ============================================================
-- PropertyDNA — Row Level Security  (run AFTER 001_schema.sql)
-- ============================================================

-- Enable RLS
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_reports   ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_searches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_activity ENABLE ROW LEVEL SECURITY;

-- ── property_reports: anon can SELECT (dashboard email-filters in app) ──
DROP POLICY IF EXISTS "reports_anon_select" ON property_reports;
CREATE POLICY "reports_anon_select"
  ON property_reports FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "reports_anon_insert" ON property_reports;
CREATE POLICY "reports_anon_insert"
  ON property_reports FOR INSERT TO anon WITH CHECK (false);

DROP POLICY IF EXISTS "reports_anon_update" ON property_reports;
CREATE POLICY "reports_anon_update"
  ON property_reports FOR UPDATE TO anon USING (false);

DROP POLICY IF EXISTS "reports_anon_delete" ON property_reports;
CREATE POLICY "reports_anon_delete"
  ON property_reports FOR DELETE TO anon USING (false);

-- ── profiles: anon read-only (no write) ──────────────────────
DROP POLICY IF EXISTS "profiles_anon_select" ON profiles;
CREATE POLICY "profiles_anon_select"
  ON profiles FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "profiles_anon_insert" ON profiles;
CREATE POLICY "profiles_anon_insert"
  ON profiles FOR INSERT TO anon WITH CHECK (false);

DROP POLICY IF EXISTS "profiles_anon_update" ON profiles;
CREATE POLICY "profiles_anon_update"
  ON profiles FOR UPDATE TO anon USING (false);

-- ── report_searches: anon can insert (from form), no read ────
DROP POLICY IF EXISTS "searches_anon_insert" ON report_searches;
CREATE POLICY "searches_anon_insert"
  ON report_searches FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "searches_anon_select" ON report_searches;
CREATE POLICY "searches_anon_select"
  ON report_searches FOR SELECT TO anon USING (false);

-- ── subscriptions: no anon access at all ────────────────────
DROP POLICY IF EXISTS "subs_anon_select" ON subscriptions;
CREATE POLICY "subs_anon_select"
  ON subscriptions FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "subs_anon_insert" ON subscriptions;
CREATE POLICY "subs_anon_insert"
  ON subscriptions FOR INSERT TO anon WITH CHECK (false);

-- ── payments: no anon access ─────────────────────────────────
DROP POLICY IF EXISTS "payments_anon_select" ON payments;
CREATE POLICY "payments_anon_select"
  ON payments FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "payments_anon_insert" ON payments;
CREATE POLICY "payments_anon_insert"
  ON payments FOR INSERT TO anon WITH CHECK (false);

-- ── leads: no anon access ────────────────────────────────────
DROP POLICY IF EXISTS "leads_anon_select" ON leads;
CREATE POLICY "leads_anon_select"
  ON leads FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "leads_anon_insert" ON leads;
CREATE POLICY "leads_anon_insert"
  ON leads FOR INSERT TO anon WITH CHECK (false);

-- ── stripe_events: no anon access ────────────────────────────
DROP POLICY IF EXISTS "stripe_events_anon_select" ON stripe_events;
CREATE POLICY "stripe_events_anon_select"
  ON stripe_events FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "stripe_events_anon_insert" ON stripe_events;
CREATE POLICY "stripe_events_anon_insert"
  ON stripe_events FOR INSERT TO anon WITH CHECK (false);

-- ── kpi_events: no anon access ───────────────────────────────
DROP POLICY IF EXISTS "kpi_anon_select" ON kpi_events;
CREATE POLICY "kpi_anon_select"
  ON kpi_events FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "kpi_anon_insert" ON kpi_events;
CREATE POLICY "kpi_anon_insert"
  ON kpi_events FOR INSERT TO anon WITH CHECK (false);

-- ── dashboard_activity: no anon access ───────────────────────
DROP POLICY IF EXISTS "activity_anon_select" ON dashboard_activity;
CREATE POLICY "activity_anon_select"
  ON dashboard_activity FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "activity_anon_insert" ON dashboard_activity;
CREATE POLICY "activity_anon_insert"
  ON dashboard_activity FOR INSERT TO anon WITH CHECK (false);
