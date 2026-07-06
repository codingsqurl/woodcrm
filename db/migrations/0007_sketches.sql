BEGIN;

-- sketches: Excalidraw scenes. Standalone, or attached to a lead (the job
-- dossier — sketch the property, drop zones, rigging). `scene` is the
-- serialized Excalidraw JSON (elements + files + background).
CREATE TABLE sketches (
  id         INTEGER PRIMARY KEY,
  lead_id    INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'Sketch',
  scene      TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_sketches_lead ON sketches(lead_id, updated_at DESC);

COMMIT;
