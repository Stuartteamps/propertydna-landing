-- 016_oauth_tokens.sql
-- Single-row-per-provider OAuth token store. Moves long-lived tokens out of
-- Netlify env vars (which collectively hit AWS Lambda's 4KB ceiling) and into
-- Supabase where they can be rotated without redeploys.

create table if not exists oauth_tokens (
  provider      text primary key,         -- 'constant_contact' | 'google' | ...
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  metadata      jsonb default '{}'::jsonb,
  updated_at    timestamptz default now()
);

create index if not exists oauth_tokens_updated_idx on oauth_tokens (updated_at desc);
