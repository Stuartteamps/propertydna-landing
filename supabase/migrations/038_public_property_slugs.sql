-- ============================================================
-- PropertyDNA — Migration 038: Public Property Slugs (SEO/AEO layer)
--
-- WHAT: Adds a stable, human-readable URL slug + public flag to
--       property_reports so each report can power a crawlable public
--       page at /property/<public_slug> and a JSON bundle at
--       /api/property/<public_slug>.
--
-- WHY:  Search engines and AI assistants (ChatGPT, Perplexity, Gemini,
--       AI Overviews) need clean, canonical, non-PII URLs to find, fetch,
--       and cite property intelligence. The public page/bundle exposes
--       ONLY non-PII fields (address, valuation, comps, scores) — never
--       email / full_name / phone / view_token.
--
-- SAFE TO RUN ONCE: every statement is guarded (IF NOT EXISTS) and the
-- backfill only touches rows that don't already have a slug, so re-running
-- is idempotent.
-- ============================================================

-- ── Columns ───────────────────────────────────────────────────
ALTER TABLE property_reports
  ADD COLUMN IF NOT EXISTS public_slug text;

-- Reports are shareable by design (via token); the public summary excludes
-- all PII, so default to publicly indexable.
ALTER TABLE property_reports
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true;

-- ── Index ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS property_reports_public_slug_idx
  ON property_reports(public_slug);

-- ── Backfill ──────────────────────────────────────────────────
-- Slugify: lower-case, replace every run of non-alphanumerics with a single
-- '-', then trim leading/trailing dashes. Only fills rows missing a slug that
-- have an address to slugify — safe to run repeatedly.
UPDATE property_reports
SET public_slug = trim(
      both '-' from
      regexp_replace(
        lower(coalesce(
          full_address,
          concat_ws(', ', address, city, concat_ws(' ', state, zip))
        )),
        '[^a-z0-9]+', '-', 'g'
      )
    )
WHERE public_slug IS NULL
  AND coalesce(full_address, address) IS NOT NULL
  AND coalesce(full_address, address) <> '';
