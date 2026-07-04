// webhook.ts — inbound webhook verification, Stripe-style. The site signs
// `${timestamp}.${rawBody}` with HMAC-SHA256 over a shared secret. We verify
// with a timing-safe compare and reject stale timestamps (>5 min skew) so a
// captured request can't be replayed forever. Idempotency (webhook_receipts)
// catches the rest.
import { createHmac, timingSafeEqual } from 'node:crypto'

const MAX_SKEW_SECONDS = 300

export function signPayload(secret: string, timestamp: string, rawBody: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
}

export function verifySignature(
  secret: string,
  timestamp: string,
  rawBody: string,
  signatureHex: string,
): boolean {
  if (!secret) return false // fail closed: unconfigured endpoint accepts nothing
  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return false
  if (Math.abs(Date.now() / 1000 - ts) > MAX_SKEW_SECONDS) return false

  const expected = Buffer.from(signPayload(secret, timestamp, rawBody), 'hex')
  let given: Buffer
  try {
    given = Buffer.from(signatureHex, 'hex')
  } catch {
    return false
  }
  if (given.length !== expected.length) return false
  return timingSafeEqual(given, expected)
}
