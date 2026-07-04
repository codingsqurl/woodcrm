// POST /api/webhooks/leads — lead intake from the Woodchuckers719 site's outbox.
//
// Contract (see patches/woodchuckers719/lib/outbox.ts, the sending side):
//   headers:
//     x-wc-timestamp: unix seconds the request was signed
//     x-wc-event-id:  UUID minted ONCE when the event was enqueued
//     x-wc-signature: hex HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
//   body: { kind: 'lead.created', lead: { source, name, phone, email, summary,
//           value_cents?, payload? } }
//
// The outbox retries until it sees 2xx, so duplicates are EXPECTED:
// webhook_receipts makes redelivery a cheap no-op. Always answer 200 for a
// replayed event_id — the sender needs to stop retrying, not try harder.
import { db } from '../../../../lib/db'
import { webhookSecret } from '../../../../lib/env'
import { verifySignature } from '../../../../lib/webhook'
import { createLead } from '../../../../lib/leads'

export const dynamic = 'force-dynamic'

const receiptStmt = db.prepare(`INSERT OR IGNORE INTO webhook_receipts (event_id) VALUES (?)`)

type LeadPayload = {
  kind?: string
  lead?: {
    source?: string
    name?: string
    phone?: string
    email?: string
    summary?: string
    value_cents?: number | null
    payload?: unknown
  }
}

export async function POST(req: Request) {
  const raw = await req.text()
  const timestamp = req.headers.get('x-wc-timestamp') ?? ''
  const eventID = req.headers.get('x-wc-event-id') ?? ''
  const signature = req.headers.get('x-wc-signature') ?? ''

  if (!verifySignature(webhookSecret(), timestamp, raw, signature)) {
    return Response.json({ error: 'invalid signature' }, { status: 401 })
  }
  if (!eventID || eventID.length > 128) {
    return Response.json({ error: 'missing event id' }, { status: 400 })
  }

  // Idempotency gate: first delivery inserts a receipt; replays change 0 rows.
  const receipt = receiptStmt.run(eventID)
  if (receipt.changes === 0) {
    return Response.json({ ok: true, duplicate: true })
  }

  let body: LeadPayload
  try {
    body = JSON.parse(raw) as LeadPayload
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 })
  }

  if (body.kind !== 'lead.created' || !body.lead) {
    return Response.json({ error: `unsupported kind` }, { status: 422 })
  }

  const l = body.lead
  const id = createLead({
    source: (l.source ?? 'site').slice(0, 64),
    name: (l.name ?? '').slice(0, 200),
    phone: (l.phone ?? '').slice(0, 50),
    email: (l.email ?? '').slice(0, 200),
    summary: (l.summary ?? '').slice(0, 1000),
    value_cents: typeof l.value_cents === 'number' ? Math.trunc(l.value_cents) : null,
    payload: l.payload ?? body,
  })

  return Response.json({ ok: true, lead_id: id })
}
