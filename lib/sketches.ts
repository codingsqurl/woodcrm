// sketches.ts — Excalidraw scenes stored as serialized JSON. A sketch is
// standalone or tied to a lead (the job dossier). The canvas autosaves the
// scene through the /api/sketch/[id] route; everything else is plain CRUD.
import { db, nowEpoch } from './db'

export type Sketch = {
  id: number
  lead_id: number | null
  title: string
  scene: string
  created_at: number
  updated_at: number
}

const COLS = `id, lead_id, title, scene, created_at, updated_at`
const insertStmt = db.prepare(`INSERT INTO sketches (lead_id, title) VALUES (?, ?)`)
const byIdStmt = db.prepare(`SELECT ${COLS} FROM sketches WHERE id = ?`)
const forLeadStmt = db.prepare(`SELECT ${COLS} FROM sketches WHERE lead_id = ? ORDER BY updated_at DESC`)
const listStmt = db.prepare(`SELECT ${COLS} FROM sketches ORDER BY updated_at DESC`)
const saveSceneStmt = db.prepare(`UPDATE sketches SET scene = ?, updated_at = ? WHERE id = ?`)
const renameStmt = db.prepare(`UPDATE sketches SET title = ?, updated_at = ? WHERE id = ?`)

export function createSketch(leadID: number | null, title = 'Sketch'): Sketch {
  const info = insertStmt.run(leadID, title)
  return byIdStmt.get(info.lastInsertRowid) as Sketch
}

export function sketchById(id: number): Sketch | null {
  return (byIdStmt.get(id) as Sketch | undefined) ?? null
}

export function sketchesForLead(leadID: number): Sketch[] {
  return forLeadStmt.all(leadID) as Sketch[]
}

export function listSketches(): Sketch[] {
  return listStmt.all() as Sketch[]
}

export function saveScene(id: number, scene: string): void {
  saveSceneStmt.run(scene, nowEpoch(), id)
}

export function renameSketch(id: number, title: string): void {
  renameStmt.run(title, nowEpoch(), id)
}
