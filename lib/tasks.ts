// tasks.ts — follow-up reminders on leads. A task is "call this lead back by
// then": title + due time, done when tapped off, notified_at set when its
// push fired (fire once, never nag twice for the same task).
import { db, nowEpoch } from './db'

export type Task = {
  id: number
  lead_id: number | null
  title: string
  due_at: number
  done_at: number | null
  notified_at: number | null
  created_at: number
}

export type DueTask = Task & { lead_name: string | null }

const TASK_COLS = `id, lead_id, title, due_at, done_at, notified_at, created_at`

const insertStmt = db.prepare(`INSERT INTO tasks (lead_id, title, due_at) VALUES (?, ?, ?)`)
const byIDStmt = db.prepare(`SELECT ${TASK_COLS} FROM tasks WHERE id = ?`)
const forLeadStmt = db.prepare(
  `SELECT ${TASK_COLS} FROM tasks WHERE lead_id = ?
   ORDER BY done_at IS NOT NULL, due_at, id LIMIT 30`,
)
const completeStmt = db.prepare(`UPDATE tasks SET done_at = ? WHERE id = ? AND done_at IS NULL`)
const dueStmt = db.prepare(
  `SELECT t.id, t.lead_id, t.title, t.due_at, t.done_at, t.notified_at, t.created_at,
          l.name AS lead_name
   FROM tasks t LEFT JOIN leads l ON l.id = t.lead_id
   WHERE t.done_at IS NULL AND t.notified_at IS NULL AND t.due_at <= ?
   ORDER BY t.due_at LIMIT 50`,
)
const notifiedStmt = db.prepare(`UPDATE tasks SET notified_at = ? WHERE id = ?`)

export function createTask(leadID: number | null, title: string, dueAt: number): Task {
  const info = insertStmt.run(leadID, title, dueAt)
  return byIDStmt.get(info.lastInsertRowid) as Task
}

export function taskByID(id: number): Task | undefined {
  return byIDStmt.get(id) as Task | undefined
}

export function tasksForLead(leadID: number): Task[] {
  return forLeadStmt.all(leadID) as Task[]
}

export function completeTask(id: number): void {
  completeStmt.run(nowEpoch(), id)
}

// dueUnnotified: open tasks past due whose push hasn't fired yet.
export function dueUnnotified(now: number): DueTask[] {
  return dueStmt.all(now) as DueTask[]
}

export function markNotified(id: number): void {
  notifiedStmt.run(nowEpoch(), id)
}
