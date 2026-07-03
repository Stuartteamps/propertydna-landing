-- 036_agent_ops_tables.sql
--
-- Standardized agent-ops logging & indexing tables for the PropertyDNA
-- operating platform. ADDITIVE ONLY: every statement is CREATE ... IF NOT
-- EXISTS. No existing table is dropped or altered.
--
-- NOTE — near-equivalent tables already exist and are intentionally left
-- untouched; these new tables give the agent-ops layer a single, consistent
-- schema to write to going forward:
--   * kpi_events            ~ engagement_metrics / report_events
--   * market_snapshots      ~ market_indexes
--   * indexing_jobs         ~ agent_runs (job-level)
--   * valuation_accuracy_log~ valuation_snapshots
--   * data_disputes         ~ data_quality_issues
--   * ops_activity_log      ~ agent_runs / agent_logs
-- Migrate/backfill from the legacy tables separately if/when desired.

-- ── 1. agent_runs — one row per agent invocation ────────────────────────────
CREATE TABLE IF NOT EXISTS agent_runs (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agent_name       text NOT NULL,
  started_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz,
  status           text NOT NULL DEFAULT 'running',  -- running | ok | error | skipped
  records_affected integer NOT NULL DEFAULT 0,
  error            text,
  meta             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_started ON agent_runs (agent_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status        ON agent_runs (status);

-- ── 2. agent_logs — structured log lines emitted by agents ──────────────────
CREATE TABLE IF NOT EXISTS agent_logs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agent_name  text NOT NULL,
  level       text NOT NULL DEFAULT 'info',  -- debug | info | warning | error
  message     text NOT NULL,
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_created ON agent_logs (agent_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_level         ON agent_logs (level);

-- ── 3. property_indexes — per-geo computed property metrics ──────────────────
CREATE TABLE IF NOT EXISTS property_indexes (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  geo_key     text NOT NULL,                 -- e.g. zip '92260', city 'La Quinta'
  geo_type    text NOT NULL,                 -- zip | city | county | state | metro
  metric      text NOT NULL,                 -- e.g. 'median_value', 'inventory'
  value       numeric,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_property_indexes_geo    ON property_indexes (geo_key, geo_type, metric);
CREATE INDEX IF NOT EXISTS idx_property_indexes_metric ON property_indexes (metric, computed_at DESC);

-- ── 4. market_indexes — per-geo market snapshot (rich) ──────────────────────
CREATE TABLE IF NOT EXISTS market_indexes (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  geo_key              text NOT NULL,
  geo_type             text NOT NULL,        -- zip | city | county | state | metro
  price_tier           text,                 -- e.g. 'entry' | 'mid' | 'luxury'
  active_inventory     integer,
  pending_volume       integer,
  closed_sales         integer,
  ppsf_low             numeric,
  ppsf_high            numeric,
  median_dom           numeric,
  absorption_rate      numeric,
  buyer_demand         numeric,
  valuation_spread     numeric,
  risk_adjusted_value  numeric,
  community_premium    numeric,
  snapshot_at          timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_market_indexes_geo_snapshot ON market_indexes (geo_key, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_indexes_geo_tier     ON market_indexes (geo_key, geo_type, price_tier);

-- ── 5. engagement_metrics — arbitrary engagement/KPI datapoints ─────────────
CREATE TABLE IF NOT EXISTS engagement_metrics (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  metric      text NOT NULL,                 -- e.g. 'report_views', 'signups'
  value       numeric,
  dims        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- dimensions: source, channel, geo...
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_metric ON engagement_metrics (metric, captured_at DESC);

-- ── 6. data_quality_issues — tracked data problems ──────────────────────────
CREATE TABLE IF NOT EXISTS data_quality_issues (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  issue_type  text NOT NULL,                 -- e.g. 'null_field', 'stale', 'duplicate'
  severity    text NOT NULL DEFAULT 'medium',-- low | medium | high | critical
  table_name  text,
  record_id   text,
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  status      text NOT NULL DEFAULT 'open',  -- open | ack | resolved | wontfix
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_data_quality_issues_status ON data_quality_issues (status);
CREATE INDEX IF NOT EXISTS idx_data_quality_issues_type   ON data_quality_issues (issue_type, severity);
CREATE INDEX IF NOT EXISTS idx_data_quality_issues_table  ON data_quality_issues (table_name, record_id);

-- ── 7. valuation_snapshots — point-in-time valuation outputs ────────────────
CREATE TABLE IF NOT EXISTS valuation_snapshots (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id    text,                        -- internal property id if known
  apn            text,                        -- assessor parcel number
  dna_score      numeric,
  valuation_low  numeric,
  valuation_mid  numeric,
  valuation_high numeric,
  confidence     numeric,
  comp_count     integer,
  method         text,                        -- e.g. 'avm_v3', 'comp_blend'
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_valuation_snapshots_apn      ON valuation_snapshots (apn, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_valuation_snapshots_property ON valuation_snapshots (property_id, created_at DESC);

-- ── 8. report_events — lifecycle events for property reports ─────────────────
CREATE TABLE IF NOT EXISTS report_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type  text NOT NULL,                 -- e.g. 'requested', 'generated', 'emailed', 'opened'
  report_id   text,
  email       text,
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_events_type_created ON report_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_events_report       ON report_events (report_id);
CREATE INDEX IF NOT EXISTS idx_report_events_email        ON report_events (email);
