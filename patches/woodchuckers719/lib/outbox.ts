// outbox.ts — DROP INTO Woodchuckers719 at lib/outbox.ts (requires migration
// 0010_outbox.sql). Transactional outbox → signed webhook delivery to the CRM.
//
// Rules of the road:
//   1. enqueueLeadEvent is SYNCHRONOUS and cheap — call it inside the same
//      better-sqlite3 transaction that inserts the estimate/lead. Lead and
//      event commit together or not at all.
//   2. Delivery is async and retried with exponential backoff. The CRM answers
//      200 for duplicates (it dedupes on event_id), so retrying is always safe.
//   3. If CRM_WEBHOOK_URL / CRM_WEBHOOK_SECRET are unset, everything no-ops:
//      the site never depends on the CRM to take a lead.
//
// Env (set in fly secrets / .env.local):
//   CRM_WEBHOOK_URL=https://woodchuckers-crm.fly.dev/api/webhooks/leads
//   CRM_WEBHOOK_SECRET=<same value as the CRM's CRM_WEBHOOK_SECRET>
import { createHmac, randomUUID } from 'node:crypto'
import { db } from './db'

const MAX_BACKOFF_S = 3600
const PUMP_INTERVAL_MS = 60_000
const BATCH = 20

export type LeadEvent = {
  source: string // 'site:estimate' | 'site:contract' | ...
  name?: string
  phone?: string
  email?: string
  summary?: string
  value_cents?: number | null
  payload?: unknown // raw form data, stored verbatim on the CRM side
}

const enqueueStmt = db.prepare(
  `INSERT INTO outbox (event_id, kind, payload) VALUES (?, 'lead.created', ?)`,
)
const dueStmt = db.prepare(
  `SELECT id, event_id, kind, payload, attempts FROM outbox
    WHERE delivered_at IS NULL AND next_attempt_at <= ?
    ORDER BY id LIMIT ?`,
)
const deliveredStmt = db.prepare(`UPDATE outbox SET delivered_at = ? WHERE id = ?`)
const failedStmt = db.prepare(
  `UPDATE outbox SET attempts = attempts + 1, next_attempt_at = ?, last_error = ? WHERE id = ?`,
)

function configured(): { url: string; secret: string } | null {
  const url = process.env.CRM_WEBHOOK_URL
  const secret = process.env.CRM_WEBHOOK_SECRET
  if (!url || !secret) return null
  return { url, secret }
}

// enqueueLeadEvent — call inside the transaction that creates the lead.
// Synchronous by design; returns the event id.
export function enqueueLeadEvent(lead: LeadEvent): string {
  const eventID = randomUUID()
  enqueueStmt.run(eventID, JSON.stringify({ kind: 'lead.created', lead }))
  return eventID
}

// kickOutbox — fire-and-forget delivery attempt; call right AFTER the
// transaction commits so the row is visible. The pump interval is the safety
// net if the process dies mid-flight.
export function kickOutbox(): void {
  void deliverPending().catch(() => {
    /* pump retries; errors are recorded per-row in last_error */
  })
}

export async function deliverPending(): Promise<void> {
  const cfg = configured()
  if (!cfg) return

  const now = Math.floor(Date.now() / 1000)
  const rows = dueStmt.all(now, BATCH) as {
    id: number
    event_id: string
    kind: string
    payload: string
    attempts: number
  }[]

  for (const row of rows) {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = createHmac('sha256', cfg.secret)
      .update(`${timestamp}.${row.payload}`)
      .digest('hex')

    try {
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-wc-timestamp': timestamp,
          'x-wc-event-id': row.event_id,
          'x-wc-signature': signature,
        },
        body: row.payload,
        signal: AbortSignal.timeout(10_000),
      })
      if (res.ok) {
        deliveredStmt.run(Math.floor(Date.now() / 1000), row.id)
        continue
      }
      recordFailure(row.id, row.attempts, `http ${res.status}`)
    } catch (err) {
      recordFailure(row.id, row.attempts, err instanceof Error ? err.message : String(err))
    }
  }
}

function recordFailure(id: number, attempts: number, error: string): void {
  // 30s, 1m, 2m, 4m ... capped at 1h. A dead CRM costs minutes of lag, not leads.
  const backoff = Math.min(2 ** attempts * 30, MAX_BACKOFF_S)
  failedStmt.run(Math.floor(Date.now() / 1000) + backoff, error.slice(0, 500), id)
}

// startOutboxPump — idempotent; starts one interval per process. Call once
// from instrumentation.ts (register()) or lazily from the first enqueue site.
const g = globalThis as unknown as { __outboxPump?: ReturnType<typeof setInterval> }

export function startOutboxPump(): void {
  if (g.__outboxPump || !configured()) return
  g.__outboxPump = setInterval(() => {
    void deliverPending().catch(() => {})
  }, PUMP_INTERVAL_MS)
  g.__outboxPump.unref?.()
}
