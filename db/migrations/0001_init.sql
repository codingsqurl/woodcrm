-- 0001_init.sql — Woodchuckers CRM core schema.
--
-- One operator, one machine, one SQLite file. The pipeline is the product:
-- leads arrive (webhook from the site, or entered by hand), move through
-- stages, and everything that happens to them is recorded as events + notes.
-- Money is INTEGER cents everywhere. Time is INTEGER unix epoch seconds.
BEGIN;

-- Single admin user (you). No public signup; seeded via scripts/createuser.ts.
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Server-side sessions: opaque 256-bit token in an HttpOnly cookie.
CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- The buyer is B2B: tree companies. Foremen/owners are contacts under them.
CREATE TABLE companies (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  city       TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE contacts (
  id         INTEGER PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT '',        -- 'owner', 'foreman', ...
  phone      TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_contacts_company ON contacts(company_id);

-- The pipeline. `stage` is the single source of truth for where a lead sits;
-- pipeline_events is the append-only history of how it got there.
CREATE TABLE leads (
  id          INTEGER PRIMARY KEY,
  source      TEXT NOT NULL,                  -- 'site:estimate' | 'site:contract' | 'manual' | 'referral'
  stage       TEXT NOT NULL DEFAULT 'new'
              CHECK (stage IN ('new','contacted','quoted','scheduled','done','paid','lost')),
  company_id  INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  contact_id  INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  name        TEXT NOT NULL DEFAULT '',       -- who reached out, as captured
  phone       TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL DEFAULT '',
  summary     TEXT NOT NULL DEFAULT '',       -- one-line: what the job is
  payload     TEXT NOT NULL DEFAULT '{}',     -- raw inbound webhook JSON, verbatim
  value_cents INTEGER,                        -- quoted/expected value; NULL until known
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_leads_stage ON leads(stage, updated_at DESC);

CREATE TABLE pipeline_events (
  id         INTEGER PRIMARY KEY,
  lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  from_stage TEXT,                            -- NULL on creation
  to_stage   TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_pipeline_lead ON pipeline_events(lead_id, created_at);

-- Notes attach to anything. Polymorphic on purpose: one write path, one list
-- query, and SQLite has no FK-per-type ceremony worth the join tax here.
CREATE TABLE notes (
  id          INTEGER PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead','company','contact','job')),
  entity_id   INTEGER NOT NULL,
  body        TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_notes_entity ON notes(entity_type, entity_id, created_at);

-- Day-rate climbing jobs on the calendar. (v1 priority #2 — schema now, UI next.)
CREATE TABLE jobs (
  id             INTEGER PRIMARY KEY,
  lead_id        INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  company_id     INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  address        TEXT NOT NULL DEFAULT '',
  starts_at      INTEGER NOT NULL,
  ends_at        INTEGER,
  status         TEXT NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled','done','canceled')),
  day_rate_cents INTEGER,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_jobs_starts ON jobs(starts_at);

-- Follow-up tasks. (v1 priority #3.) Partial index: the scheduler only ever
-- asks "what's open and due" — don't make it scan finished tasks.
CREATE TABLE tasks (
  id          INTEGER PRIMARY KEY,
  lead_id     INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  due_at      INTEGER NOT NULL,
  done_at     INTEGER,
  notified_at INTEGER,                        -- set when the push fired; fire once
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_tasks_open_due ON tasks(due_at) WHERE done_at IS NULL;

-- Webhook idempotency: one row per delivered event_id. The site's outbox
-- retries until it gets a 2xx, so duplicates are expected and must be no-ops.
CREATE TABLE webhook_receipts (
  event_id    TEXT PRIMARY KEY,
  received_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Web Push subscriptions (iOS 16.4+ home-screen PWA). (v1 priority #3.)
CREATE TABLE push_subscriptions (
  id         INTEGER PRIMARY KEY,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

COMMIT;
