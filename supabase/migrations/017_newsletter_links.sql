-- 017_newsletter_links.sql
-- Weekly newsletter listing URLs. Single-row config table — Dan updates each
-- Wednesday so the Thursday cron picks fresh FlexMLS share links without a
-- code deploy.

create table if not exists newsletter_links (
  id              integer primary key default 1,
  west_valley_new text,
  east_valley_new text,
  recently_sold   text,
  notes           text,
  updated_at      timestamptz default now(),
  constraint single_row check (id = 1)
);

-- Initial seed lives in the data plane; see Supabase rows for current values.
