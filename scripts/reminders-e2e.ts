// reminders-e2e.ts — end-to-end proof of the follow-up push pipeline, the part
// no unit test covers: a due task actually produces a VAPID-signed, encrypted
// Web Push that a real browser could decrypt.
//
// It runs against an ISOLATED temp DB (never crm.db) and a local mock push
// service that plays the browser's role: it captures the POST the CRM sends and
// decrypts the aes128gcm body (RFC 8291/8188) with the subscription's private
// key, then asserts the plaintext is the reminder. What it does NOT cover — and
// cannot, here — is Google/Apple actually relaying the push and the OS drawing
// the notification. That needs a real device (see the phone steps in the CRM
// README). Uses the real VAPID keys from .env.local when present, else mints a
// throwaway pair so the test is self-contained.
//
//   npm run test:reminders
import {
  createDecipheriv,
  createECDH,
  hkdfSync,
  randomBytes,
} from 'node:crypto'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ── env setup — must happen BEFORE importing anything that opens the DB ──────
const TMP_DB = join(tmpdir(), `reminders-e2e-${process.pid}.db`)
process.env.DATABASE_URL = TMP_DB

// Pull real VAPID keys from .env.local if the env doesn't already carry them,
// so `npm run test:reminders` exercises the keys that will actually ship.
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  try {
    for (const line of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
      const m = line.match(/^(VAPID_PUBLIC_KEY|VAPID_PRIVATE_KEY|VAPID_SUBJECT)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
    }
  } catch {
    // no .env.local — fall through to a generated pair
  }
}
let usingRealKeys = true
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  usingRealKeys = false
  const kp = createECDH('prime256v1')
  kp.generateKeys()
  process.env.VAPID_PUBLIC_KEY = kp.getPublicKey().toString('base64url')
  process.env.VAPID_PRIVATE_KEY = kp.getPrivateKey().toString('base64url')
}

let failures = 0
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failures++
}

// ── the mock browser / push service ─────────────────────────────────────────
// Holds the subscription's private key so it can decrypt what the CRM sends.
const ua = createECDH('prime256v1')
ua.generateKeys()
const authSecret = randomBytes(16)

type Captured = { plaintext: string; authHeader: string }
let captured: Captured | null = null

function decrypt(body: Buffer): string {
  const salt = body.subarray(0, 16)
  const idlen = body.readUInt8(20)
  const asPublic = body.subarray(21, 21 + idlen)
  const ciphertext = body.subarray(21 + idlen)

  const shared = ua.computeSecret(asPublic)
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPublic])
  const ikm = Buffer.from(hkdfSync('sha256', shared, authSecret, keyInfo, 32))
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, 'Content-Encoding: aes128gcm\0', 16))
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, 'Content-Encoding: nonce\0', 12))

  const decipher = createDecipheriv('aes-128-gcm', cek, nonce)
  decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16))
  const padded = Buffer.concat([
    decipher.update(ciphertext.subarray(0, ciphertext.length - 16)),
    decipher.final(),
  ])
  return padded.subarray(0, padded.length - 1).toString('utf8') // strip 0x02 delimiter
}

const mock = createServer((req, res) => {
  const chunks: Buffer[] = []
  req.on('data', (c) => chunks.push(c as Buffer))
  req.on('end', () => {
    try {
      captured = {
        plaintext: decrypt(Buffer.concat(chunks)),
        authHeader: req.headers['authorization'] ?? '',
      }
      res.writeHead(201).end() // 2xx so broadcastPush counts it delivered
    } catch (err) {
      console.error('mock decrypt failed:', err)
      res.writeHead(400).end()
    }
  })
})

async function main() {
  await new Promise<void>((r) => mock.listen(0, '127.0.0.1', r))
  const addr = mock.address()
  if (!addr || typeof addr === 'string') throw new Error('no mock port')
  const endpoint = `http://127.0.0.1:${addr.port}/push`

  // Import AFTER env is set so lib/db opens the temp DB and runs migrations.
  const { db, nowEpoch } = await import('../lib/db')
  const { createTask, taskByID } = await import('../lib/tasks')
  const { runDueReminders } = await import('../lib/reminders')
  const { pushConfigured } = await import('../lib/push')

  check('push is configured (VAPID keys present)', pushConfigured())

  // Register the mock as a subscription (direct insert: the /subscribe route
  // only accepts https endpoints, which is correct for prod; here we point at
  // the local mock).
  db.prepare(`INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES (?, ?, ?)`).run(
    endpoint,
    ua.getPublicKey().toString('base64url'),
    authSecret.toString('base64url'),
  )

  // A task due one second ago, no lead attached.
  const task = createTask(null, 'call Mike back about the oak', nowEpoch() - 1)

  const notified = await runDueReminders()

  check('runDueReminders reported 1 task', notified === 1)
  check('mock push service received the push', captured !== null)
  if (captured) {
    check('VAPID Authorization header present', captured.authHeader.startsWith('vapid t='))
    let payload: { title?: string; body?: string; url?: string } = {}
    try {
      payload = JSON.parse(captured.plaintext)
    } catch {
      /* leaves payload empty → checks below fail */
    }
    check(
      `decrypted title is the reminder (got: ${JSON.stringify(payload.title)})`,
      payload.title === 'Follow up: call Mike back about the oak',
    )
    check('decrypted url points at the pipeline root (no lead)', payload.url === '/')
  }

  const after = taskByID(task.id)
  check('task was marked notified (fire-once)', !!after?.notified_at)

  // Second run must not re-notify the same task.
  captured = null
  const again = await runDueReminders()
  check('re-run does not re-notify', again === 0 && captured === null)

  console.log(`\nVAPID keys: ${usingRealKeys ? 'REAL (.env.local)' : 'generated (throwaway)'}`)
}

main()
  .catch((err) => {
    console.error(err)
    failures++
  })
  .finally(() => {
    mock.close()
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        rmSync(TMP_DB + suffix)
      } catch {
        /* not created — ignore */
      }
    }
    console.log(failures === 0 ? '\nAll reminder e2e checks passed.' : `\n${failures} FAILURES`)
    process.exit(failures === 0 ? 0 : 1)
  })
