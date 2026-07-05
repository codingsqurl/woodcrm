// jobs.ts — day-rate appointments on the calendar. A job usually starts life
// attached to a lead (the site form fed the pipeline); scheduling one pulls
// the lead forward to 'scheduled' through the normal audited stage move.
import { db } from './db'
import { leadByID, moveLeadStage } from './leads'

export const JOB_STATUSES = ['scheduled', 'done', 'canceled'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export function isJobStatus(s: string): s is JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(s)
}

export type Job = {
  id: number
  lead_id: number | null
  title: string
  address: string
  starts_at: number
  ends_at: number | null
  status: JobStatus
  day_rate_cents: number | null
  created_at: number
}

const JOB_COLS = `id, lead_id, title, address, starts_at, ends_at, status, day_rate_cents, created_at`

const insertStmt = db.prepare(
  `INSERT INTO jobs (lead_id, title, address, starts_at, ends_at, day_rate_cents)
   VALUES (?, ?, ?, ?, ?, ?)`,
)
const byIDStmt = db.prepare(`SELECT ${JOB_COLS} FROM jobs WHERE id = ?`)
const inRangeStmt = db.prepare(
  `SELECT ${JOB_COLS} FROM jobs WHERE starts_at >= ? AND starts_at < ? ORDER BY starts_at, id`,
)
const forLeadStmt = db.prepare(
  `SELECT ${JOB_COLS} FROM jobs WHERE lead_id = ? ORDER BY starts_at DESC LIMIT 20`,
)
const setStatusStmt = db.prepare(`UPDATE jobs SET status = ? WHERE id = ?`)
const rescheduleStmt = db.prepare(`UPDATE jobs SET starts_at = ?, ends_at = ? WHERE id = ?`)

export type NewJob = {
  lead_id?: number | null
  title: string
  address?: string
  starts_at: number
  ends_at?: number | null
  day_rate_cents?: number | null
}

// createJob inserts the appointment and, when it's for a lead still earlier
// in the pipeline, advances that lead to 'scheduled' (audited, in the events
// table). The two writes aren't one transaction on purpose: a failed stage
// move must never eat the appointment.
export function createJob(j: NewJob): number {
  const info = insertStmt.run(
    j.lead_id ?? null,
    j.title,
    j.address ?? '',
    j.starts_at,
    j.ends_at ?? null,
    j.day_rate_cents ?? null,
  )
  const id = Number(info.lastInsertRowid)
  if (j.lead_id) {
    const lead = leadByID(j.lead_id)
    if (lead && ['new', 'contacted', 'quoted'].includes(lead.stage)) {
      moveLeadStage(j.lead_id, 'scheduled', `job #${id} scheduled: ${j.title}`)
    }
  }
  return id
}

export function jobByID(id: number): Job | null {
  return (byIDStmt.get(id) as Job | undefined) ?? null
}

export function jobsInRange(fromEpoch: number, toEpoch: number): Job[] {
  return inRangeStmt.all(fromEpoch, toEpoch) as Job[]
}

export function jobsForLead(leadID: number): Job[] {
  return forLeadStmt.all(leadID) as Job[]
}

export function setJobStatus(id: number, status: JobStatus): void {
  setStatusStmt.run(status, id)
}

export function rescheduleJob(id: number, startsAt: number, endsAt: number | null): void {
  rescheduleStmt.run(startsAt, endsAt, id)
}

// upcomingCount powers the topbar badge: scheduled jobs from today onward.
const upcomingStmt = db.prepare(
  `SELECT COUNT(*) AS n FROM jobs WHERE status = 'scheduled' AND starts_at >= ?`,
)

export function upcomingJobCount(): number {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  return (upcomingStmt.get(Math.floor(startOfToday.getTime() / 1000)) as { n: number }).n
}
