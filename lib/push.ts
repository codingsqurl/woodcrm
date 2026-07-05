// push.ts — Web Push without a dependency: VAPID (RFC 8292) + aes128gcm
// payload encryption (RFC 8291/8188) on node:crypto. ~100 lines of standard,
// and scripts/push-selftest.ts proves the round-trip, so the dependency
// doesn't earn its place. Keys are raw P-256 in base64url (same format the
// web-push CLI uses); generate a pair with `npm run vapid`.
import {
  createCipheriv,
  createECDH,
  createPrivateKey,
  hkdfSync,
  randomBytes,
  sign as cryptoSign,
} from 'node:crypto'
import { db } from './db'
import { vapidPrivateKey, vapidPublicKey, vapidSubject } from './env'

export function pushConfigured(): boolean {
  return !!vapidPublicKey() && !!vapidPrivateKey()
}

export function b64url(buf: Buffer): string {
  return buf.toString('base64url')
}

// ── VAPID (RFC 8292): a short-lived ES256 JWT scoped to the push origin ────

// vapidAuthHeader builds the Authorization value for one push endpoint origin.
// The JWT is signed with the raw P-256 private key, rebuilt as a JWK (x/y come
// from the uncompressed public key: 0x04 || X(32) || Y(32)).
export function vapidAuthHeader(audienceOrigin: string): string {
  const pub = Buffer.from(vapidPublicKey(), 'base64url')
  const priv = Buffer.from(vapidPrivateKey(), 'base64url')
  if (pub.length !== 65 || pub[0] !== 0x04 || priv.length !== 32) {
    throw new Error('VAPID keys malformed: expect base64url raw P-256 (65-byte public, 32-byte private)')
  }
  const key = createPrivateKey({
    format: 'jwk',
    key: {
      kty: 'EC',
      crv: 'P-256',
      d: b64url(priv),
      x: b64url(pub.subarray(1, 33)),
      y: b64url(pub.subarray(33, 65)),
    },
  })
  const header = b64url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64url(
    Buffer.from(
      JSON.stringify({
        aud: audienceOrigin,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: vapidSubject(),
      }),
    ),
  )
  const input = `${header}.${claims}`
  // JWTs carry the raw r||s signature (ieee-p1363), not DER.
  const sig = cryptoSign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' })
  return `vapid t=${input}.${b64url(sig)}, k=${vapidPublicKey()}`
}

// ── Payload encryption (RFC 8291, content coding aes128gcm from RFC 8188) ──

// encryptPayload seals `plaintext` for one subscription (p256dh = the
// browser's public key, auth = its 16-byte secret, both base64url). Returns
// the full aes128gcm body: header || ciphertext. Exported for the self-test.
export function encryptPayload(plaintext: Buffer, p256dh: string, auth: string): Buffer {
  const uaPublic = Buffer.from(p256dh, 'base64url')
  const authSecret = Buffer.from(auth, 'base64url')
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) throw new Error('bad p256dh')
  if (authSecret.length !== 16) throw new Error('bad auth secret')

  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const asPublic = ecdh.getPublicKey() // uncompressed, 65 bytes
  const sharedSecret = ecdh.computeSecret(uaPublic)

  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic])
  const ikm = Buffer.from(hkdfSync('sha256', sharedSecret, authSecret, keyInfo, 32))
  const salt = randomBytes(16)
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, 'Content-Encoding: aes128gcm\0', 16))
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, 'Content-Encoding: nonce\0', 12))

  // Single record: plaintext + 0x02 delimiter (last record), AES-128-GCM.
  const cipher = createCipheriv('aes-128-gcm', cek, nonce)
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.concat([plaintext, Buffer.from([0x02])])),
    cipher.final(),
    cipher.getAuthTag(),
  ])

  // aes128gcm header: salt(16) || record size(4) || keyid len(1) || keyid(65).
  const header = Buffer.alloc(16 + 4 + 1)
  salt.copy(header, 0)
  header.writeUInt32BE(4096, 16)
  header.writeUInt8(asPublic.length, 20)
  return Buffer.concat([header, asPublic, ciphertext])
}

// ── Sending ────────────────────────────────────────────────────────────────

export type PushSubscriptionRow = {
  id: number
  endpoint: string
  p256dh: string
  auth: string
}

export type PushMessage = { title: string; body: string; url: string }

// sendPush posts one encrypted message; returns the push service's status.
export async function sendPush(sub: PushSubscriptionRow, msg: PushMessage): Promise<number> {
  const sealed = encryptPayload(Buffer.from(JSON.stringify(msg)), sub.p256dh, sub.auth)
  // fetch's BodyInit doesn't take a Buffer type; copy into a plain Uint8Array.
  const body = new Uint8Array(sealed)
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: vapidAuthHeader(new URL(sub.endpoint).origin),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'normal',
    },
    body,
    signal: AbortSignal.timeout(10_000),
  })
  // Push services want the body consumed even when it's empty.
  await res.arrayBuffer().catch(() => undefined)
  return res.status
}

const allSubsStmt = db.prepare(`SELECT id, endpoint, p256dh, auth FROM push_subscriptions`)
const deleteSubStmt = db.prepare(`DELETE FROM push_subscriptions WHERE id = ?`)

// broadcastPush fans one message out to every subscription. 404/410 means the
// browser dropped the subscription — delete the row. Network errors keep the
// row (the phone being offline is not unsubscribing). Returns delivered count.
export async function broadcastPush(msg: PushMessage): Promise<number> {
  if (!pushConfigured()) return 0
  const subs = allSubsStmt.all() as PushSubscriptionRow[]
  let delivered = 0
  for (const sub of subs) {
    try {
      const status = await sendPush(sub, msg)
      if (status === 404 || status === 410) deleteSubStmt.run(sub.id)
      else if (status < 300) delivered++
      else console.error(`push: endpoint answered ${status} for sub ${sub.id}`)
    } catch (err) {
      console.error(`push: send failed for sub ${sub.id}:`, err)
    }
  }
  return delivered
}
