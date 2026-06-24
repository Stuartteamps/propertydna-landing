# PropertyDNA — Audience Engagement Operating System (AEOS)
### Movement: **Take Ownership of Housing**

An autonomous, AI-driven engagement layer that lives *beside* the property-intelligence platform. It does not change what PropertyDNA is (a property intelligence platform + future housing exchange). It exists to convert passive report-runners into **informed, participating homeowners** — driving adoption, retention, trust, contribution, referrals, and real-world connection.

> **Not a social network.** No feeds, likes, followers, forums, chat rooms, or community pages inside the product. Engagement happens through *1:1 personalized intelligence* delivered over email / SMS / push, and through *real-world action* (claim your home, contribute its history, attend a local event, invite a neighbor). The "social graph" is the neighborhood and the deed — not a timeline.

Every agent is designed to make a user feel one or more of: **informed · recognized · useful · connected · empowered.**

| Agent | Primary feelings | One-line job |
|---|---|---|
| **Steward** | informed · empowered | Onboard, guide the home claim, complete the profile, teach |
| **Historian** | useful · recognized | Collect history/stories/documents; improve data quality |
| **Market Analyst** | informed · curious | Weekly insights, neighborhood rankings, change alerts |
| **Advocate** | empowered · protected | Tax / insurance / risk / consumer-protection alerts |
| **Connector** | connected | Local events, meetups, offline opportunities |
| **Ambassador** | recognized · connected | Referrals, neighbor invites, QR loops, growth |

---

## ✅ Implementation status (2026-06-24)

All six agents are **built, deployed, and scheduled** as Netlify functions, gated by `ENGAGEMENT_MODE` (default `dryrun` = email Dan a preview; set `live` to reach users). Shared toolkit: `netlify/functions/_engage.js` (Claude brain + Resend + kpi dedup + owner digest). Built fully additive — zero schema changes; dedup on `kpi_events`; reuse `property_reports` + the existing `033_owner_governance` tables (`property_owner_claims`, `property_owner_updates`).

| Agent | Function | Cadence | Live-channel today |
|---|---|---|---|
| Steward | `steward-agent.js` | daily 9:30 PT | email |
| Advocate | `advocate-agent.js` | daily 11:30 PT | email |
| Historian | `historian-agent.js` | daily 10:30 PT | email |
| Market Analyst | `market-agent.js` | Mon 9 PT | email |
| Connector | `connector-agent.js` | Wed 12 PT | email |
| Ambassador | `ambassador-agent.js` | Fri 13 PT | email |
| *(Social Publisher)* | `social-agent.js` | daily 10 PT | social (via social-poster) |

**Phase-2 enhancements (need migrations / the push channel):** `market_snapshots` (cross-time deltas), `local_events`/`event_rsvps` (Connector RSVP), `referrals` (Ambassador attribution + K-factor), `notification_preferences` (per-agent consent), and push (APNs/FCM) for native alerts.

---

## 1. System architecture

A thin, event-driven layer. Nothing here is a new product surface — it's backend services + scheduled intelligence + the channels you already run.

```
                       ┌──────────────────────────────────────────┐
   App / Web / Report  │            EVENT BUS (Supabase)           │
   actions ───────────▶│  engagement_events (append-only)          │
   (signup, report,    │  + Postgres triggers / Realtime / webhook  │
    claim, upload,     └───────────────┬──────────────────────────┘
    payment, etc.)                     │
                                       ▼
                       ┌──────────────────────────────────────────┐
   Cron (n8n /         │        AGENT ORCHESTRATION (n8n)          │
   Netlify sched) ────▶│  one workflow per agent; reads events +    │
                       │  state, decides next best action          │
                       └───────────────┬──────────────────────────┘
                                       │ personalization
                                       ▼
                       ┌──────────────────────────────────────────┐
                       │   DECISION BRAIN (Claude sonnet-4-6)      │
                       │   copy generation + next-best-action +    │
                       │   summarization (intellagraph-ai pattern) │
                       └───────────────┬──────────────────────────┘
                                       ▼
        ┌──────────────┬──────────────┬───────────────┬───────────┐
        │  Resend      │  Quo (SMS)   │  Push (APNs/   │  CC       │
        │  (email)     │  + contacts  │  FCM)          │  newsletter│
        └──────┬───────┴──────┬───────┴───────┬───────┴─────┬─────┘
               └──────────────┴───────────────┴─────────────┘
                                       ▼
                       engagement_log (every touch, open, click, convert)
```

**Core principles**
1. **Append-only event bus.** Everything the user does emits an `engagement_events` row. Agents react to events; they never poll the app. (Reuse the existing `kpi_events` discipline — this is its purposeful sibling.)
2. **Agents are workflows, not microservices.** Each agent = 1–3 n8n workflows + small Netlify "action" functions. No new servers.
3. **Channel adapters are shared.** `dispatch(user, channel, template, vars)` → Resend / Quo / push / CC. One code path, consented per user.
4. **Claude is the brain, not the mouth.** Claude writes the copy and picks the next best action; deterministic code sends it. Cheap, auditable.
5. **Consent first.** Every send checks `notification_preferences`. One-tap unsubscribe per channel per agent. This protects deliverability (you already split transactional vs campaign domains).
6. **Measure every touch.** `engagement_log` is the source of truth for all success metrics.

---

## 2. Shared Supabase schema (foundation for all agents)

```sql
-- Identity & lifecycle ------------------------------------------------------
create table user_profiles (
  user_id uuid primary key references auth.users(id),
  email text, full_name text, phone text,
  role text,                       -- buyer | owner | investor | agent
  home_address text, home_property_id uuid,   -- their claimed home
  claim_status text default 'none',           -- none|pending|verified
  lifecycle_stage text default 'new',         -- new|activated|contributor|advocate|champion
  ambassador_code text unique,
  points int default 0,            -- recognition currency (private, not a leaderboard)
  city text, state text, zip text, lat numeric, lon numeric,
  created_at timestamptz default now(), last_seen_at timestamptz
);

create table notification_preferences (
  user_id uuid references auth.users(id),
  channel text,                    -- email|sms|push
  agent text,                      -- steward|historian|market|advocate|connector|ambassador|all
  enabled boolean default true,
  primary key (user_id, channel, agent)
);

create table device_tokens (       -- for push
  user_id uuid references auth.users(id),
  token text, platform text,       -- ios|android|web
  updated_at timestamptz default now(),
  primary key (token)
);

-- Event bus + activity ------------------------------------------------------
create table engagement_events (
  id bigint generated always as identity primary key,
  user_id uuid, type text,         -- e.g. 'report_run','home_claimed','doc_uploaded'
  property_id uuid, payload jsonb,
  processed boolean default false,
  created_at timestamptz default now()
);

create table engagement_log (
  id bigint generated always as identity primary key,
  user_id uuid, agent text, channel text, template text,
  property_id uuid, variant text,
  sent_at timestamptz default now(),
  opened_at timestamptz, clicked_at timestamptz, converted_at timestamptz,
  meta jsonb
);
```

Per-agent tables are defined in each section below. CRM model: **Supabase is the system of record**; segments sync outward to Constant Contact (email audiences) and Quo (SMS contacts/tags); `engagement_log` is the activity timeline.

---

## 3. The Agents

> Format per agent: **Mission · Success metrics · Trigger events · Data required · User touchpoints · Automated workflows · Email · SMS · Push · CRM · n8n design · Supabase additions.**

### 3.1 Steward Agent — *informed · empowered*
**Mission:** Turn a first report into an activated homeowner. Guide new users through claiming their home, completing their profile, and learning what their data means.

**Success metrics:** activation rate (report → claimed home), profile completion %, D1/D7/D30 retention, time-to-claim, education email CTR, % reaching `lifecycle_stage=activated`.

**Trigger events:** `user_signup`, `first_report_run`, `report_viewed`, `home_claim_started/verified`, profile field saved, 24h/72h/7d inactivity after signup.

**Data required:** user_profiles, the user's first report (property_reports), claim_status, which profile fields are empty, last_seen_at.

**User touchpoints:** post-signup welcome (email), in-report "Claim this home" prompt (minimal app affordance), profile-completion nudges, "what your DNA Score means" micro-lessons, push re-engagement.

**Automated workflows:**
- *Welcome & Claim* — on signup/first report, send welcome → 24h later, if not claimed, "claim your home in 60 seconds" → 72h, value-led nudge → 7d, education.
- *Profile completion* — drip that requests one field at a time (never a wall of forms), each tied to a benefit ("add your purchase date → get an accurate equity estimate").

**Email sequence (Welcome series):**
1. T+0 — "Welcome — here's what you actually own." (their report + one striking insight)
2. T+1d — "Claim your home" (one-tap; explains why claiming unlocks alerts)
3. T+3d — "Your DNA Score, decoded" (education)
4. T+7d — "3 things every owner should verify this year" (Advocate hand-off)

**SMS sequence (opt-in only, short):**
- T+0 (if phone + consent): "Welcome to PropertyDNA 🏠 Your report for {address} is ready: {link}. Reply STOP to opt out."
- T+2d if unclaimed: "Claim {address} to get tax + insurance alerts: {link}"

**Push strategy:** Day-1 "Your home report is ready," Day-3 "Claim your home to unlock alerts," re-engagement at 7/14d inactivity. Quiet hours enforced; max 2/week from Steward.

**CRM:** tag `stage:new→activated`; sync to CC "Owners – Onboarding" audience; Quo contact created with `source=app_signup`.

**n8n design:** `steward_onboarding` workflow — Supabase trigger on `engagement_events.type in (user_signup, first_report_run)` → branch on claim/profile state → Claude renders personalized copy from the report → dispatch adapter → write engagement_log → schedule follow-up via wait nodes.

**Supabase additions:**
```sql
alter table user_profiles add column onboarding_step text default 'welcome';
-- claim flow:
create table claimed_properties (
  user_id uuid, property_id uuid, address text,
  claim_status text default 'pending',  -- pending|verified|rejected
  verification_method text,             -- doc|mail|owner_match
  claimed_at timestamptz default now(),
  primary key (user_id, property_id)
);
```

---

### 3.2 Historian Agent — *useful · recognized*
**Mission:** Enrich each property with the history only its people know — prior renovations, neighborhood stories, documents (permits, surveys, photos) — improving data quality while making contributors feel useful and recognized.

**Success metrics:** # contributions/week, % claimed homes with ≥1 contribution, documents uploaded, data-quality delta (fields filled by humans), contributor retention, points awarded.

**Trigger events:** `home_claim_verified`, `report_viewed` with data gaps, `doc_uploaded`, anniversary of purchase, "we're missing X for your home."

**Data required:** claimed_properties, the property's known gaps (missing permit finals, no photos, unknown reno year), prior contributions, assessor record.

**User touchpoints:** "Help complete your home's record" prompts (gap-specific), document upload (minimal app surface — a single upload control on the report), thank-you + recognition ("you improved this home's record — and the 4 neighbors who'll run it next").

**Automated workflows:**
- *Gap-fill* — detect a missing field on a claimed home → ask the owner the one question that fills it → on answer, update `properties`, award points, send recognition.
- *Document drive* — request permits/survey/insurance docs; store in Supabase Storage; OCR via existing pipeline; extract structured data.

**Email sequence:**
1. "Your home knows things our data doesn't — fill one gap" (the single most valuable missing field)
2. On contribution: "You just made {address} smarter. +25 points. Here's what changed."
3. Quarterly: "New ways to complete your home's story" (docs, photos, reno history)

**SMS:** "Quick one — what year was {address}'s kitchen remodeled? Reply with a year and we'll update your equity estimate." (conversational, single-question)

**Push:** "1 question to improve your home's record" → deep-link to the single gap. Recognition push on contribution accepted.

**CRM:** tag `contributor`; increment points; CC segment "Contributors" gets quarterly recognition; Quo notes log contribution count.

**n8n design:** `historian_gapfill` — cron scans claimed_properties for top gap per home → Claude turns the gap into one friendly question → dispatch → inbound answer (reply-webhook / app endpoint) → validate → write to `properties` + `contributions` + points → recognition send.

**Supabase additions:**
```sql
create table contributions (
  id bigint generated always as identity primary key,
  user_id uuid, property_id uuid,
  type text,            -- reno_year|story|permit_doc|survey|photo|correction
  field text, value jsonb, status text default 'accepted',
  points int default 0, created_at timestamptz default now()
);
create table property_documents (
  id bigint generated always as identity primary key,
  property_id uuid, user_id uuid, storage_path text,
  doc_type text, ocr_json jsonb, created_at timestamptz default now()
);
```

---

### 3.3 Market Analyst Agent — *informed · curious*
**Mission:** Keep owners curious and coming back with proactive, personalized market intelligence about their home and neighborhood — the report that finds *them*.

**Success metrics:** weekly-insight open/click rate, return visits driven, re-run reports, "watchlist" adds, subscription conversions influenced, push opt-in retention.

**Trigger events:** weekly cron, comparable sale near a claimed home, valuation change > threshold, neighborhood ranking change, new permit nearby, rate/market shift.

**Data required:** claimed_properties + the sovereignty index (comps, valuations, permits, market stats), prior values for deltas, neighborhood aggregates.

**User touchpoints:** weekly "Your home this week" email, instant change alerts (push/SMS), neighborhood ranking page within the report (read-only data, not a feed).

**Automated workflows:**
- *Weekly digest* — per claimed home, compute deltas (value, nearby sales, permits, rank) → Claude writes a 120-word personalized read → send.
- *Change alerts* — event-driven: a qualifying comp/permit/value move fires an immediate, single-fact alert.

**Email sequence (recurring, not a drip):**
- Weekly "Your home this week, {address}": value trend, 1 nearby sale, 1 neighborhood stat, 1 "did you know."
- Monthly "Neighborhood report card": where {neighborhood} ranks on value growth, risk, permits.

**SMS:** only for high-signal alerts — "A home 2 doors down just sold for ${price} ({+/-}% vs your estimate). See impact: {link}"

**Push:** value-change and nearby-sale alerts (the dopamine of curiosity). Cap 2/week unless user raises it.

**CRM:** engagement scoring feeds lifecycle; high openers → upsell to Pro (existing pricing) handled by lifecycle, not by this agent directly.

**n8n design:** `market_weekly` (cron) + `market_alerts` (event). Both read the index, compute deltas in SQL, Claude renders copy, dispatch, log. Dedup so a user gets one consolidated weekly, not N.

**Supabase additions:**
```sql
create table watchlist (
  user_id uuid, property_id uuid, address text,
  added_at timestamptz default now(), primary key (user_id, property_id)
);
create table market_snapshots (   -- for delta computation
  property_id uuid, captured_at date, value_mid numeric,
  comps_30d int, permits_90d int, neighborhood_rank int,
  primary key (property_id, captured_at)
);
```

---

### 3.4 Advocate Agent — *empowered · protected*
**Mission:** Defend the homeowner. Proactively warn about money-and-safety events — property-tax reassessments, insurance non-renewal/rate risk, flood/fire/quake exposure, predatory patterns — so owners act in time. This *is* the mission ("Save the humans") in operational form.

**Success metrics:** alerts delivered/acted-on, $ saved (self-reported + modeled), appeal/shop-insurance actions taken, trust/NPS, retention lift among alerted users, churn reduction.

**Trigger events:** assessment cycle dates by county, insurance market signals (FL/CA non-renewal waves), risk-layer changes (FEMA/CalFire updates), tax-appeal deadlines, rate resets.

**Data required:** claimed_properties + risk profile (already computed in save-report: flood/fire/quake/crime), assessor schedules per county, insurance market data, deadlines calendar.

**User touchpoints:** timely alert (push first, email with the "what to do," SMS for urgent deadlines), an "Action" block in the report ("appeal your assessment," "shop insurance now").

**Automated workflows:**
- *Tax-appeal watch* — county appeal windows → for owners whose assessment looks high vs DNA value, send a "you may be over-assessed — appeal by {deadline}" with the evidence.
- *Insurance watch* — region risk + market signals → "your area is seeing non-renewals; here's how to get ahead."
- *Risk-change* — a FEMA/CalFire layer update that changes a claimed home's risk → notify with the delta and the practical step.

**Email sequence (event-driven, not drip):**
1. Alert: "Heads up: {county} reassessments are out — your home may be over-valued by ${delta}. Appeal deadline {date}."
2. +3d if no action: "Still time to appeal — here's your 3-step checklist + the comps that support it."
3. Outcome capture: "Did you appeal? Tell us what happened." (feeds $ saved metric + Historian)

**SMS (urgency only):** "⏰ {county} tax appeal deadline is {date}. Your PropertyDNA evidence is ready: {link}. Reply STOP to opt out."

**Push:** lead channel for time-sensitive alerts. Severity-tiered; critical alerts bypass the 2/week cap (with a per-event consent default).

**CRM:** tag `protected_event:{type}`; high-value alerts trigger a Quo task for a personal follow-up where appropriate; CC "Owner Alerts" audience.

**n8n design:** `advocate_calendar` (cron, county/insurance schedules) + `advocate_risk` (event on risk-layer change). Pull affected owners via spatial/zip query → Claude writes plain-English "why + what to do" → dispatch by severity → log + schedule outcome capture.

**Supabase additions:**
```sql
create table alerts (
  id bigint generated always as identity primary key,
  user_id uuid, property_id uuid,
  type text,            -- tax_reassessment|insurance_risk|flood|fire|deadline
  severity text,        -- info|warning|critical
  payload jsonb, action_url text,
  sent_at timestamptz, acted_at timestamptz, outcome jsonb
);
create table county_calendars (
  county text, state text, event_type text, window_start date, window_end date
);
```

---

### 3.5 Connector Agent — *connected*
**Mission:** Turn online homeowners into real-world participants — local homeowner meetups, town-hall/assessment-appeal clinics, neighborhood opportunities — without any in-app social surface. Connection happens *offline*; the agent is the matchmaker.

**Success metrics:** event invites sent → RSVPs → attendance, # local gatherings catalyzed, geographic density of active owners, offline-event NPS, retention of attendees.

**Trigger events:** density threshold reached in a ZIP/neighborhood (enough claimed homes), a relevant public event (assessment-appeal clinic, city council on zoning), seasonal ("pre-reassessment workshop").

**Data required:** user_profiles geo, claimed_properties density by area, a curated `local_events` table (manually seeded + scraped), consent + travel radius.

**User touchpoints:** invitation (email + push), calendar add, reminder SMS day-of, post-event "how was it / meet who you sat with" (offline intro, opt-in).

**Automated workflows:**
- *Density-triggered meetup* — when N claimed homes cluster, propose a meetup; collect RSVPs; hand a list to a host (you or a power user).
- *Civic clinic* — pair an Advocate tax-appeal window with a local "appeal clinic" invite for affected owners.

**Email sequence:**
1. "There are {N} PropertyDNA owners within {miles} of you — here's a meetup {date}."
2. RSVP confirmation + what to bring.
3. T-1d reminder; T+1d "thanks for coming — want a warm intro to a neighbor you met?" (opt-in, 1:1, not a feed).

**SMS:** day-of reminder + location pin. RSVP via reply (YES/NO).

**Push:** invite + day-of reminder, geofenced to the user's area.

**CRM:** tag `connector:rsvp/attended`; Quo holds the contact + event notes; attendees become Ambassador candidates.

**n8n design:** `connector_density` (cron, spatial clustering query) + `connector_event` (event-seeded). Generate invite via Claude, dispatch to in-radius consented users, collect RSVP via reply-webhook, manage reminders, log attendance.

**Supabase additions:**
```sql
create table local_events (
  id bigint generated always as identity primary key,
  title text, kind text,       -- meetup|appeal_clinic|civic|workshop
  city text, state text, zip text, lat numeric, lon numeric,
  starts_at timestamptz, host_user_id uuid, capacity int, details jsonb
);
create table event_rsvps (
  event_id bigint, user_id uuid, status text,  -- invited|yes|no|attended
  responded_at timestamptz, primary key (event_id, user_id)
);
```

---

### 3.6 Ambassador Agent — *recognized · connected*
**Mission:** Grow the movement through trusted, neighbor-to-neighbor invitation — referrals, "run your neighbor's home," QR distribution, and recognition loops — so growth compounds without paid ads or a social feed.

**Success metrics:** referral invites sent → activated referrals (K-factor), QR scans → signups, ambassadors created, viral coefficient, CAC avoided, neighborhood penetration %.

**Trigger events:** user reaches `activated`/`contributor`/`champion`, a delighted moment (big alert acted on, contribution accepted), QR scan, successful referral.

**Data required:** user_profiles.ambassador_code, referral graph, points, neighborhood penetration, the user's "shareable" assets (their public report token already exists: `/report/view/:token`).

**User touchpoints:** personal referral link/code, pre-filled "invite your neighbor" (email/SMS the user sends), printable QR (open-house QR infra already exists in tools/open-house-qrs), recognition on success.

**Automated workflows:**
- *Referral loop* — after a high-value moment, prompt "invite a neighbor; when they claim their home, you both get {reward}." Track via ambassador_code.
- *Neighbor invite* — "5 homes on your street aren't claimed — send them their free report" (uses the public report link; recipient gets value first, the ask is second).
- *QR drive* — generate per-ambassador QR codes for offline distribution (open houses, community boards), attribute scans.

**Email sequence:**
1. "You've taken ownership of your home's data. Help a neighbor do the same — {referral_link}."
2. On referral activation: "Your neighbor just claimed their home because of you. +100 points. 🏠"
3. Milestone: "You've brought {N} neighbors into the movement — you're a PropertyDNA Ambassador."

**SMS:** "Want to send your neighbor their free home report? Here's a link they'll thank you for: {referral_link}"

**Push:** recognition on successful referral; milestone badges (private recognition, not a public leaderboard).

**CRM:** tag `ambassador`, track K-factor; Quo campaign for top ambassadors; CC "Ambassadors" audience for movement updates.

**n8n design:** `ambassador_referral` (event on delight moments) + `ambassador_qr` (generates codes) + `referral_attribution` (matches new signups to codes, awards both sides, sends recognition).

**Supabase additions:**
```sql
create table referrals (
  id bigint generated always as identity primary key,
  referrer_id uuid, code text, channel text,     -- email|sms|qr|link
  invitee_email text, invitee_user_id uuid,
  status text default 'sent',                    -- sent|signed_up|claimed|rewarded
  reward jsonb, created_at timestamptz default now()
);
-- ambassador_code already on user_profiles; QR images live in storage/open-house-qrs
```

---

## 4. Cross-cutting systems

**Consent & deliverability.** Every dispatch checks `notification_preferences`. Transactional alerts (Advocate critical) use `reports@thepropertydna.com`; movement/marketing (Market weekly, Ambassador) use the campaign domain (`hello@mail`) — preserving your existing two-domain split + DMARC posture. One-tap unsubscribe per agent.

**Push infrastructure (new).** The Capacitor app needs the push plugin wired to APNs (iOS) / FCM (Android), a `device_tokens` capture on login, and a `send-push` Netlify function (FCM HTTP v1 / APNs token auth — reuse the App Store Connect .p8 key pattern you already use). This is the one genuinely new channel.

**CRM strategy.** Supabase = system of record. Outbound sync: **Constant Contact** audiences per lifecycle segment (Onboarding / Contributors / Owner-Alerts / Ambassadors), **Quo** for SMS contacts + 1:1 tasks + tags. `engagement_log` is the unified activity timeline. Nightly n8n `crm_sync` reconciles segments.

**Decision brain.** One shared `engagement-brain` Netlify function (intellagraph-ai.js pattern, `claude-sonnet-4-6`, prompt-cached system prompt) exposes: `render_copy(agent, user, context)` and `next_best_action(user)`. Agents call it; it never sends — it only decides/writes.

**Measurement.** North-star: **Activated Homeowners** (claimed + ≥1 ongoing engagement in 30d). Guardrail: unsubscribe rate < 0.5%/send, complaint rate < 0.1%. Per-agent metrics roll up from `engagement_log`.

---

## 5. Phased implementation roadmap (minimal app changes)

**Phase 0 — Foundations (no user-facing change).**
Schema: user_profiles, engagement_events, engagement_log, notification_preferences, device_tokens. Build the event-bus emitters (queue-report/save-report/auth already produce the signals — just write `engagement_events`). Build the shared `dispatch()` adapter (Resend + Quo exist) and the `engagement-brain` function. *App change: none.*

**Phase 1 — Steward + Advocate (retention + trust first).**
The two highest-ROI agents, mostly email/SMS off existing data. *App change (minimal): a "Claim this home" affordance on the report + a notification-preferences screen.* Advocate runs off the risk data save-report already computes. Ship the welcome series + tax/insurance alerts. **This is where you'll feel the lift.**

**Phase 2 — Market Analyst + Historian (engagement + data quality).**
Weekly insights (cron over the index) + contributions. *App change: a single document/answer upload control on the report; watchlist add.* Add push (the new channel) here so Market alerts land natively.

**Phase 3 — Connector + Ambassador (real-world + growth).**
Density-triggered meetups + referral/QR loops. *App change: referral link/QR in profile; RSVP via link.* Reuse the existing open-house-QR tooling. This is the compounding-growth phase, switched on only after retention (Phase 1) and engagement (Phase 2) are proven.

**Sequencing logic:** retain (1) → engage (2) → grow (3). Growing a leaky bucket wastes the referral. Each phase is independently shippable and reversible, and none of them turn PropertyDNA into a social network — they make it the **operating system for informed homeowners.**

---

*Take Ownership of Housing.*
