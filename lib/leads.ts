// leads.ts — the pipeline domain layer. Every stage move is a transaction:
// update the lead AND append the pipeline_events row, or neither. The events
// table is the audit trail that makes "when did I quote Martinez?" answerable.
import { db, nowEpoch } from './db'

export const STAGES = ['new', 'contacted', 'quoted', 'scheduled', 'done', 'paid', 'lost'] as const
export type Stage = (typeof STAGES)[number]

// The happy path through the pipeline; `lost` is a side exit from anywhere.
export function nextStage(s: Stage): Stage | null {
  const path: Stage[] = ['new', 'contacted', 'quoted', 'scheduled', 'done', 'paid']
  const i = path.indexOf(s)
  return i >= 0 && i < path.length - 1 ? path[i + 1] : null
}

export function isStage(s: string): s is Stage {
  return (STAGES as readonly string[]).includes(s)
}

export type Lead = {
  id: number
  source: string
  stage: Stage
  name: string
  phone: string
  email: string
  summary: string
  value_cents: number | null
  created_at: number
  updated_at: number
}

export type PipelineEvent = {
  id: number
  from_stage: string | null
  to_stage: string
  note: string
  created_at: number
}

export type Note = { id: number; body: string; created_at: number }

const listByStageStmt = db.prepare(
  `SELECT id, source, stage, name, phone, email, summary, value_cents, created_at, updated_at
     FROM leads WHERE stage = ? ORDER BY updated_at DESC LIMIT 200`,
)
const stageTotalsStmt = db.prepare(
  `SELECT stage, COUNT(*) AS n, COALESCE(SUM(value_cents), 0) AS cents
     FROM leads GROUP BY stage`,
)
const byIDStmt = db.prepare(
  `SELECT id, source, stage, name, phone, email, summary, value_cents, created_at, updated_at
     FROM leads WHERE id = ?`,
)
const moveStmt = db.prepare(`UPDATE leads SET stage = ?, updated_at = ? WHERE id = ?`)
const setValueStmt = db.prepare(`UPDATE leads SET value_cents = ?, updated_at = ? WHERE id = ?`)
const eventStmt = db.prepare(
  `INSERT INTO pipeline_events (lead_id, from_stage, to_stage, note) VALUES (?, ?, ?, ?)`,
)
const eventsStmt = db.prepare(
  `SELECT id, from_stage, to_stage, note, created_at
     FROM pipeline_events WHERE lead_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`,
)
const insertLeadStmt = db.prepare(
  `INSERT INTO leads (source, name, phone, email, summary, payload, value_cents)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
)
const notesStmt = db.prepare(
  `SELECT id, body, created_at FROM notes
    WHERE entity_type = 'lead' AND entity_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`,
)
const addNoteStmt = db.prepare(
  `INSERT INTO notes (entity_type, entity_id, body) VALUES ('lead', ?, ?)`,
)

export function leadsByStage(stage: Stage): Lead[] {
  return listByStageStmt.all(stage) as Lead[]
}

export type StageTotal = { stage: Stage; n: number; cents: number }

export function stageTotals(): Map<Stage, StageTotal> {
  const rows = stageTotalsStmt.all() as StageTotal[]
  const m = new Map<Stage, StageTotal>()
  for (const s of STAGES) m.set(s, { stage: s, n: 0, cents: 0 })
  for (const r of rows) m.set(r.stage, r)
  return m
}

export function leadByID(id: number): Lead | null {
  return (byIDStmt.get(id) as Lead | undefined) ?? null
}

export function leadEvents(id: number): PipelineEvent[] {
  return eventsStmt.all(id) as PipelineEvent[]
}

export function leadNotes(id: number): Note[] {
  return notesStmt.all(id) as Note[]
}

export function addLeadNote(id: number, body: string): void {
  addNoteStmt.run(id, body)
}

// activeLeads: candidates for the schedule form — anything not out the side
// door (lost) or fully finished (paid).
const activeStmt = db.prepare(
  `SELECT id, source, stage, name, phone, email, summary, value_cents, created_at, updated_at
     FROM leads WHERE stage NOT IN ('lost', 'paid') ORDER BY updated_at DESC LIMIT 200`,
)

export function activeLeads(): Lead[] {
  return activeStmt.all() as Lead[]
}

// leadAddress digs the service address out of the raw webhook payload (the
// site's estimate form captures it; the leads table itself has no column).
const payloadStmt = db.prepare(`SELECT payload FROM leads WHERE id = ?`)

export function leadAddress(id: number): string {
  const row = payloadStmt.get(id) as { payload: string } | undefined
  if (!row) return ''
  try {
    const p = JSON.parse(row.payload) as { address?: unknown; lead?: { address?: unknown } }
    const addr = p.address ?? p.lead?.address
    return typeof addr === 'string' ? addr : ''
  } catch {
    return ''
  }
}

// moveLeadStage: the only way a stage changes. Lead row + event row, atomically.
const moveTx = db.transaction((id: number, from: Stage, to: Stage, note: string) => {
  moveStmt.run(to, nowEpoch(), id)
  eventStmt.run(id, from, to, note)
})

export function moveLeadStage(id: number, to: Stage, note = ''): boolean {
  const lead = leadByID(id)
  if (!lead || lead.stage === to) return false
  moveTx(id, lead.stage, to, note)
  return true
}

export function setLeadValue(id: number, valueCents: number | null): void {
  setValueStmt.run(valueCents, nowEpoch(), id)
}

export type NewLead = {
  source: string
  name?: string
  phone?: string
  email?: string
  summary?: string
  payload?: unknown
  value_cents?: number | null
}

// createLead: insert + birth event ('new'), atomically. Used by the webhook
// receiver and by manual entry.
const createTx = db.transaction((l: NewLead): number => {
  const info = insertLeadStmt.run(
    l.source,
    l.name ?? '',
    l.phone ?? '',
    l.email ?? '',
    l.summary ?? '',
    JSON.stringify(l.payload ?? {}),
    l.value_cents ?? null,
  )
  const id = Number(info.lastInsertRowid)
  eventStmt.run(id, null, 'new', `lead created (${l.source})`)
  return id
})

export function createLead(l: NewLead): number {
  return createTx(l)
}
