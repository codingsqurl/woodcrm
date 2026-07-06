BEGIN;

-- reminder_sent_at: when the customer got their pre-appointment reminder email.
-- NULL = not sent. Set once by the reminder loop so a booking is reminded once.
ALTER TABLE jobs ADD COLUMN reminder_sent_at INTEGER;

COMMIT;
