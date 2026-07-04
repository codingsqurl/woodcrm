// auth.ts — single-operator credential auth. bcrypt at cost 12; no public
// signup — seed the account with scripts/createuser.ts.
import bcrypt from 'bcryptjs'
import { db } from './db'

export type User = {
  id: number
  email: string
  name: string
}

const byIDStmt = db.prepare(`SELECT id, email, name FROM users WHERE id = ? AND active = 1`)
const byEmailStmt = db.prepare(
  `SELECT id, email, name, password_hash FROM users WHERE email = ? AND active = 1`,
)
const insertStmt = db.prepare(`INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)`)

export function userByID(id: number): User | null {
  return (byIDStmt.get(id) as User | undefined) ?? null
}

// verifyCredentials returns the user on success, null otherwise. Runs a dummy
// bcrypt compare when the email is unknown so response timing doesn't leak
// which emails exist.
const DUMMY_HASH = bcrypt.hashSync('woodchuckers-dummy', 12)

export function verifyCredentials(email: string, password: string): User | null {
  const row = byEmailStmt.get(email.trim().toLowerCase()) as
    | (User & { password_hash: string })
    | undefined
  const hash = row?.password_hash ?? DUMMY_HASH
  const ok = bcrypt.compareSync(password, hash)
  if (!ok || !row) return null
  return { id: row.id, email: row.email, name: row.name }
}

export function createUser(email: string, name: string, password: string): User {
  const hash = bcrypt.hashSync(password, 12)
  const info = insertStmt.run(email.trim().toLowerCase(), name, hash)
  return { id: Number(info.lastInsertRowid), email: email.trim().toLowerCase(), name }
}
