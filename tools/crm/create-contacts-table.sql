-- Paste this into Supabase → SQL Editor → Run (project neccpdfhmfnvyjgyrysy)
create table if not exists contacts (
  id bigserial primary key,
  email text, first_name text, last_name text, phone text,
  address text, city text, state text, zip text,
  matched_apn text, assessed_value numeric, market_value numeric,
  beds numeric, sqft numeric, year_built integer,
  segment text, source text default 'cc_scrub',
  created_at timestamptz default now()
);
create index if not exists contacts_apn_idx   on contacts(matched_apn);
create index if not exists contacts_value_idx on contacts(assessed_value desc);
create index if not exists contacts_email_idx on contacts(email);
