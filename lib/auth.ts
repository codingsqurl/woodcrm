// auth.ts — single-operator identity. Sign-in happens via Google OAuth
// (lib/google.ts + app/api/auth/google); this module just owns the users
// table. No public signup — rows come from scripts/createuser.ts or the
// GOOGLE_ALLOWED_EMAILS auto-provision list.
import { db } from './db'

export type User = {
  id: number
  email: string
  name: string
}

const byIDStmt = db.prepare(`SELECT id, email, name FROM users WHERE id = ? AND active = 1`)
const byEmailStmt = db.prepare(`SELECT id, email, name FROM users WHERE email = ? AND active = 1`)
const insertStmt = db.prepare(`INSERT INTO users (email, name) VALUES (?, ?)`)

export function userByID(id: number): User | null {
  return (byIDStmt.get(id) as User | undefined) ?? null
}

export function userByEmail(email: string): User | null {
  return (byEmailStmt.get(email.trim().toLowerCase()) as User | undefined) ?? null
}

export function createUser(email: string, name: string): User {
  const normalized = email.trim().toLowerCase()
  const info = insertStmt.run(normalized, name)
  return { id: Number(info.lastInsertRowid), email: normalized, name }
}
