// POST /api/webhooks/health — an external uptime checker reports the site's
// status (roadmap #4, the second pulse-taker). Hosted checkers (UptimeRobot
// and friends) can't sign a custom HMAC, so auth is a shared token in the
// query string: /api/webhooks/health?token=...&status=down
//
// Status comes from ?status= or a JSON body { "status": "up" | "down" }.
// Transitions dedupe in lib/health.ts's shared state machine, so a checker
// that fires on every probe can't spam pushes.
import { timingSafeEqual } from 'node:crypto'
import { uptimeWebhookToken } from '../../../../lib/env'
import { reportExternalStatus } from '../../../../lib/health'

export const dynamic = 'force-dynamic'

function tokenOK(given: string): boolean {
  const expected = uptimeWebhookToken()
  if (!expected) return false // fail closed: unconfigured endpoint accepts nothing
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  if (!tokenOK(url.searchParams.get('token') ?? '')) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  let status = url.searchParams.get('status') ?? ''
  if (!status) {
    try {
      const body = (await req.json()) as { status?: string }
      status = body.status ?? ''
    } catch {
      // fall through — status stays empty and 400s below
    }
  }
  status = status.toLowerCase()
  if (status !== 'up' && status !== 'down') {
    return Response.json({ error: 'status must be up or down' }, { status: 400 })
  }

  await reportExternalStatus(status, 'uptime checker')
  return Response.json({ ok: true })
}
