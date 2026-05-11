-- 015_waitlist.sql
-- International waitlist — non-US visitors who hit the funnel are routed here
-- instead of paying for thin (no-data) reports.

create table if not exists waitlist (
  id           bigserial primary key,
  email        text not null,
  full_name    text,
  country_code text,           -- ISO 3166-1 alpha-2 (eg "GB", "AU")
  country_name text,
  city         text,
  state        text,
  address      text,           -- if they came through /get-report flow
  source       text,           -- 'create_checkout' | 'manual' | 'landing'
  ip           text,
  user_agent   text,
  notified_at  timestamptz,    -- set when we email them at launch
  created_at   timestamptz default now()
);

create index if not exists waitlist_email_idx   on waitlist (lower(email));
create index if not exists waitlist_country_idx on waitlist (country_code);
create index if not exists waitlist_created_idx on waitlist (created_at desc);

-- Optional uniqueness — same email per country only once
create unique index if not exists waitlist_email_country_uq
  on waitlist (lower(email), coalesce(country_code, ''));
