'use server'
// The whole login for this one-person CRM: enter the access key, get a 30-day
// JWT session. The key is compared constant-time (hash both sides so length
// never leaks), and a global backoff slows brute force — single operator,
// single machine, so a process-wide counter is enough.
import { redirect } from 'next/navigation'
import { createHash, timingSafeEqual } from 'node:crypto'
import { crmAccessKey } from '../../lib/env'
import { startSession } from '../../lib/session'
import { db } from '../../lib/db'
import { createUser } from '../../lib/auth'

const firstUserStmt = db.prepare(`SELECT id FROM users WHERE active = 1 ORDER BY id LIMIT 1`)

const g = globalThis as unknown as { __crmLoginFails?: number; __crmLoginUntil?: number }

function keyMatches(entered: string): boolean {
  const key = crmAccessKey()
  if (!key) return false // no key set ⇒ no login (fail closed)
  const a = createHash('sha256').update(entered).digest()
  const b = createHash('sha256').update(key).digest()
  return timingSafeEqual(a, b)
}

export async function accessLoginAction(formData: FormData): Promise<void> {
  const now = Date.now()
  if (g.__crmLoginUntil && now < g.__crmLoginUntil) redirect('/login?error=ratelimit')

  if (!keyMatches(String(formData.get('key') ?? ''))) {
    g.__crmLoginFails = (g.__crmLoginFails ?? 0) + 1
    if (g.__crmLoginFails >= 5) {
      g.__crmLoginUntil = now + 60_000 // 1-minute lockout after 5 misses
      g.__crmLoginFails = 0
    }
    redirect('/login?error=badkey')
  }

  g.__crmLoginFails = 0
  // The single operator — first active user, created on first login if the
  // table is empty. There's only ever one account in this CRM.
  const row = firstUserStmt.get() as { id: number } | undefined
  const id = row?.id ?? createUser('owner@woodchuckers', 'Owner').id
  await startSession(id)
  redirect('/')
}
