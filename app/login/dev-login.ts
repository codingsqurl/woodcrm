'use server'
// dev-login.ts — local-testing bypass. Signs in as the first active user
// (creating dev@localhost if the table is empty). Gated on NODE_ENV, which
// `next build` compiles to 'production' — this action is a no-op in any
// deployed build, so Google OAuth stays the only real door.
import { redirect } from 'next/navigation'
import { createUser } from '../../lib/auth'
import { db } from '../../lib/db'
import { startSession } from '../../lib/session'

const firstUserStmt = db.prepare(`SELECT id FROM users WHERE active = 1 ORDER BY id LIMIT 1`)

export async function devLoginAction(): Promise<void> {
  if (process.env.NODE_ENV === 'production') redirect('/login')
  const row = firstUserStmt.get() as { id: number } | undefined
  const id = row?.id ?? createUser('dev@localhost', 'Dev').id
  await startSession(id)
  redirect('/')
}
