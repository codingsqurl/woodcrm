-- 0010_outbox.sql — transactional outbox for CRM lead delivery.
--
-- The lead insert and its outbox row commit in the SAME transaction: if the
-- lead exists, its event exists. Delivery is a separate, retried concern —
-- the CRM being down for a deploy must never lose a lead. Leads are money.
BEGIN;

CREATE TABLE outbox (
  id              INTEGER PRIMARY KEY,
  event_id        TEXT NOT NULL UNIQUE,           -- minted once; CRM dedupes on it
  kind            TEXT NOT NULL,                  -- 'lead.created'
  payload         TEXT NOT NULL,                  -- JSON body to POST
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT (unixepoch()),
  delivered_at    INTEGER,
  last_error      TEXT NOT NULL DEFAULT '',
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

-- The pump only ever asks "what's undelivered and due" — partial index it.
CREATE INDEX idx_outbox_pending ON outbox(next_attempt_at) WHERE delivered_at IS NULL;

COMMIT;
