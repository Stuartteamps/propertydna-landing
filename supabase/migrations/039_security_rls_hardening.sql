-- ============================================================
-- 039 — SECURITY: RLS hardening for PII / secret tables
-- ============================================================
--
-- STATUS: DRAFT — REQUIRES FOUNDER REVIEW + MANUAL RUN. NOT auto-applied.
-- Migrations in this repo are run by hand against Supabase; adding this file
-- does NOT execute it. Do not run in prod until the checklist below passes.
--
-- WHY (found in Founder-OS audit 2026-07-11, see docs/founder-os/03-risk-register.md):
--   C1  property_reports + profiles grant `anon` SELECT on ALL rows
--       (002_rls.sql:18-19,35-36 `USING (true)`). The Supabase publishable/anon
--       key ships in the client bundle, so anyone can dump every user's email,
--       full address, report JSON, view_token (the no-login report credential),
--       and stripe_customer_id directly via PostgREST. "App filters by email"
--       is not a control — the key bypasses the app.
--   C2  oauth_tokens (016) has RLS DISABLED — plaintext Constant Contact / Google
--       refresh tokens are readable with the public key → integration takeover.
--   H1  campaigns / campaign_contacts / campaign_unsubscribes (011) use
--       `FOR ALL USING (true)` with NO `TO` clause → PUBLIC read+write+delete of
--       every marketing contact.
--   H2  waitlist (015), device_tokens + notification_preferences (034) have RLS
--       DISABLED → anon read of emails / push tokens.
--
-- SAFETY ANALYSIS (why this is behaviorally safe):
--   The frontend NEVER reads these tables directly with the anon client. Verified:
--     grep "\.from('...')" over app/frontend/src returns only catalog tables
--     (property_master, architects, dossier_requests, notable_owners,
--      market_snapshots, provenance_events, ops_activity_log,
--      architect_commissions, property_history) — none touched here.
--   All access to these PII/secret tables is via Netlify functions using the
--   SERVICE_ROLE key, which BYPASSES RLS entirely. So removing anon grants and
--   enabling RLS with no anon policy leaves every server path working while
--   closing the public PostgREST hole.
--
-- NOT COVERED HERE (needs a coordinated frontend+backend change — see risk
-- register C3): get-reports.js trusts a client-supplied `email` with no JWT.
-- Fixing that requires Dashboard to send the bearer token; ship separately.
--
-- PRE-RUN CHECKLIST:
--   [ ] Confirm no NEW frontend code reads these tables with the anon key.
--   [ ] Confirm the server functions below still use SUPABASE_SERVICE_KEY:
--         get-report-by-token, get-reports, auto-refresh-cc-token,
--         send-cc-newsletter, campaign-* , join-waitlist, register-device.
--   [ ] Take a Supabase backup / note current policies for rollback.
--   [ ] After running: rotate the Constant Contact + Google OAuth tokens.
--
-- ROLLBACK: re-create the dropped policies from 002_rls.sql / 011_campaigns.sql
--   and `ALTER TABLE <t> DISABLE ROW LEVEL SECURITY;` for the enables below.
-- ============================================================

-- ── C1: property_reports — remove blanket anon read ─────────────────────────
-- Reports are fetched server-side (get-report-by-token / get-reports) under the
-- service key. No anon SELECT is needed. Keep the deny-write policies from 002.
DROP POLICY IF EXISTS "reports_anon_select" ON property_reports;

-- ── C1: profiles — remove blanket anon read ─────────────────────────────────
DROP POLICY IF EXISTS "profiles_anon_select" ON profiles;

-- ── C2: oauth_tokens — enable RLS, no anon policy (service role bypasses) ────
ALTER TABLE IF EXISTS oauth_tokens ENABLE ROW LEVEL SECURITY;

-- ── H1: campaigns family — scope the FOR ALL policies to service_role ────────
-- 011_campaigns.sql created these as `FOR ALL USING (true)` with no TO clause
-- (applies to PUBLIC). Recreate scoped to service_role only.
DROP POLICY IF EXISTS "campaigns_service" ON campaigns;
CREATE POLICY "campaigns_service" ON campaigns
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "campaign_contacts_service" ON campaign_contacts;
CREATE POLICY "campaign_contacts_service" ON campaign_contacts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "campaign_unsubscribes_service" ON campaign_unsubscribes;
CREATE POLICY "campaign_unsubscribes_service" ON campaign_unsubscribes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Ensure RLS is actually on for the campaign family (it may not be).
ALTER TABLE IF EXISTS campaigns             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS campaign_contacts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS campaign_unsubscribes ENABLE ROW LEVEL SECURITY;

-- ── H2: enable RLS on unprotected PII tables (service role bypasses) ────────
ALTER TABLE IF EXISTS waitlist                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS device_tokens            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notification_preferences ENABLE ROW LEVEL SECURITY;

-- NOTE: join-waitlist / device-registration functions must insert via the
-- service key after this runs. If any of them currently insert with the anon
-- key, add a narrow INSERT-only anon policy for that table instead of relying
-- on service role. Verify in the pre-run checklist.
