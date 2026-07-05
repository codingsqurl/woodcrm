// push-selftest.ts — proves the hand-rolled Web Push crypto in lib/push.ts
// against an in-process receiver implementing the browser's side of RFC 8291:
// decrypt what encryptPayload sealed, verify the VAPID JWT signature. No
// network, no browser — pure math. Run: npm run selftest:push
import {
  createDecipheriv,
  createECDH,
  createPublicKey,
  hkdfSync,
  randomBytes,
  verify as cryptoVerify,
} from 'node:crypto'

// Fake VAPID keys + fake subscriber, injected before lib/push loads env.
const vapid = createECDH('prime256v1')
vapid.generateKeys()
process.env.VAPID_PUBLIC_KEY = vapid.getPublicKey().toString('base64url')
process.env.VAPID_PRIVATE_KEY = vapid.getPrivateKey().toString('base64url')
process.env.DATABASE_URL = ':memory:'

const { encryptPayload, vapidAuthHeader } = await import('../lib/push')

let failures = 0
function check(name: string, ok: boolean) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failures++
}

// ── 1. encryption round-trip (receiver per RFC 8291 / RFC 8188) ────────────
const ua = createECDH('prime256v1')
ua.generateKeys()
const authSecret = randomBytes(16)
const message = Buffer.from(JSON.stringify({ title: 'Follow up: call Mike', body: 'Ponderosa Tree Co', url: '/leads/7' }))

const sealed = encryptPayload(
  message,
  ua.getPublicKey().toString('base64url'),
  authSecret.toString('base64url'),
)

// Parse the aes128gcm header: salt(16) | rs(4) | idlen(1) | keyid(idlen).
const salt = sealed.subarray(0, 16)
const rs = sealed.readUInt32BE(16)
const idlen = sealed.readUInt8(20)
const asPublic = sealed.subarray(21, 21 + idlen)
const ciphertext = sealed.subarray(21 + idlen)

check('header: record size 4096', rs === 4096)
check('header: keyid is a 65-byte uncompressed point', idlen === 65 && asPublic[0] === 0x04)

const sharedSecret = ua.computeSecret(asPublic)
const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPublic])
const ikm = Buffer.from(hkdfSync('sha256', sharedSecret, authSecret, keyInfo, 32))
const cek = Buffer.from(hkdfSync('sha256', ikm, salt, 'Content-Encoding: aes128gcm\0', 16))
const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, 'Content-Encoding: nonce\0', 12))

const decipher = createDecipheriv('aes-128-gcm', cek, nonce)
decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16))
const padded = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()])
check('record ends with the 0x02 last-record delimiter', padded[padded.length - 1] === 0x02)
check('decrypted payload matches the original', padded.subarray(0, -1).equals(message))

// ── 2. VAPID header shape + ES256 signature ────────────────────────────────
const header = vapidAuthHeader('https://web.push.apple.com')
const m = header.match(/^vapid t=([\w-]+\.[\w-]+\.[\w-]+), k=([\w-]+)$/)
check('Authorization header shape', !!m)
if (m) {
  const [h, c, s] = m[1].split('.')
  const claims = JSON.parse(Buffer.from(c, 'base64url').toString())
  check('JWT aud is the push origin', claims.aud === 'https://web.push.apple.com')
  check('JWT exp is in the future (≤24h)', claims.exp > Date.now() / 1000 && claims.exp <= Date.now() / 1000 + 86400)
  check('k matches the configured public key', m[2] === process.env.VAPID_PUBLIC_KEY)

  const pub = vapid.getPublicKey()
  const key = createPublicKey({
    format: 'jwk',
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: pub.subarray(1, 33).toString('base64url'),
      y: pub.subarray(33, 65).toString('base64url'),
    },
  })
  const ok = cryptoVerify(
    'sha256',
    Buffer.from(`${h}.${c}`),
    { key, dsaEncoding: 'ieee-p1363' },
    Buffer.from(s, 'base64url'),
  )
  check('ES256 signature verifies with the public key', ok)
}

// ── 3. tampering is detected ───────────────────────────────────────────────
try {
  const tampered = Buffer.from(sealed)
  tampered[tampered.length - 1] ^= 0xff
  const d2 = createDecipheriv('aes-128-gcm', cek, nonce)
  d2.setAuthTag(tampered.subarray(tampered.length - 16))
  d2.update(tampered.subarray(21 + idlen, tampered.length - 16))
  d2.final()
  check('tampered ciphertext rejected', false)
} catch {
  check('tampered ciphertext rejected', true)
}

console.log(failures === 0 ? '\nAll push self-tests passed.' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
