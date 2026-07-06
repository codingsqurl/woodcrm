BEGIN;

-- review_requested_at: when the "leave us a review" ask was sent for this lead.
-- NULL = never asked. Set once (on the move to 'paid', or the manual button) so
-- a finished job turns into a review request exactly once, never nagged twice.
ALTER TABLE leads ADD COLUMN review_requested_at INTEGER;

COMMIT;
