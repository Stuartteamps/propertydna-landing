-- Add OAuth tracking columns to profiles table
alter table public.profiles
  add column if not exists avatar_url          text,
  add column if not exists auth_provider       text,
  add column if not exists supabase_user_id    uuid,
  add column if not exists last_login_at       timestamptz,
  add column if not exists created_at          timestamptz default now();

-- Index for supabase_user_id lookups
create index if not exists profiles_supabase_user_id_idx on public.profiles(supabase_user_id);
create index if not exists profiles_created_at_idx       on public.profiles(created_at desc);
