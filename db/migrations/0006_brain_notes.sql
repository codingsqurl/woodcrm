BEGIN;

-- brain_notes: the second brain. Standalone knowledge notes (not the per-lead
-- notes table) that cross-link with [[wiki-links]] resolved by title. Title is
-- unique case-insensitively so a [[link]] always points at one note.
CREATE TABLE brain_notes (
  id         INTEGER PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX idx_brain_title ON brain_notes(title COLLATE NOCASE);

COMMIT;
