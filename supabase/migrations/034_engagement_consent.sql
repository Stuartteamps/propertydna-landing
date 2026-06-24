-- 034 — Audience Engagement OS · consent + frequency cap + referrals + push
-- Additive only. Applied to prod 2026-06-24 via Management API.
--
-- Anti-spam: notification_preferences (per-agent/channel opt-out) + a global
-- frequency cap enforced in code via kpi_events 'engagement_sent'. Plus
-- referral attribution and device-token storage for push.

-- Per-agent / per-channel consent. A row with enabled=false blocks that agent
-- (or, with agent='all', blocks everything). Absence of a row = allowed.
create table if not exists notification_preferences (
  email      text not null,
  agent      text not null default 'all',   -- steward|advocate|historian|market|connector|ambassador|social|all
  channel    text not null default 'all',   -- email|sms|push|all
  enabled    boolean not null default true,
  updated_at timestamptz default now(),
  primary key (email, agent, channel)
);
create index if not exists idx_notif_prefs_email on notification_preferences(email);

-- Referral attribution -------------------------------------------------------
create table if not exists referral_codes (
  email      text primary key,
  code       text unique not null,
  created_at timestamptz default now()
);
create index if not exists idx_referral_codes_code on referral_codes(code);

create table if not exists referrals (
  id            uuid primary key default gen_random_uuid(),
  referrer_email text,
  code          text,
  channel       text,                              -- email|sms|qr|link
  invitee_email text,
  status        text not null default 'clicked',   -- clicked|signed_up|claimed|rewarded
  reward        jsonb,
  created_at    timestamptz default now(),
  attributed_at timestamptz
);
create index if not exists idx_referrals_code    on referrals(code);
create index if not exists idx_referrals_invitee on referrals(invitee_email);

-- Push device tokens ---------------------------------------------------------
create table if not exists device_tokens (
  token      text primary key,
  email      text,
  platform   text,                                  -- ios|android|web
  updated_at timestamptz default now()
);
create index if not exists idx_device_tokens_email on device_tokens(email);
