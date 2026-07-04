// db.ts — same proven pattern as the Woodchuckers719 site. One synchronous
// better-sqlite3 connection per process (SQLite is single-writer), cached on
// globalThis so Next's dev HMR reuses it. Migrations run on first open.
import Database from 'better-sqlite3'
import { runMigrations } from './migrate'

const DEFAULT_DSN = 'crm.db'

function open(): Database.Database {
  const dsn = process.env.DATABASE_URL || DEFAULT_DSN
  const db = new Database(dsn)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  runMigrations(db)
  return db
}

const globalForDb = globalThis as unknown as { __crmDb?: Database.Database }

export const db: Database.Database = globalForDb.__crmDb ?? (globalForDb.__crmDb = open())

export function nowEpoch(): number {
  return Math.floor(Date.now() / 1000)
}
