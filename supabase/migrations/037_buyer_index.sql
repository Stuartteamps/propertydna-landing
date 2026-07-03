-- 037_buyer_index.sql
-- Buyer Properties Index — the demand-side loop that did not exist yet.
-- Reactive per-address watching (watched_properties) + one-off open-house
-- matching existed, but there was NO structured index of buyers <-> their
-- target criteria and no engine to bring matched homes TO a buyer. These two
-- tables are that foundation; reuses community-first ranking against the
-- enriched property_master index. Priority region: Coachella Valley (CV).
-- Additive only — CREATE ... IF NOT EXISTS. Nothing dropped/altered.

CREATE TABLE IF NOT EXISTS buyer_profiles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL,
  full_name      text,
  phone          text,
  region         text NOT NULL DEFAULT 'CV',
  cities         text[]  DEFAULT '{}',
  communities    text[]  DEFAULT '{}',
  price_min      numeric,
  price_max      numeric,
  beds_min       int,
  baths_min      numeric,
  property_type  text,
  must_haves     jsonb   DEFAULT '{}'::jsonb,
  nice_to_haves  jsonb   DEFAULT '{}'::jsonb,
  source         text,
  status         text NOT NULL DEFAULT 'active',
  notify_email   boolean NOT NULL DEFAULT true,
  last_matched_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_buyer_profiles_email  ON buyer_profiles (email);
CREATE INDEX IF NOT EXISTS idx_buyer_profiles_status ON buyer_profiles (status);
CREATE INDEX IF NOT EXISTS idx_buyer_profiles_region ON buyer_profiles (region);

CREATE TABLE IF NOT EXISTS buyer_matches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id      uuid NOT NULL REFERENCES buyer_profiles (id) ON DELETE CASCADE,
  property_apn  text,
  property_id   uuid,
  address       text,
  city          text,
  community     text,
  match_score   numeric,
  match_reasons jsonb   DEFAULT '{}'::jsonb,
  match_kind    text,
  status        text NOT NULL DEFAULT 'surfaced',
  surfaced_at   timestamptz NOT NULL DEFAULT now(),
  notified_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_buyer_matches_buyer_apn
  ON buyer_matches (buyer_id, property_apn) WHERE property_apn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_buyer_matches_buyer  ON buyer_matches (buyer_id, surfaced_at DESC);
CREATE INDEX IF NOT EXISTS idx_buyer_matches_apn    ON buyer_matches (property_apn);
CREATE INDEX IF NOT EXISTS idx_buyer_matches_status ON buyer_matches (status);
