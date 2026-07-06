BEGIN;

-- quotes: a dollar figure sent to a customer with a one-off unguessable token
-- they use to accept or decline from a public link. One lead can get several
-- (a revised number); the latest is what the lead page shows.
CREATE TABLE quotes (
  id           INTEGER PRIMARY KEY,
  lead_id      INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,           -- random; the accept/decline link
  amount_cents INTEGER NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'sent'
               CHECK (status IN ('sent', 'accepted', 'declined')),
  sent_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  responded_at INTEGER                          -- when the customer answered
);
CREATE INDEX idx_quotes_lead ON quotes(lead_id, sent_at DESC);

-- last_nudge_at: when the cold-lead loop last pinged the operator about this
-- lead. Kept older than updated_at so touching a lead re-arms one future nudge.
ALTER TABLE leads ADD COLUMN last_nudge_at INTEGER;

COMMIT;
