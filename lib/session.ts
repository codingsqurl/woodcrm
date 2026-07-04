// session.ts — server-side sessions: opaque 256-bit hex token in an HttpOnly
// cookie, rows in SQLite. Cookie writes only happen inside Server Actions /
// Route Handlers; reads work anywhere.
import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db, nowEpoch } from './db'
import { userByID, type User } from './auth'

export const SESSION_COOKIE = 'crm_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days: it's your phone, stay logged in

function newToken(): string {
  return randomBytes(32).toString('hex')
}

// Prepared once at module load; better-sqlite3 does not cache statements.
const pruneStmt = db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`)
const insertStmt = db.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`)
const resolveStmt = db.prepare(`SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?`)
const deleteStmt = db.prepare(`DELETE FROM sessions WHERE token = ?`)

export function pruneExpiredSessions(): void {
  pruneStmt.run(nowEpoch())
}

export async function startSession(userID: number): Promise<void> {
  pruneExpiredSessions()
  const token = newToken()
  const expires = new Date(Date.now() + SESSION_TTL_MS)
  insertStmt.run(token, userID, Math.floor(expires.getTime() / 1000))
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires,
    path: '/',
  })
}

export async function endSession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) deleteStmt.run(token)
  jar.delete(SESSION_COOKIE)
}

// currentUser resolves the cookie to a live user, or null. Plain read.
export async function currentUser(): Promise<User | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null
  const row = resolveStmt.get(token, nowEpoch()) as { user_id: number } | undefined
  if (!row) return null
  return userByID(row.user_id)
}

// requireUser gates a page/action: bounce to /login if unauthenticated.
export async function requireUser(): Promise<User> {
  const user = await currentUser()
  if (!user) redirect('/login')
  return user
}
