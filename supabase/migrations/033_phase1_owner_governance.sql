-- PROPOSED migration — Phase 1 Owner Portal + Data Integrity Office
-- DO NOT APPLY UNTIL REVIEWED.
-- Promoted to 033_ on 2026-06-23 — Phase 1 owner portal go-live.
--
-- Branch: intellagraph-network-transition
-- Author: Phase 1 architecture pass, 2026-06-23
--
-- Intent: add ONLY the tables needed for owner claim queue + DIO disputes.
-- Reuses existing property_master (10M rows), property_history, notable_owners.
-- Does NOT add: investor marketplace, fractional ownership, securities-style
-- order book — those require legal/regulatory clearance first.

-- ── 1. property_owner_claims ─────────────────────────────────────────────────
-- An owner submitting a claim of ownership for a property they say is theirs.
-- Claims start as 'pending' and stay there until KYC ships. The "Owner-verified"
-- badge on a property NEVER reads from a pending row.
create table if not exists property_owner_claims (
  id              uuid primary key default gen_random_uuid(),
  apn             text not null,
  county_fips     text,
  state           text,
  claimed_email   text not null,
  claimed_name    text,
  claimed_phone   text,
  relationship    text check (relationship in ('owner', 'co_owner', 'trustee', 'agent_of_record', 'family_member', 'other')),
  status          text not null default 'pending'
                  check (status in ('pending', 'verifying', 'verified', 'rejected', 'withdrawn')),
  verification_method text,        -- 'kyc_persona', 'deed_upload', 'tax_record_match', etc. — null until Phase 2
  verified_at     timestamptz,
  verified_by     text,            -- admin user id who reviewed
  rejection_reason text,
  notes           text,            -- internal admin notes
  source          text default 'web',
  ip_address      text,
  user_agent      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_owner_claims_apn      on property_owner_claims(apn);
create index if not exists idx_owner_claims_email    on property_owner_claims(claimed_email);
create index if not exists idx_owner_claims_status   on property_owner_claims(status);
create index if not exists idx_owner_claims_created  on property_owner_claims(created_at desc);

-- ── 2. property_owner_updates ────────────────────────────────────────────────
-- Owner-submitted facts about their property (remodels, permits, ADU, solar,
-- insurance cost, tax info, etc.). Linked to a claim. NEVER feeds the live
-- valuation model in Phase 1 — these go through a review queue.
create table if not exists property_owner_updates (
  id                    uuid primary key default gen_random_uuid(),
  claim_id              uuid references property_owner_claims(id) on delete cascade,
  apn                   text not null,
  update_type           text not null
                        check (update_type in ('remodel', 'permit', 'addition', 'adu',
                                               'solar', 'pool', 'roof', 'systems',
                                               'insurance_cost', 'tax_info', 'note',
                                               'photo', 'document', 'other')),
  payload               jsonb not null default '{}'::jsonb,  -- type-specific fields
  evidence_url          text,                                 -- supabase storage path to uploaded doc
  status                text not null default 'pending_review'
                        check (status in ('pending_review', 'accepted', 'rejected', 'needs_more_info')),
  reviewer_notes        text,
  feeds_valuation       boolean not null default false,       -- ALWAYS false until verified + Phase 2
  created_at            timestamptz default now(),
  reviewed_at           timestamptz
);

create index if not exists idx_owner_updates_claim  on property_owner_updates(claim_id);
create index if not exists idx_owner_updates_apn    on property_owner_updates(apn);
create index if not exists idx_owner_updates_status on property_owner_updates(status);

-- ── 3. data_disputes ─────────────────────────────────────────────────────────
-- Anyone (owner, buyer, public) can flag a data error on a property report.
-- "Report a Data Error" form on /data-integrity/report-error writes here.
create table if not exists data_disputes (
  id              uuid primary key default gen_random_uuid(),
  apn             text,
  view_token      text,                 -- if reporting error on a specific report
  reporter_email  text not null,
  reporter_role   text check (reporter_role in ('owner', 'buyer', 'agent', 'researcher', 'other')),
  field_in_error  text,                 -- which DNA field is wrong (e.g. 'sqft', 'year_built', 'dna_score')
  current_value   text,
  proposed_value  text,
  evidence_text   text,
  evidence_url    text,
  status          text not null default 'open'
                  check (status in ('open', 'investigating', 'resolved_corrected',
                                    'resolved_no_change', 'rejected', 'duplicate')),
  resolution      text,
  reviewer_notes  text,
  created_at      timestamptz default now(),
  resolved_at     timestamptz
);

create index if not exists idx_disputes_apn     on data_disputes(apn);
create index if not exists idx_disputes_status  on data_disputes(status);
create index if not exists idx_disputes_created on data_disputes(created_at desc);

-- ── 4. governance_audit_logs ─────────────────────────────────────────────────
-- AI decision audit trail. Phase 1: stub only — wired in Phase 2 when we route
-- IntellaGraph AI inference calls through a logging middleware. Visible on
-- /data-integrity/audit-trail (transparency layer).
create table if not exists governance_audit_logs (
  id              uuid primary key default gen_random_uuid(),
  event_type      text not null,        -- 'dna_score_computed', 'valuation_revised',
                                        --   'owner_claim_decision', 'dispute_resolved', etc.
  apn             text,
  model_version   text,                 -- e.g. 'dna_v3.2', 'intellagraph_sonnet_4_6'
  input_hash      text,                 -- sha256 of input payload
  output_payload  jsonb,
  confidence      numeric(5,2),         -- 0-100
  actor_type      text check (actor_type in ('system', 'admin', 'owner', 'dispute_reviewer')),
  actor_id        text,
  notes           text,
  created_at      timestamptz default now()
);

create index if not exists idx_audit_logs_apn        on governance_audit_logs(apn);
create index if not exists idx_audit_logs_event_type on governance_audit_logs(event_type);
create index if not exists idx_audit_logs_created    on governance_audit_logs(created_at desc);

-- ── RLS (Row Level Security) ─────────────────────────────────────────────────
-- Phase 1: writes via Netlify functions with service key. Reads gated by
-- claimed_email matching the authenticated user's email.

alter table property_owner_claims  enable row level security;
alter table property_owner_updates enable row level security;
alter table data_disputes          enable row level security;
alter table governance_audit_logs  enable row level security;

-- Owners can see their own claims
create policy "owner_can_see_own_claims" on property_owner_claims
  for select using (claimed_email = auth.jwt() ->> 'email');

-- Owners can see their own updates (via claim ownership)
create policy "owner_can_see_own_updates" on property_owner_updates
  for select using (
    claim_id in (select id from property_owner_claims where claimed_email = auth.jwt() ->> 'email')
  );

-- Disputes are visible to the reporter
create policy "reporter_can_see_own_disputes" on data_disputes
  for select using (reporter_email = auth.jwt() ->> 'email');

-- Audit logs are public-read (transparency layer), but only the abbreviated
-- columns. Phase 2 should add a view that strips actor_id from the public view.
create policy "audit_logs_public_read" on governance_audit_logs
  for select using (true);

-- No INSERT/UPDATE/DELETE policies on any of these — all writes happen
-- server-side via Netlify functions using the service role key.
