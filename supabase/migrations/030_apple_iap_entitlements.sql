-- Adds Apple IAP entitlement columns to the existing subscriptions table.
-- NOT YET APPLIED — held for Build 15 IAP integration.
--
-- Run with:
--   supabase db push
-- or (manual):
--   psql "$DATABASE_URL" < supabase/migrations/030_apple_iap_entitlements.sql

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'stripe' CHECK (provider IN ('stripe', 'apple')),
  ADD COLUMN IF NOT EXISTS apple_original_transaction_id text,
  ADD COLUMN IF NOT EXISTS apple_product_id text,
  ADD COLUMN IF NOT EXISTS environment text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Allow upserts to find existing rows by (user_email, provider) so both
-- Stripe and Apple subs for the same email coexist without overwriting.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_email_provider_idx
  ON subscriptions(user_email, provider);

-- Index for Apple transaction lookups (webhook reconciliation)
CREATE INDEX IF NOT EXISTS subscriptions_apple_otxn_idx
  ON subscriptions(apple_original_transaction_id)
  WHERE apple_original_transaction_id IS NOT NULL;

COMMENT ON COLUMN subscriptions.provider IS
  'stripe = web subscription via Stripe; apple = iOS IAP via StoreKit2.';
COMMENT ON COLUMN subscriptions.apple_original_transaction_id IS
  'The originalTransactionId from StoreKit2 — stable across renewals.';
COMMENT ON COLUMN subscriptions.apple_product_id IS
  'e.g. com.thepropertydna.app.pro.monthly';
