// POST /api/push/subscribe — store this browser's push subscription.
// DELETE — remove it (the toggle turned off). Both gated on a live session:
// push is for the crew's phones, not whoever finds the URL.
import { db } from '../../../../lib/db'
import { currentUser } from '../../../../lib/session'
import { pushConfigured } from '../../../../lib/push'

export const dynamic = 'force-dynamic'

const upsertStmt = db.prepare(
  `INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES (?, ?, ?)
   ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`,
)
const deleteStmt = db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`)

type SubscribeBody = {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
}

// A real subscription: https endpoint of sane length, p256dh decoding to an
// uncompressed P-256 point (65 bytes), auth to the 16-byte secret.
function validSubscription(b: SubscribeBody): b is { endpoint: string; keys: { p256dh: string; auth: string } } {
  const { endpoint, keys } = b
  if (!endpoint || endpoint.length > 2048 || !endpoint.startsWith('https://')) return false
  if (!keys?.p256dh || !keys?.auth) return false
  try {
    const point = Buffer.from(keys.p256dh, 'base64url')
    const secret = Buffer.from(keys.auth, 'base64url')
    return point.length === 65 && point[0] === 0x04 && secret.length === 16
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  if (!(await currentUser())) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (!pushConfigured()) return Response.json({ error: 'push not configured' }, { status: 503 })

  let body: SubscribeBody
  try {
    body = (await req.json()) as SubscribeBody
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 })
  }
  if (!validSubscription(body)) return Response.json({ error: 'bad subscription' }, { status: 400 })

  upsertStmt.run(body.endpoint, body.keys.p256dh, body.keys.auth)
  return Response.json({ ok: true })
}

export async function DELETE(req: Request) {
  if (!(await currentUser())) return Response.json({ error: 'unauthorized' }, { status: 401 })

  let body: { endpoint?: string }
  try {
    body = (await req.json()) as { endpoint?: string }
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 })
  }
  if (!body.endpoint || body.endpoint.length > 2048) {
    return Response.json({ error: 'bad endpoint' }, { status: 400 })
  }
  deleteStmt.run(body.endpoint)
  return Response.json({ ok: true })
}
